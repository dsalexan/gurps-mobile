const {
  isNil,
  isObjectLike,
  isArray,
  get,
  flatten,
  groupBy,
  isString,
  isNumber,
  isBoolean,
  flattenDeep,
  orderBy,
  zip,
  range,
  has,
  cloneDeep,
  max,
  min,
  toPath,
  isEqual,
  omit,
  uniq,
  uniqBy,
  uniqWith,
} = require(`lodash`)

/**
 *
 * @param str
 */
function isNumeric(str) {
  if (typeof str != `string`) return false // we only process strings!
  return (
    !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    !isNaN(parseFloat(str))
  ) // ...and ensure strings of whitespace fail
}

/**
 *
 * @param value
 */
function getArrayDepth(value) {
  return Array.isArray(value) ? 1 + Math.max(0, ...value.map(getArrayDepth)) : 0
}

/**
 *
 * @param variable
 */
function getType(variable) {
  let _typeOf = typeof variable
  if (_typeOf === `string` && isNumeric(variable)) _typeOf = `number`

  if (_typeOf === `object`) {
    if (isArray(variable)) {
      if (variable.length === 0) return `array`

      const contentTypes = variable.map(getType)
      const uniqueContentTypes = [...new Set(contentTypes)]

      return `array<${uniqueContentTypes.join(`, `)}>`
    }
    return `object`
  } else if (_typeOf === `number`) {
    if (Number.isInteger(parseFloat(variable))) return `integer`
    return `float`
  }

  return _typeOf
}

/**
 *
 * @param value
 */
function isPrimitive(value) {
  return isTypePrimitive(getType(value))
}

/**
 *
 * @param value
 * @param type
 */
function isTypePrimitive(type) {
  return [`string`, `integer`, `float`, `boolean`, `symbol`].includes(type)
}

/**
 *
 * @param string
 */
function isMath(string) {
  const hasVariablesOrFunctions = !!string.match(/[%@]\w+/)
  const hasMathSigns = !!string.match(/((\d|[@%]\w+) *[+-/*]|[+-/*] *(\d|[@%]\w+))/)
  const hasNumbers = !!string.match(/\d/)

  return [hasVariablesOrFunctions, hasMathSigns, hasNumbers].filter(b => b).length >= 2
}

module.exports.getArrayDepth = getArrayDepth
module.exports.getType = getType
module.exports.isPrimitive = isPrimitive
module.exports.isTypePrimitive = isTypePrimitive
module.exports.isMath = isMath
module.exports.isNumeric = isNumeric
