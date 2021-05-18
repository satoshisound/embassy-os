use std::future::Future;
use std::hash::{Hash, Hasher};
use std::marker::PhantomData;
use std::net::Ipv4Addr;
use std::ops::Deref;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::str::FromStr;

use async_trait::async_trait;
use file_lock::FileLock;
use id_pool::IdPool;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use tokio::fs::File;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt, ReadBuf};

use crate::{Error, ResultExt as _};

#[derive(Debug, Clone)]
pub struct PersistencePath(PathBuf);
impl PersistencePath {
    pub fn from_ref<P: AsRef<Path>>(p: P) -> Self {
        let path = p.as_ref();
        PersistencePath(if path.has_root() {
            path.strip_prefix("/").unwrap().to_owned()
        } else {
            path.to_owned()
        })
    }

    pub fn new(path: PathBuf) -> Self {
        PersistencePath(if path.has_root() {
            path.strip_prefix("/").unwrap().to_owned()
        } else {
            path.to_owned()
        })
    }

    pub fn join<P: AsRef<Path>>(&self, path: P) -> Self {
        PersistencePath::new(self.0.join(path))
    }

    pub fn tmp(&self) -> PathBuf {
        Path::new(crate::TMP_DIR).join(&self.0)
    }

    pub fn path(&self) -> PathBuf {
        Path::new(crate::PERSISTENCE_DIR).join(&self.0)
    }

    pub async fn lock(&self, for_update: bool) -> Result<FileLock, Error> {
        let path = self.path();
        let lock_path = format!("{}.lock", path.display());
        if tokio::fs::metadata(Path::new(&lock_path)).await.is_err() {
            // !exists
            tokio::fs::File::create(&lock_path)
                .await
                .with_ctx(|_| (crate::ErrorKind::Filesystem, lock_path.clone()))?;
        }
        let lock = lock_file(lock_path.clone(), for_update)
            .await
            .with_ctx(|_| (crate::ErrorKind::Filesystem, lock_path))?;
        Ok(lock)
    }

    pub async fn exists(&self) -> bool {
        tokio::fs::metadata(self.path()).await.is_ok()
    }

    pub async fn maybe_read(&self, for_update: bool) -> Option<Result<PersistenceFile, Error>> {
        if self.exists().await {
            // exists
            Some(self.read(for_update).await)
        } else {
            None
        }
    }

    pub async fn read(&self, for_update: bool) -> Result<PersistenceFile, Error> {
        let path = self.path();
        let lock = self.lock(for_update).await?;
        let file = File::open(&path)
            .await
            .with_ctx(|_| (crate::ErrorKind::Filesystem, path.display().to_string()))?;
        Ok(PersistenceFile::new(file, lock, None))
    }

    pub async fn write(&self, lock: Option<FileLock>) -> Result<PersistenceFile, Error> {
        let path = self.path();
        if let Some(parent) = path.parent() {
            if tokio::fs::metadata(parent).await.is_err() {
                // !exists
                tokio::fs::create_dir_all(parent).await?;
            }
        }
        let lock = if let Some(lock) = lock {
            lock
        } else {
            self.lock(true).await?
        };
        Ok({
            let path = self.tmp();
            if let Some(parent) = path.parent() {
                if tokio::fs::metadata(parent).await.is_err() {
                    // !exists
                    tokio::fs::create_dir_all(parent).await?;
                }
            }
            PersistenceFile::new(File::create(path).await?, lock, Some(self.clone()))
        })
    }

    pub async fn for_update(self) -> Result<UpdateHandle<ForRead>, Error> {
        UpdateHandle::new(self).await
    }

    pub async fn delete(&self) -> Result<(), Error> {
        match tokio::fs::remove_file(self.path()).await {
            Ok(()) => Ok(()),
            Err(k) if k.kind() == std::io::ErrorKind::NotFound => Ok(()),
            e => e.with_kind(crate::ErrorKind::Filesystem),
        }
    }
}

