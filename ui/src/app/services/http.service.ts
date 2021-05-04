import { Injectable } from '@angular/core'
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http'
import { Observable, from, interval, race, Subject } from 'rxjs'
import { map, take } from 'rxjs/operators'
import { ConfigService } from './config.service'
import { Revision } from 'patch-db-client'

@Injectable({
  providedIn: 'root',
})
export class HttpService {
  private unauthorizedApiResponse$ = new Subject()
  authReqEnabled: boolean = false

  constructor (
    private readonly http: HttpClient,
    private readonly config: ConfigService,
  ) { }

  watch401$ (): Observable<{ }> {
    return this.unauthorizedApiResponse$.asObservable()
  }

  async restRequest<T> (options: HttpOptions, version = this.config.api.version, authReq = true): Promise<T> {
    if (authReq) {
      if (!this.authReqEnabled) throw new Error('Unauthenticated')
      options.withCredentials = true
    }

    options.url = handleSlashes(`${this.config.api.url}${version}${options.url}`)
    if (this.config.api.root && this.config.api.root !== '' ) {
      options.url = `${this.config.api.root}${options.url}`
    }
    return this.httpRequest<T>(options)
  }

  async rpcRequest<T> (options: RPCOptions): Promise<T> {
    options.params = options.params || { }
    const httpOpts = {
      method: Method.POST,
      url: this.config.api.url,
      data: options,
    }

    const res = await this.httpRequest<RPCResponse<T>>(httpOpts)

    if (isRpcError(res)) throw new RpcError(res.error)

    if (isRpcSuccess(res)) return res.result
  }

  private async httpRequest<T> (httpOpts: HttpOptions): Promise<T> {
    const { url, body, timeout, ...rest} = translateOptions(httpOpts)
    let req: Observable<{ body: T }>
    switch (httpOpts.method){
      case Method.GET:    req = this.http.get(url, rest) as any;          break
      case Method.POST:   req = this.http.post(url, body, rest) as any;   break
      case Method.PUT:    req = this.http.put(url, body, rest) as any;    break
      case Method.PATCH:  req = this.http.patch(url, body, rest) as any;  break
      case Method.DELETE: req = this.http.delete(url, rest) as any;       break
    }

    return (timeout ? withTimeout(req, timeout) : req)
      .toPromise()
      .then(res => res.body)
      .catch(e => { throw new HttpError(e) })
  }
}

export function isUnauthorized (e: HttpErrorResponse): boolean {
  return e.status == 401
}

function handleSlashes (url: string): string {
  let toReturn = url
  toReturn = toReturn.startsWith('/') ? toReturn : '/' + toReturn
  toReturn = !toReturn.endsWith('/')  ? toReturn : toReturn.slice(0, -1)
  return toReturn
}

function RpcError (e: RPCError['error']): void {
  const { code, message, data } = e
  this.status = code
  this.message = message
  this.data = { ...data, code }
}

function HttpError (e: HttpErrorResponse): void {
  const { status, statusText, error } = e
  this.status = status
  this.message = statusText
  this.data = error || { } // error = { code: string, message: string }
}

function isRpcError<Error, Result> (arg: { error: Error } | { result: Result}): arg is { error: Error } {
  return !!(arg as any).error
}

function isRpcSuccess<Error, Result> (arg: { error: Error } | { result: Result}): arg is { result: Result } {
  return !!(arg as any).result
}

export interface RequestError {
  status: number
  message: string
  data: { code: string, message: string, revision: Revision | null }
}

export enum Method {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}

export interface RPCOptions {
  method: string
  // @TODO what are valid params? object, bool?
  params?: {
    [param: string]: string | number | boolean | object | string[] | number[];
  }
}

interface RPCBase {
  jsonrpc: '2.0'
  id: string
}

export interface RPCRequest<T> extends RPCBase {
  method: string
  params?: T
}

export interface RPCSuccess<T> extends RPCBase {
  result: T
}

export interface RPCError extends RPCBase {
  error: {
    code: number,
    message: string
    data: {
      message: string
      revision: Revision
    }
  }
}

export type RPCResponse<T> = RPCSuccess<T> | RPCError

type HttpError = HttpErrorResponse & { error: { code: string, message: string } }

export interface HttpOptions {
  withCredentials?: boolean
  url: string
  method: Method
  params?: {
    [param: string]: string | string[]
  }
  data?: any
  headers?: {
    [key: string]: string;
  }
  readTimeout?: number
}

export interface HttpJsonOptions {
  headers?: HttpHeaders | {
      [header: string]: string | string[]
  }
  observe: 'events'
  params?: HttpParams | {
      [param: string]: string | string[]
  }
  reportProgress?: boolean
  responseType?: 'json'
  withCredentials?: boolean
  body?: any
  url: string
  timeout: number
}

function translateOptions (httpOpts: HttpOptions): HttpJsonOptions {
  return {
    observe: 'events',
    responseType: 'json',
    reportProgress: false,
    withCredentials: true,
    headers: httpOpts.headers,
    params: httpOpts.params,
    body: httpOpts.data || { },
    url: httpOpts.url,
    timeout: httpOpts.readTimeout,
  }
}

function withTimeout<U> (req: Observable<U>, timeout: number): Observable<U> {
  return race(
    from(req.toPromise()), // this guarantees it only emits on completion, intermediary emissions are suppressed.
    interval(timeout).pipe(take(1), map(() => { throw new Error('timeout') })),
  )
}
