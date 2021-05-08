import * as Ajv from 'ajv'
import { JsonPointer } from 'jsonpointerx'

const ajv = new Ajv({ jsonPointers: true, allErrors: true, nullable: true })
const ajvWithDefaults = new Ajv({ jsonPointers: true, allErrors: true, useDefaults: true, nullable: true, removeAdditional: 'failing' })
const schemaV2 = {
  'anyOf': [
    {
      'type': 'object',
      'properties': {
        'type': { 'type': 'string', 'const': 'string' },
        'value': { 'type': 'string' },
        'description': { 'type': 'string', 'nullable': true, 'default': null },
        'copyable': { 'type': 'boolean', 'default': false },
        'qr': { 'type': 'boolean', 'default': false },
        'masked': { 'type': 'boolean', 'default': false },
      },
      'required': ['type', 'value', 'description', 'copyable', 'qr', 'masked'],
      'additionalProperties': false,
    },
    {
      'type': 'object',
      'properties': {
        'type': { 'type': 'string', 'const': 'object' },
        'value': {
          'type': 'object',
          'patternProperties': {
            '^.*$': {
              '$ref': '#',
            },
          },
        },
        'description': { 'type': 'string', 'nullable': true, 'default': null },

      },
      'required': ['type', 'value', 'description'],
      'additionalProperties': false,
    },
  ],
}
const schemaV2Compiled = ajv.compile(schemaV2)
const schemaV2CompiledWithDefaults = ajvWithDefaults.compile(schemaV2)

export function parsePropertiesPermissive (properties: any, errorCallback: (err: Error) => any = console.warn): AppProperties {
  if (typeof properties !== 'object' || properties === null) {
    errorCallback(new TypeError(`${properties} is not an object`))
    return { }
  }
  if (typeof properties.version !== 'number' || !properties.data) {
    return Object.entries(properties)
      .filter(([_, value]) => {
        if (typeof value === 'string') {
          return true
        } else {
          errorCallback(new TypeError(`${value} is not a string`))
          return false
        }
      })
      .map(([name, value]) => ({
        name,
        value: {
          value: String(value),
          description: null,
          copyable: false,
          qr: false,
          masked: false,
        },
      }))
      .reduce((acc, { name, value }) => {
        acc[name] = value
        return acc
      }, { })
  }
  const typedProperties = properties as AppPropertiesVersioned<number>
  switch (typedProperties.version) {
    case 2:
      return parsePropertiesV2Permissive(typedProperties.data, errorCallback)
    default:
      errorCallback(new Error(`unknown properties version ${properties.version}, attempting to parse as v2`))
      return parsePropertiesV2Permissive(typedProperties.data, errorCallback)
  }
}

function parsePropertiesV2Permissive (properties: AppPropertiesV2, errorCallback: (err: Error) => any): AppProperties {
  return Object.entries(properties).reduce((prev, [name, value], idx) => {
    schemaV2Compiled(value)
    if (schemaV2Compiled.errors) {
      for (let err of schemaV2Compiled.errors) {
        errorCallback(new Error(`/data/${idx}${err.dataPath}: ${err.message}`))
        if (err.dataPath) {
          JsonPointer.set(value, err.dataPath, undefined)
        }
      }
      if (!schemaV2CompiledWithDefaults(value)) {
        for (let err of schemaV2CompiledWithDefaults.errors) {
          errorCallback(new Error(`/data/${idx}${err.dataPath}: ${err.message}`))
        }
        return prev
      }
    }
    prev[name] = value
    return prev
  }, { })
}

export type AppProperties = AppPropertiesV2 // change this type when updating versions

export type AppPropertiesVersioned<T extends number> = {
  version: T,
  data: AppPropertiesVersionedData<T>
}

export type AppPropertiesVersionedData<T extends number> = T extends 1 ? never :
  T extends 2 ? AppPropertiesV2 :
  never

interface AppPropertiesV2 {
  [name: string]: AppPropertyString | AppPropertyObject
}

interface AppPropertyBase {
  type: 'string' | 'object'
  description: string | null
}

interface AppPropertyString extends AppPropertyBase {
  type: 'string'
  value: string
  copyable: boolean
  qr: boolean
  masked: boolean
}

interface AppPropertyObject extends AppPropertyBase {
  type: 'object'
  value: AppPropertiesV2
}