#[derive(Debug)]
pub struct PersistenceFile {
    file: Option<File>,
    lock: Option<FileLock>,
    needs_commit: Option<PersistencePath>,
}
impl PersistenceFile {
    pub fn new(file: File, lock: FileLock, needs_commit: Option<PersistencePath>) -> Self {
        PersistenceFile {
            file: Some(file),
            lock: Some(lock),
            needs_commit,
        }
    }

    pub fn take_lock(&mut self) -> Option<FileLock> {
        self.lock.take()
    }

    /// Commits the file to the persistence directory.
    /// If this fails, the file was not saved.
    pub async fn commit(mut self) -> Result<(), Error> {
        if let Some(mut file) = self.file.take() {
            file.flush().await?;
            file.shutdown().await?;
            file.sync_all().await?;
            drop(file);
        }
        if let Some(path) = self.needs_commit.take() {
            tokio::fs::rename(path.tmp(), path.path())
                .await
                .with_ctx(|_| {
                    (
                        crate::ErrorKind::Filesystem,
                        format!("{} -> {}", path.tmp().display(), path.path().display(),),
                    )
                })?;
            if let Some(lock) = self.lock.take() {
                unlock(lock).await.with_ctx(|_| {
                    (
                        crate::ErrorKind::Filesystem,
                        path.path().display().to_string(),
                    )
                })?;
            }

            Ok(())
        } else {
            Ok(())
        }
    }
}
impl std::ops::Deref for PersistenceFile {
    type Target = File;

    fn deref(&self) -> &Self::Target {
        self.file.as_ref().unwrap()
    }
}
impl std::ops::DerefMut for PersistenceFile {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.file.as_mut().unwrap()
    }
}
impl AsRef<File> for PersistenceFile {
    fn as_ref(&self) -> &File {
        &*self
    }
}
impl AsMut<File> for PersistenceFile {
    fn as_mut(&mut self) -> &mut File {
        &mut *self
    }
}
impl Drop for PersistenceFile {
    fn drop(&mut self) {
        if let Some(path) = &self.needs_commit {
            log::warn!(
                "{} was dropped without being committed.",
                path.path().display()
            );
        }
    }
}

pub trait UpdateHandleMode {}
pub struct ForRead;
impl UpdateHandleMode for ForRead {}
pub struct ForWrite;
impl UpdateHandleMode for ForWrite {}

pub struct UpdateHandle<Mode: UpdateHandleMode> {
    path: PersistencePath,
    file: PersistenceFile,
    mode: PhantomData<Mode>,
}
impl UpdateHandle<ForRead> {
    pub async fn new(path: PersistencePath) -> Result<Self, Error> {
        if !path.path().exists() {
            tokio::fs::File::create(path.path()).await?;
        }
        Ok(UpdateHandle {
            file: path.read(true).await?,
            path,
            mode: PhantomData,
        })
    }

    pub async fn into_writer(mut self) -> Result<UpdateHandle<ForWrite>, Error> {
        let lock = self.file.take_lock();
        Ok(UpdateHandle {
            file: self.path.write(lock).await?,
            path: self.path,
            mode: PhantomData,
        })
    }
}

impl UpdateHandle<ForWrite> {
    pub async fn commit(self) -> Result<(), Error> {
        self.file.commit().await
    }
}

impl tokio::io::AsyncRead for UpdateHandle<ForRead> {
    fn poll_read(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &mut ReadBuf,
    ) -> std::task::Poll<std::io::Result<()>> {
        unsafe { self.map_unchecked_mut(|a| a.file.file.as_mut().unwrap()) }.poll_read(cx, buf)
    }
}

impl tokio::io::AsyncWrite for UpdateHandle<ForWrite> {
    fn poll_write(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &[u8],
    ) -> std::task::Poll<std::io::Result<usize>> {
        tokio::io::AsyncWrite::poll_write(
            unsafe { self.map_unchecked_mut(|a| a.file.file.as_mut().unwrap()) },
            cx,
            buf,
        )
    }
    fn poll_flush(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        tokio::io::AsyncWrite::poll_flush(
            unsafe { self.map_unchecked_mut(|a| a.file.file.as_mut().unwrap()) },
            cx,
        )
    }
    fn poll_shutdown(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        tokio::io::AsyncWrite::poll_shutdown(
            unsafe { self.map_unchecked_mut(|a| a.file.file.as_mut().unwrap()) },
            cx,
        )
    }
}

