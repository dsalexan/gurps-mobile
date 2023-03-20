import { get, isArray, isEmpty, isFunction, isNil, isObjectLike, type List, type GetFieldType } from "lodash"

export type PrimitiveType = `string` | `integer` | `float` | `boolean` | `symbol` | `object` | `array`
export type ArrayType<T extends PrimitiveType> = `array<${T}>`

/**
 *
 * @param value
 */
export function isNilOrEmpty(value: any): value is `` | null | undefined {
  if (typeof value === `number`) return false
  return isNil(value) || isEmpty(value)
}

/**
 *
 * @param str
 */
export function isNumeric(str: any): str is string {
  if (typeof str !== `string`) return false // we only process strings!
  return (
    // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    !isNaN(parseFloat(str))
  ) // ...and ensure strings of whitespace fail
}

/**
 *
 * @param value
 */
export function getArrayDepth(value: List<any>): number {
  return isArray(value) ? 1 + Math.max(0, ...value.map(getArrayDepth)) : 0
}

/**
 *
 * @param variable
 */
export function getType(variable: unknown): PrimitiveType | ArrayType<PrimitiveType> {
  let _typeOf = typeof variable
  if (_typeOf === `string` && isNumeric(variable)) _typeOf = `number`

  if (_typeOf === `object`) {
    if (isArray(variable)) {
      if (variable.length === 0) return `array`

      const contentTypes = variable.map(getType)
      const uniqueContentTypes = [...new Set(contentTypes)]

      // @ts-ignore
      return `array<${uniqueContentTypes.join(`, `)}>`
    }
    return `object`
  } else if (_typeOf === `number`) {
    if (Number.isInteger(parseFloat(variable as string))) return `integer`
    return `float`
  }

  // @ts-ignore
  return _typeOf
}

/**
 *
 * @param value
 */
export function isPrimitive(value: unknown): value is `string` | `number` | `boolean` | `symbol` {
  return isTypePrimitive(getType(value))
}

/**
 *
 * @param type
 */
export function isTypePrimitive(type: string) {
  return [`string`, `integer`, `float`, `boolean`, `symbol`].includes(type)
}

/**
 *
 * @param source
 * @param _key
 * @param defaultValue
 */
export function xget<TObject, TPath extends string, TValue = GetFieldType<TObject, TPath>>(
  source: TObject,
  _key: TPath | ((source: TObject, defaultValue: TValue | undefined) => TPath),
  defaultValue: TValue | undefined,
) {
  let key = _key

  if (!isObjectLike(source) || isNil(_key) || isEmpty(_key)) return source
  if (isFunction(_key)) key = _key(source, defaultValue)

  if (isFunction(key)) throw new Error(`In-depth xget recursion not implemented`)

  return get(source, key, defaultValue) as TValue | undefined
}

/**
 * Pushes to an array inside a object. If said array is undefined, instantiate it.
 *
 * @param object
 * @param key
 * @param {...any} values
 */
export function push<T extends object>(object: T, key: string | number, ...values: unknown[]) {
  if (object[key] === undefined) object[key] = []
  if (!isArray(object[key])) object[key] = [object[key]]
  object[key].push(...values)
}