pub struct YamlUpdateHandle<T: serde::Serialize + for<'de> serde::Deserialize<'de>> {
    inner: T,
    handle: UpdateHandle<ForRead>,
    committed: bool,
}
impl<T> YamlUpdateHandle<T>
where
    T: serde::Serialize + for<'de> serde::Deserialize<'de>,
{
    pub async fn new(path: PersistencePath) -> Result<Self, Error> {
        let mut handle = path.for_update().await?;
        let inner = from_yaml_async_reader(&mut handle).await?;
        Ok(YamlUpdateHandle {
            inner,
            handle,
            committed: false,
        })
    }

    pub async fn commit(mut self) -> Result<(), Error> {
        let mut file = self.handle.into_writer().await?;
        to_yaml_async_writer(&mut file, &self.inner).await?;
        file.commit().await?;
        self.committed = true;
        Ok(())
    }
}

impl<T> YamlUpdateHandle<T>
where
    T: serde::Serialize + for<'de> serde::Deserialize<'de> + Default,
{
    pub async fn new_or_default(path: PersistencePath) -> Result<Self, Error> {
        if !path.path().exists() {
            Ok(YamlUpdateHandle {
                inner: Default::default(),
                handle: path.for_update().await?,
                committed: false,
            })
        } else {
            Self::new(path).await
        }
    }
}

impl<T> std::ops::Deref for YamlUpdateHandle<T>
where
    T: serde::Serialize + for<'de> serde::Deserialize<'de> + Default,
{
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}
impl<T> std::ops::DerefMut for YamlUpdateHandle<T>
where
    T: serde::Serialize + for<'de> serde::Deserialize<'de> + Default,
{
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.inner
    }
}

#[derive(Clone, Copy, Debug)]
pub enum Never {}
impl Never {}
impl Never {
    pub fn absurd<T>(self) -> T {
        match self {}
    }
}
impl std::fmt::Display for Never {
    fn fmt(&self, _f: &mut std::fmt::Formatter) -> std::fmt::Result {
        self.absurd()
    }
}
impl std::error::Error for Never {}

#[derive(Clone, Debug)]
pub struct AsyncCompat<T>(pub T);
impl<T> futures::io::AsyncRead for AsyncCompat<T>
where
    T: tokio::io::AsyncRead,
{
    fn poll_read(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &mut [u8],
    ) -> std::task::Poll<std::io::Result<usize>> {
        let mut read_buf = ReadBuf::new(buf);
        tokio::io::AsyncRead::poll_read(
            unsafe { self.map_unchecked_mut(|a| &mut a.0) },
            cx,
            &mut read_buf,
        )
        .map(|res| res.map(|_| read_buf.filled().len()))
    }
}
impl<T> tokio::io::AsyncRead for AsyncCompat<T>
where
    T: futures::io::AsyncRead,
{
    fn poll_read(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &mut ReadBuf,
    ) -> std::task::Poll<std::io::Result<()>> {
        futures::io::AsyncRead::poll_read(
            unsafe { self.map_unchecked_mut(|a| &mut a.0) },
            cx,
            buf.initialize_unfilled(),
        )
        .map(|res| res.map(|len| buf.set_filled(len)))
    }
}
impl<T> futures::io::AsyncWrite for AsyncCompat<T>
where
    T: tokio::io::AsyncWrite,
{
    fn poll_write(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &[u8],
    ) -> std::task::Poll<std::io::Result<usize>> {
        tokio::io::AsyncWrite::poll_write(unsafe { self.map_unchecked_mut(|a| &mut a.0) }, cx, buf)
    }
    fn poll_flush(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        tokio::io::AsyncWrite::poll_flush(unsafe { self.map_unchecked_mut(|a| &mut a.0) }, cx)
    }
    fn poll_close(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        tokio::io::AsyncWrite::poll_shutdown(unsafe { self.map_unchecked_mut(|a| &mut a.0) }, cx)
    }
}
impl<T> tokio::io::AsyncWrite for AsyncCompat<T>
where
    T: futures::io::AsyncWrite,
{
    fn poll_write(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &[u8],
    ) -> std::task::Poll<std::io::Result<usize>> {
        futures::io::AsyncWrite::poll_write(
            unsafe { self.map_unchecked_mut(|a| &mut a.0) },
            cx,
            buf,
        )
    }
    fn poll_flush(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        futures::io::AsyncWrite::poll_flush(unsafe { self.map_unchecked_mut(|a| &mut a.0) }, cx)
    }
    fn poll_shutdown(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        futures::io::AsyncWrite::poll_close(unsafe { self.map_unchecked_mut(|a| &mut a.0) }, cx)
    }
}

pub async fn lock_file(filename: String, for_write: bool) -> std::io::Result<FileLock> {
    tokio::task::spawn_blocking(move || FileLock::lock(&filename, true, for_write)).await?
}

pub async fn unlock(lock: FileLock) -> std::io::Result<()> {
    tokio::task::spawn_blocking(move || lock.unlock()).await?
}

pub async fn from_yaml_async_reader<T, R>(mut reader: R) -> Result<T, crate::Error>
where
    T: for<'de> serde::Deserialize<'de>,
    R: AsyncRead + Unpin,
{
    let mut buffer = Vec::new();
    reader.read_to_end(&mut buffer).await?;
    serde_yaml::from_slice(&buffer)
        .map_err(anyhow::Error::from)
        .with_kind(crate::ErrorKind::Deserialization)
}

pub async fn to_yaml_async_writer<T, W>(mut writer: W, value: &T) -> Result<(), crate::Error>
where
    T: serde::Serialize,
    W: AsyncWrite + Unpin,
{
    let mut buffer = serde_yaml::to_vec(value).with_kind(crate::ErrorKind::Serialization)?;
    buffer.extend_from_slice(b"\n");
    writer.write_all(&buffer).await?;
    Ok(())
}

pub async fn from_cbor_async_reader<T, R>(mut reader: R) -> Result<T, crate::Error>
where
    T: for<'de> serde::Deserialize<'de>,
    R: AsyncRead + Unpin,
{
    let mut buffer = Vec::new();
    reader.read_to_end(&mut buffer).await?;
    serde_cbor::from_slice(&buffer)
        .map_err(anyhow::Error::from)
        .with_kind(crate::ErrorKind::Deserialization)
}

pub async fn from_json_async_reader<T, R>(mut reader: R) -> Result<T, crate::Error>
where
    T: for<'de> serde::Deserialize<'de>,
    R: AsyncRead + Unpin,
{
    let mut buffer = Vec::new();
    reader.read_to_end(&mut buffer).await?;
    serde_json::from_slice(&buffer)
        .map_err(anyhow::Error::from)
        .with_kind(crate::ErrorKind::Deserialization)
}

pub async fn to_json_async_writer<T, W>(mut writer: W, value: &T) -> Result<(), crate::Error>
where
    T: serde::Serialize,
    W: AsyncWrite + Unpin,
{
    let buffer = serde_json::to_string(value).with_kind(crate::ErrorKind::Serialization)?;
    writer.write_all(&buffer.as_bytes()).await?;
    Ok(())
}

pub async fn to_json_pretty_async_writer<T, W>(mut writer: W, value: &T) -> Result<(), crate::Error>
where
    T: serde::Serialize,
    W: AsyncWrite + Unpin,
{
    let mut buffer =
        serde_json::to_string_pretty(value).with_kind(crate::ErrorKind::Serialization)?;
    buffer.push_str("\n");
    writer.write_all(&buffer.as_bytes()).await?;
    Ok(())
}

#[async_trait::async_trait]
pub trait Invoke {
    async fn invoke(&mut self, error_kind: crate::ErrorKind) -> Result<Vec<u8>, Error>;
}
#[async_trait::async_trait]
impl Invoke for tokio::process::Command {
    async fn invoke(&mut self, error_kind: crate::ErrorKind) -> Result<Vec<u8>, Error> {
        self.stdout(Stdio::piped());
        self.stderr(Stdio::piped());
        let res = self.output().await?;
        crate::ensure_code!(
            res.status.success(),
            error_kind,
            "{}: {}",
            error_kind,
            std::str::from_utf8(&res.stderr).unwrap_or("Unknown Error")
        );
        Ok(res.stdout)
    }
}

pub trait Apply: Sized {
    fn apply<O, F: FnOnce(Self) -> O>(self, func: F) -> O {
        func(self)
    }
}

pub trait ApplyRef {
    fn apply_ref<O, F: FnOnce(&Self) -> O>(&self, func: F) -> O {
        func(&self)
    }

    fn apply_mut<O, F: FnOnce(&mut Self) -> O>(&mut self, func: F) -> O {
        func(self)
    }
}

impl<T> Apply for T {}
impl<T> ApplyRef for T {}

pub fn deserialize_from_str<
    'de,
    D: serde::de::Deserializer<'de>,
    T: FromStr<Err = E>,
    E: std::fmt::Display,
>(
    deserializer: D,
) -> std::result::Result<T, D::Error> {
    struct Visitor<T: FromStr<Err = E>, E>(std::marker::PhantomData<T>);
    impl<'de, T: FromStr<Err = Err>, Err: std::fmt::Display> serde::de::Visitor<'de>
        for Visitor<T, Err>
    {
        type Value = T;
        fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            write!(formatter, "a parsable string")
        }
        fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            v.parse().map_err(|e| serde::de::Error::custom(e))
        }
    }
    deserializer.deserialize_str(Visitor(std::marker::PhantomData))
}

pub fn deserialize_from_str_opt<
    'de,
    D: serde::de::Deserializer<'de>,
    T: FromStr<Err = E>,
    E: std::fmt::Display,
>(
    deserializer: D,
) -> std::result::Result<Option<T>, D::Error> {
    struct Visitor<T: FromStr<Err = E>, E>(std::marker::PhantomData<T>);
    impl<'de, T: FromStr<Err = Err>, Err: std::fmt::Display> serde::de::Visitor<'de>
        for Visitor<T, Err>
    {
        type Value = Option<T>;
        fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            write!(formatter, "a parsable string")
        }
        fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            v.parse().map(Some).map_err(|e| serde::de::Error::custom(e))
        }
        fn visit_some<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
        where
            D: serde::de::Deserializer<'de>,
        {
            deserializer.deserialize_str(Visitor(std::marker::PhantomData))
        }
        fn visit_none<E>(self) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(None)
        }
        fn visit_unit<E>(self) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(None)
        }
    }
    deserializer.deserialize_any(Visitor(std::marker::PhantomData))
}

pub async fn daemon<F: Fn() -> Fut, Fut: Future<Output = ()> + Send + 'static>(
    f: F,
    cooldown: std::time::Duration,
) -> Result<Never, anyhow::Error> {
    loop {
        match tokio::spawn(f()).await {
            Err(e) if e.is_panic() => return Err(anyhow::anyhow!("daemon panicked!")),
            _ => (),
        }
        tokio::time::sleep(cooldown).await
    }
}

pub trait SOption<T> {}
pub struct SSome<T>(T);
impl<T> SSome<T> {
    pub fn into(self) -> T {
        self.0
    }
}
impl<T> From<T> for SSome<T> {
    fn from(t: T) -> Self {
        SSome(t)
    }
}
impl<T> SOption<T> for SSome<T> {}
pub struct SNone<T>(PhantomData<T>);
impl<T> SNone<T> {
    pub fn new() -> Self {
        SNone(PhantomData)
    }
}
impl<T> SOption<T> for SNone<T> {}

#[derive(Debug, Serialize)]
pub enum ValuePrimative {
    Null,
    Boolean(bool), // TODO
    String(String),
    Number(serde_json::Number),
}
impl<'de> serde::de::Deserialize<'de> for ValuePrimative {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::de::Deserializer<'de>,
    {
        struct Visitor;
        impl<'de> serde::de::Visitor<'de> for Visitor {
            type Value = ValuePrimative;
            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                write!(formatter, "a JSON primative value")
            }
            fn visit_unit<E>(self) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(ValuePrimative::Null)
            }
            fn visit_none<E>(self) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(ValuePrimative::Null)
            }
            fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(ValuePrimative::String(v.to_owned()))
            }
            fn visit_string<E>(self, v: String) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(ValuePrimative::String(v))
            }
            fn visit_f32<E>(self, v: f32) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(ValuePrimative::Number(
                    serde_json::Number::from_f64(v as f64).ok_or_else(|| {
                        serde::de::Error::invalid_value(
                            serde::de::Unexpected::Float(v as f64),
                            &"a finite number",
                        )
                    })?,
                ))
            }
            fn visit_f64<E>(self, v: f64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(ValuePrimative::Number(
                    serde_json::Number::from_f64(v).ok_or_else(|| {
                        serde::de::Error::invalid_value(
                            serde::de::Unexpected::Float(v),
                            &"a finite number",
                        )
                    })?,
                ))
            }
            fn visit_u8<E>(self, v: u8) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(ValuePrimative::Number(v.into()))
            }
            fn visit_u16<E>(self, v: u16) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(ValuePrimative::Number(v.into()))
            }
            fn visit_u32<E>(self, v: u32) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(ValuePrimative::Number(v.into()))
            }
            fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(ValuePrimative::Number(v.into()))
            }
            fn visit_i8<E>(self, v: i8) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(ValuePrimative::Number(v.into()))
            }
            fn visit_i16<E>(self, v: i16) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(ValuePrimative::Number(v.into()))
            }
            fn visit_i32<E>(self, v: i32) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(ValuePrimative::Number(v.into()))
            }
            fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(ValuePrimative::Number(v.into()))
            }
        }
        deserializer.deserialize_any(Visitor)
    }
}

#[derive(Debug, Clone)]
pub struct Version {
    version: emver::Version,
    string: String,
}
impl Version {
    pub fn as_str(&self) -> &str {
        self.string.as_str()
    }
}
impl From<emver::Version> for Version {
    fn from(v: emver::Version) -> Self {
        Version {
            string: v.to_string(),
            version: v,
        }
    }
}
impl From<Version> for emver::Version {
    fn from(v: Version) -> Self {
        v.version
    }
}
impl Deref for Version {
    type Target = emver::Version;
    fn deref(&self) -> &Self::Target {
        &self.version
    }
}
impl AsRef<emver::Version> for Version {
    fn as_ref(&self) -> &emver::Version {
        &self.version
    }
}
impl AsRef<str> for Version {
    fn as_ref(&self) -> &str {
        self.as_str()
    }
}
impl PartialEq for Version {
    fn eq(&self, other: &Version) -> bool {
        self.version.eq(&other.version)
    }
}
impl Eq for Version {}
impl Hash for Version {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.version.hash(state)
    }
}
impl<'de> Deserialize<'de> for Version {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let string = String::deserialize(deserializer)?;
        let version = emver::Version::from_str(&string).map_err(serde::de::Error::custom)?;
        Ok(Self { string, version })
    }
}
impl Serialize for Version {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        self.string.serialize(serializer)
    }
}

#[async_trait]
pub trait AsyncFileExt: Sized {
    async fn maybe_open<P: AsRef<Path> + Send + Sync>(path: P) -> std::io::Result<Option<Self>>;
    async fn delete<P: AsRef<Path> + Send + Sync>(path: P) -> std::io::Result<()>;
}
#[async_trait]
impl AsyncFileExt for File {
    async fn maybe_open<P: AsRef<Path> + Send + Sync>(path: P) -> std::io::Result<Option<Self>> {
        match File::open(path).await {
            Ok(f) => Ok(Some(f)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e),
        }
    }
    async fn delete<P: AsRef<Path> + Send + Sync>(path: P) -> std::io::Result<()> {
        if let Ok(m) = tokio::fs::metadata(path.as_ref()).await {
            if m.is_dir() {
                tokio::fs::remove_dir_all(path).await
            } else {
                tokio::fs::remove_file(path).await
            }
        } else {
            Ok(())
        }
    }
}
