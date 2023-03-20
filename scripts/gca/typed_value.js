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
  set,
  isEmpty,
} = require(`lodash`)
const { Tree, name, CHARACTERS, Node } = require(`./tree`)
const { isTypePrimitive, isPrimitive, getArrayDepth, isNumeric } = require(`./utils`)

/**
 * HOW TO ASK FOR TYPE/VALUE?
 *    If by "type" you mean the type of a TypedValue, including options and context
 *        _type or isTrueType
 *        _value
 *
 *    If you mean the type ignoring contexts in the chain (like, for example, when you need to loop through components/options)
 *        type
 *        value
 *        isType
 *
 *    If you mean the "leaf type" of a TypedValue, ignoring options and contexts in the chain to return the first eligible type
 *        isDeepType
 *
 *      You can also check the "leaf type" into arrays, by specifing the argument searchInArray = true
 *      However, since options and arrays have multiple valus, the funcion only returns true when ALL values are of a type
 *
 *      To return all types present in a collection-type TypedValue (context, options, array, object), use
 *          getTypes
 *
 *        It can also returns for primitive values, but its basically the same as type or _type
 */

/**
 * @class
 * @public
 * @property {string[]} _type
 */
class TypedValue {
  static get PROTOCOLS() {
    return [`with`, `equal`, `to`, `respond`, `listAs`, `context`, `options`]
  }

  static get COMPLETE_PROTOCOL_PATTERNS() {
    const _context = /(<#([xργβκτsadm]?[\d.a-z\-]+)>)/g

    return [[`context`, _context]]
  }

  static get PROTOCOL_PATTERNS() {
    const _with = /( +with +(?=["<])|(?<=[">]) +with +)/gi
    const _equal = /( *(?<!=)=(?!=) *)/g
    const _to = /(?:[\d.+\-%\/]+|=\w+|[.\da-z]+>)( +to +)[\w:]+/g // 1st pipe to accomodade =nobase befo≀e to, 2nd to accomodate context before
    const _respond = /( +respond +(?=["<])|(?<=[">]) +respond +)/g
    const _listAs = /( +listAs +(?=["<])|(?<=[">]) +listAs +)/g
    const _context = /(<#([xργβκ]?[\d.a-z\-]+)>)/g

    return [
      // [`with`, _with],
      // [`equal`, _equal],
      // [`to`, _to],
      // [`respond`, _respond],
      // [`listAs`, _listAs],
      [`context`, _context],
    ]
  }

  constructor(type, value, source = {}, metadata = {}, _issues = [], _implicit = []) {
    /**
     * True type of a TypedValue
     *
     * @type {boolean}
     * @public
     */
    this._type = !isArray(type) ? [type] : type

    /**
     * True data of a TypedValue
     *
     * @type {any}
     * @public
     */
    this._value = value

    /**
     * List of implicit indexes inside a TypedValue
     *
     * @type {number}
     * @public
     */
    this._implicit = _implicit ?? []

    /**
     * Metadata for the generation of a TypedValue
     *
     * @type {{}}
     * @public
     */
    this._source = source

    /**
     * Issues related to the data of a TypedValue
     *
     * @type {{}}
     * @public
     */
    this._issues = _issues ?? []

    /**
     * Metadata for a TypedValue
     *
     * @type {{}}
     * @public
     */
    this._metadata = metadata ?? {}
  }

  // #region GETTERS/SETTERS

  /**
   * Returns TypedValue deep type, ignoring all contexts in the chain
   *
   * @returns {string[]} type
   */
  get type() {
    if (this.isContext(false)) return this._value.type
    return this._type
  }

  set type(type) {
    // ERROR: Cannot assign type to a alreadu typed
    if (this._type !== undefined) debugger

    if (type[0] === `object` && !isObjectLike(this._value)) this._value = {}
    else if (type[0] === `array` && !isArray(this._value)) this._value = []

    this._type = type
  }

  get leaf() {
    if (this.isContext(false)) return this._value.leaf
    return this
  }

  /**
   * Returns TypedValue deep value, ignoring all contexts in the chain
   *
   * @returns {any} value
   */
  get value() {
    if (this.isContext(false)) return this._value.value
    return this._value
  }

  set value(value) {
    this._value = value
  }

  get implicitness() {
    return this._implicit.filter(v => v !== undefined).length
  }

  get implicitnessDeep() {
    let implicitness = this.implicitness

    return implicitness
  }

  static source(text, from, start, end, context) {
    const obj = {}

    if (text !== undefined) obj.text = text
    if (from !== undefined) obj.from = from
    if (start !== undefined) obj.start = start
    if (end !== undefined) obj.end = end
    if (context !== undefined) obj.context = context

    return obj
  }

  // #endregion

  // #region TYPINGS

  /**
   * Indicates if typed value is truly of a specified type, without passthroughs
   *
   * @param {string|string[]} type main type or full type
   * @returns {boolean}
   */
  isTrueType(type) {
    const _type = isArray(type) ? type : [type]

    if (_type[0] === `object`) return this._type[0] === `object`
    else if (_type[0] === `array` && _type[1] === `primitive`) return this._type[0] === `array` && isTypePrimitive(this._type[1])
    else if (_type[0] === `array` && _type[1] !== undefined) return this._type[0] === `array` && this._type[1] === _type[1]
    else if (_type[0] === `array`) return this._type[0] === `array`
    else if (_type[0] === `primitive`) return isTypePrimitive(this._type[0])
    else if ([`string`, `number`, `integer`, `float`, `boolean`].includes(_type[0])) return this._type[0] === _type[0]
    else if (TypedValue.PROTOCOLS.includes(_type[0])) return _type[0] === this._type[0]
  }

  /**
   * Indicates if typed value is of a specified type, ignoring context
   *
   * @param {string|string[]} type main type or full type
   * @returns {boolean}
   */
  isType(type) {
    const _type = isArray(type) ? type : [type]

    if (this._type[0] === `context` && !this._metadata.shallow) return this._value.isType(type)

    if (_type[0] === `object`) return this.type[0] === `object`
    else if (_type[0] === `array` && _type[1] === `primitive`) return this.type[0] === `array` && isTypePrimitive(this.type[1])
    else if (_type[0] === `array` && _type[1] !== undefined) return this.type[0] === `array` && this.type[1] === _type[1]
    else if (_type[0] === `array`) return this.type[0] === `array`
    else if (_type[0] === `primitive`) return isTypePrimitive(this.type[0])
    else if ([`string`, `number`, `integer`, `float`, `boolean`].includes(_type[0])) return this.type[0] === _type[0]
    else if (TypedValue.PROTOCOLS.includes(_type[0])) return _type[0] === this._type[0]
  }

  /**
   * Indicates if typed value is of a specified type, ignoring options and contexts in the chain to return the first eligible type
   *
   * @param {string|string[]} type main type or full type
   * @param {boolean} searchInArray indicates if searching should look into arrays too
   * @returns {boolean}
   */
  isDeepType(type, searchInArray = false) {
    const _type = isArray(type) ? type : [type]

    if (this.isContext(false)) return _type[0] === `context` || this._value.isDeepType(_type, searchInArray)
    else if (this.isOptions()) return _type[0] === `options` || this._value.every(value => value.isDeepType(_type, searchInArray))
    else if (searchInArray && this.isTrueType(`array`)) return isEqual(_type, this._type) || this._value.every(value => value.isDeepType(_type, searchInArray))
    else return this.isTrueType(_type)
  }

  /**
   * List all types present in TypedValue offspring, at child level or deeper
   *
   * @param {boolean} deep
   * @returns {string[]}
   */
  getTypes(deep = false) {
    const types = []

    if (!deep) this.children((value, path) => types.push(value._type[0]))
    else {
      debugger

      this.traverse((value, path, parent) => {
        if (parent === null) return

        if (!types.includes(value._type[0])) types.push(value._type[0])
      })
    }

    return types
  }

  //    #region SINGLE TYPES
  isString() {
    return this.isType(`string`)
  }

  isPrimitive() {
    return this.isType(`primitive`)
  }

  isPrimitiveArray() {
    return this.isType([`array`, `primitive`])
  }

  isArray() {
    return this.isType(`array`)
  }

  isObject() {
    return this.isType(`object`)
  }

  isOptions() {
    return this.isTrueType(`options`)
  }

  isContext(shallow = undefined) {
    const is = this.isTrueType(`context`)
    if (shallow !== undefined) return is && !!this._metadata.shallow === shallow
    return is
  }

  // others

  isProtocol() {
    return TypedValue.PROTOCOLS.includes(this.type[0])
  }

  isCollection() {
    return this.isObject() || this.isArray || this.isContext() || this.isOptions()
  }

  isObjectLike() {
    return this.isObject()
  }

  isEnclosure() {
    // basically a group of information, like an array
    return this._type[0] === `options` || this._type[0] === `context`
  }
  // #endregion

  // #endregion

  // #region ITERATORS
  /**
   * Loop through all values inside a collection-type TypedValue
   *
   * @param {(value: TypedValue, path: string[], parent: TypedValue?) => {}} callback
   */
  traverse(callback) {
    TypedValue.traverse(this, callback, -1)
  }

  /**
   * Loop through all children of a TypedValue
   *
   * @param {(value: TypedValue, path: string[], parent: TypedValue?) => {}} callback
   */
  children(callback) {
    TypedValue.traverse(
      this,
      (value, path, parent) => {
        if (parent === null) return
        else return callback(value, path, parent)
      },
      1,
    )
  }

  /**
   * Loop through all values inside a collection-type TypedValue
   *
   * @param {TypedValue} object
   * @param {(value: TypedValue, path: string[], parent: TypedValue?) => {}} callback
   * @param {number} height how deep to go on offspring chain, 1 is children, 0 is self, -1 is all
   * @param {string[]} path
   * @param {TypedValue?} parent
   */
  static traverse(object, callback, height = 1, path = [], parent = null) {
    callback(object, path, parent)

    if (height === 0) return

    if (object.isTrueType(`primitive`)) {
      // keep going
    } else if (object.isTrueType(`object`)) {
      const keys = Object.keys(object._value)

      for (const key of keys) TypedValue.traverse(object._value[key], callback, height - 1, [...path, key], object)
    } else if (object.isTrueType(`array`) || object.isTrueType(`options`)) {
      // const middlePath = object.isTrueType(`options`) ? [`options`] : []
      const middlePath = []

      for (let i = 0; i < object._value.length; i++) {
        TypedValue.traverse(object._value[i], callback, height - 1, [...path, ...middlePath, i], object)
      }
    } else if (object.isTrueType(`context`)) {
      if (!object._metadata.shallow) TypedValue.traverse(object._value, callback, height - 1, [...path], object)
    } else debugger
  }

  // #endregion

  // #region PARSERS
  toString() {
    debugger
    let string = this._value.toString()

    if (this.isOptions()) string = JSON.stringify({ options: this._value.map(v => v.serialize()) })
    else if (this.isTrueType(`object`)) string = JSON.stringify(this._value.serialize())

    return `<${this._type.join(`/`)}> ${string}`
  }

  stringify() {
    if (this.isDeepType(`primitive`)) {
      if (this.isType(`options`)) return this.value.join(` | `)
      return this.value.toString()
    } else return JSON.stringify(this.serialize())
  }

  /**
   * Returns a serialized JSON object representing the TypedValue
   *
   * @returns {{}}
   */
  serialize() {
    let obj
    if (this.isContext()) return this._value.serialize()
    else if (this.isOptions()) obj = []
    else if (this.isPrimitive()) obj = this._value
    else if (this.isArray()) obj = []
    else if (this.isObject()) obj = {}
    else debugger

    this.children((value, path, parent) => {
      set(obj, path, value.serialize())
    })

    if (this.isOptions()) {
      const options = obj
      obj = {}
      obj.options = options
    }

    return obj
  }

  /**
   * Removes all contexts in chain
   *
   * @returns {TypedValue}
   */
  flatten() {
    if (this.isTrueType(`array`) || this.isTrueType(`options`)) {
      this._value = this._value.map(value => value.flatten())
    } else if (this.isTrueType(`object`)) {
      const keys = Object.keys(this._value)
      for (const key of keys) this._value[key] = this._value[key].flatten()
    } else if (this.isContext()) {
      if (this._metadata.shallow) this._type = [`string`]
      else {
        const value = this._value.flatten()
        value._source = { ...this._source, ...value._source, flattened: true }
        value._metadata = omit({ ...this._metadata, ...value._metadata }, [`shallow`])
        value._issues = [...this._issues, ...value._issues]

        return value
      }
    }

    // else if (this.isTrueType(`primitive`)) return this
    return this
  }

  /**
   * For Arrays<String, Context>, join them into a single string (effectively closing the enclosures around the contexts)
   *
   * @returns {TypedValue}
   */
  join() {
    if (this.isTrueType(`primitive`) || this.isTrueType([`array`, `primitive`])) return this
    else if (this.isOptions()) this._value = this._value.map(value => value.join())
    else if (this.isTrueType(`array`)) {
      const allArePrimitiveOrContext = this._value.every(v => v.isPrimitive() && !v.isType(`options`))

      if (allArePrimitiveOrContext) return this.string(this._value, { comma: `, `, pipe: ` | ` }[this._source.delimiter] ?? ``, { joined: true })
    } else if (this.isContext(false)) {
      return this._value.join()
    } else debugger

    return this
  }

  // #endregion

  // #region OPERATIONS
  /**
   *  Breaks a string TypedValue into N tokens, spliting by delimiter
   *
   * @param {string} delimiter
   * @returns {TypedValue}
   */
  split(delimiter) {
    // ERROR: Cannot split non string
    if (!this.isTrueType(`string`)) debugger

    const _pattern = { comma: / *, */g, pipe: / *\| */g }[delimiter]

    const _text = this.value
    const text = _text.replace(/ *N *\| *A */i, `N/A`) // fixing string

    const splits = _pattern !== undefined ? text.split(_pattern) : [text]

    // loop through tokens and turn them into string TypedValues
    //    register unbalance
    let result = []
    for (let i = 0, cursor = 0; i < splits.length; i++) {
      cursor += splits[i - 1]?.length ?? 0
      const substring = splits[i]
      const _source = { text: substring, from: text, start: cursor, end: substring.length - 1 }

      let token = new TypedValue(`string`, substring, _source)
      if (isEmpty(substring.trim())) token._metadata.emptyString = true
      else token._metadata.unbalanced = TypedValue.unbalance(substring)

      result.push(token)
    }

    // pack it and ship it
    if (result.length === 1) return result[0]

    let value = this.array(result, { from: _text, delimiter })
    if (delimiter === `pipe`) value._type = [`options`]

    value._source = { ...this._source, ...value._source }

    return value
  }

  /**
   * Breaks a string into N tokens, spliting by patterns
   *
   * @param {(string | RegExp)[][]} patterns
   * @returns {TypedValue}
   */
  tokenize(patterns) {
    // ERROR: Can only tokenize strings
    if (!this.isTrueType(`string`)) debugger

    if (this._metadata.emptyString) return this
    const text = this._value

    // MATCH ALL PATTERNS AND DEVELOP TOKENS
    // --------------------------------------------------------------------------------------
    const index = {}
    const allMatches = []
    for (let i = 0; i < patterns.length; i++) {
      const [name, _pattern] = patterns[i]

      const matches = [...text.matchAll(_pattern)].map(match => TypedValue.fromMatch(name, match, text))

      index[name] = matches
      allMatches.push(...matches)
    }

    const _markers = flatten(allMatches)
    const markers = orderBy(_markers, marker => marker._source.start)

    const summary = markers.map(marker => [marker._source.start, marker._source.end, marker._type])
    const noOverlaps = summary.reduce((last, marker) => (marker[1] > last ? marker[1] : Infinity), -1) !== Infinity

    // ERROR: No overlaping of keywords
    if (!noOverlaps) debugger
    // --------------------------------------------------------------------------------------

    // FROM PATTERN TOKENS, CREATE IN BETWEEN STRING TOKENS
    // --------------------------------------------------------------------------------------
    let array = []
    for (let i = 0; i < summary.length; i++) {
      const prevEnd = summary[i - 1]?.[1] ?? -1
      const [start, end, type] = summary[i]

      const marker = markers[i]

      if (!(prevEnd + 1 === start)) array.push(TypedValue.fromSubstring(text, prevEnd + 1, start - 1))
      array.push(marker)
    }

    const lastEnd = (summary[summary.length - 1]?.[1] ?? -1) + 1
    if (lastEnd < text.length) array.push(TypedValue.fromSubstring(text, lastEnd, text.length - 1))
    if (lastEnd === text.length && array.length === 0) array.push(markers[0])
    // --------------------------------------------------------------------------------------

    if (array.length === 1) return array[0]
    return this.array(array, { from: text, token: true })
  }

  /**
   *
   * @param {TypedValue} object
   * @param {string} delimiter
   * @returns {TypedValue}
   */
  static split(object, delimiter) {
    if (object.isTrueType(`string`)) return object.split(delimiter)
    else if (object.isTrueType(`array`) || object.isTrueType(`options`)) {
      object._value = object._value.map(value => TypedValue.split(value, delimiter))
      return object
    } else return object
  }

  /**
   * Breaks a string into N tokens, spliting by patterns
   *
   * @param {TypedValue} object
   * @param {(string | RegExp)[][]} patterns
   * @returns {TypedValue}
   */
  static tokenize(object, patterns) {
    if (object.isTrueType(`string`)) return object.tokenize(patterns)
    else if (object.isTrueType(`array`) || object.isTrueType(`options`)) {
      object._value = object._value.map(value => TypedValue.tokenize(value, patterns))

      const wasOptions = object.isTrueType(`options`)
      object = object.array(object._value)
      if (wasOptions) object._type = [`options`]
      return object
    } else return object
  }

  /**
   * Returns a math component for an array of values
   *
   * @param {string} a
   * @param object
   */
  static mathComponent(a, object) {
    let value = a.trim()
    if (isNumeric(value)) object.expression += `${parseFloat(value)}`
    else {
      const variable = name(Object.keys(object).length - 1).toUpperCase()
      object[variable] = value
      object.expression += `∂${variable}`
    }
  }

  /**
   *
   * @param {*} object
   * @param {*} parent
   * @returns {{math: boolean, expression: string, variables: {}}}
   */
  static math(object, parent) {
    if (!object._metadata.math) {
      if (object.isContext()) {
        if ([`quotes`].includes(object._metadata.node.type.character)) return TypedValue.math(object._value, object)
        else if ([`percentage`, `brackets`, `parenthesis`, `braces`].includes(object._metadata.node.type.character)) {
          const content = TypedValue.math(object._value, object)
          let stringContent = content

          if (content.math) return content
          else if (!isString(content)) debugger

          return `${object._metadata.node.opener}${stringContent}${object._metadata.node.closer}`
        } else debugger
      } else if (object.isOptions()) debugger
      else if (object.isPrimitive()) return object._value
      else if (object.isArray()) {
        const content = object._value.map(value => TypedValue.math(value, object))

        // WARNING: Not implemented
        if (content.some(v => !isString(v)) && content.length > 1) debugger

        let expression = ``
        const variables = {}

        for (let i = 0; i < content.length; i++) {
          const component = content[i]

          if (isString(component)) expression += component
          else if (component.math) {
            if (expression !== ``) debugger

            expression += `(${component.expression})`
            for (const key of Object.keys(component.variables ?? {})) {
              variables[key] = component.variables[key]
            }
          } else debugger
        }

        if (Object.keys(variables).length === 0) return expression

        return {
          math: true,
          expression,
          variables,
        }
      } else if (object.isObject()) debugger
    } else {
      const mathObject = { expression: `` }
      const TYPE = CHARACTERS[object._metadata.node.type.character]

      let _before = TypedValue.math(object.value[0], object)
      let _after = TypedValue.math(object.value[1], object)

      let before = _before.math ? _before.expression : _before
      let after = _after.math ? _after.expression : _after

      const ignoreOperator = after === `` || (before === `` && [`plus`, `product`].includes(object._metadata.node.type.character))

      // has a before OR cannot ignore identity
      if (_before.math) {
        before = before.replaceAll(/∂/g, `∂`)

        for (const key of Object.keys(_before.variables ?? {})) {
          const newKey = name(Object.keys(mathObject).length - 1).toUpperCase()

          mathObject[newKey] = _before.variables[key]
          after = after.replace(`∂∂${key}`, `∂${newKey}`)
        }

        mathObject.expression += before
      } else if (before !== `` || object._metadata.node.type.character === `division`) TypedValue.mathComponent(before === `` ? TYPE.identity : before, mathObject)

      if (!ignoreOperator) mathObject.expression += ` ${TYPE.middle} `

      if (_after.math) {
        after = after.replaceAll(/∂/g, `∂∂`)

        for (const key of Object.keys(_after.variables ?? {})) {
          const newKey = name(Object.keys(mathObject).length - 1).toUpperCase()

          mathObject[newKey] = _after.variables[key]
          after = after.replace(`∂∂${key}`, `∂${newKey}`)
        }

        mathObject.expression += after
      } else if (after !== ``) TypedValue.mathComponent(after === `` ? TYPE.identity.toString() : after, mathObject)

      return {
        math: true,
        expression: mathObject.expression,
        variables: omit(mathObject, `expression`),
      }
    }
  }

  static simplify(object) {
    if (object.isContext()) return { context: object._metadata.node.type.character, value: TypedValue.simplify(object._value) }
    else if (object.isOptions()) debugger
    else if (object.isPrimitive()) return object._value
    else if (object.isArray()) return object._value.map(value => TypedValue.simplify(value))
    else if (object.isObject()) debugger
    else debugger
  }

  // #endregion

  // #region FACTORY
  /**
   * Returns a complete deep clone of TypedValue
   *
   * @returns {TypedValue}
   */
  clone() {
    return new TypedValue(cloneDeep(this._type), cloneDeep(this._value), cloneDeep(this._source), cloneDeep(this._metadata), cloneDeep(this._issues), cloneDeep(this._implicit))
  }

  /**
   * Creates a new TypedValue, using current one as a default for metas
   *
   * @param {string|string[]} type
   * @param {any} value
   * @param {{}} _source
   * @param {{}} _metadata
   * @param {{}} _issues
   * @param {{}} _implicit
   * @returns {TypedValue} String-typed TypedValue
   */
  make(type, value, _source = {}, _metadata = {}, _issues = []) {
    return new TypedValue(
      type,
      value, //
      { ...this._source, ..._source },
      { ...this._metadata, ..._metadata },
      [...this._issues, ..._issues],
    )
  }

  /**
   *
   * @param {string|string[]|TypedValue|TypedValue[]} values
   * @param {string} join
   * @param {{}} _source
   * @param {{}} _metadata
   * @returns {TypedValue} String-typed TypedValue
   */
  string(values, join = `,`, _source = {}, _metadata = {}) {
    return TypedValue.string(values, join, { ...this._source, ..._source }, { ...this._metadata, ..._metadata }, this._issues, this._implicit)
  }
  /**
   *
   * @param {string|string[]|TypedValue|TypedValue[]} values
   * @param {{}} _source
   * @param {{}} _metadata
   * @returns {TypedValue} Array-typed TypedValue
   */
  array(values, _source = {}, _metadata = {}) {
    return TypedValue.array(values, { ...this._source, ..._source }, { ...this._metadata, ..._metadata }, this._issues, this._implicit)
  }

  /**
   *
   * @param {TypedValue[]} before
   * @param {TypedValue[]} after
   * @param {string} operation
   * @returns {TypedValue} Context-typed math TypedValue
   */
  math(before, after, operation) {
    const TYPE = CHARACTERS[operation]

    const node = this._source.context ?? this._metadata.node ?? new Node(null, 0, { type: `string ` })
    const stub = new Node(node, node.start, { type: TYPE.type, character: operation })
    stub.end = node.end

    const value = this.array([this.array(before), this.array(after)])
    const mathContext = new TypedValue(`context`, value, this._source, { ...this._metadata, math: true, node: stub }, this._issues, this._implicit)

    return mathContext
  }

  /**
   *
   * @param {string|string[]|TypedValue|TypedValue[]} values
   * @param {string} join
   * @param {{}} _source
   * @param {{}} _metadata
   * @param {{}} _issues
   * @param {{}} _implicit
   * @returns {TypedValue} String-typed TypedValue
   */
  static string(values, join = ``, _source = {}, _metadata = {}, _issues = [], _implicit = []) {
    let _values = isArray(values) ? values : [values]

    const data = new TypedValue(`string`, ``, { ..._source, merged: true }, _metadata, _issues, _implicit)

    data._value = _values
      .map(token => {
        // only return in here STRING

        if (isString(token)) return token
        else if (token instanceof TypedValue) {
          if (token.isContext()) {
            /** @type {Node} */
            const node = token._metadata.node

            // if (token._metadata.node.type.character === `brackets`) debugger
            // if (token.isDeepType(`options`)) debugger

            let value = token.isArray() || token.isDeepType(`options`) ? token.value : [token.value] // the first values at the end of a context chain

            // if (token.leaf._source.delimiter && token._metadata.node.character !== `brackets`) debugger
            const newValue = token.string(value, { comma: `, `, pipe: ` | ` }[token.leaf._source.delimiter] ?? ``)

            if (_values.length > 1) return `${node.opener}${newValue._value}${node.closer}`
            return newValue.value
          } else if (token.isTrueType(`array`) || token.isTrueType(`options`)) {
            return token.string(token._value, { comma: `, `, pipe: ` | ` }[token.leaf._source.delimiter] ?? ``)._value
          } else if (token.isTrueType(`primitive`)) return token._value
          else debugger
        }
        // ERROR: Cannot deal with anyother shit than string or TypedValue
        else debugger
      })
      .join(join)

    return data
  }

  /**
   *
   * @param {TypedValue[]} values
   * @param {{}} _source
   * @param {{}} _metadata
   * @param {{}} _issues
   * @param {{}} _implicit
   * @returns {TypedValue} Array-typed TypedValue
   */
  static array(values, _source = {}, _metadata = {}, _issues = [], _implicit = []) {
    const type = [`array`]

    let secondary = uniq(flatten(values.map(value => (!value.isContext(false) ? value._type[0] : value.getTypes()))))
    secondary = flatten(secondary)
    secondary = uniq(secondary)

    if (secondary.length === 1 && secondary[0] !== `options` && secondary[0] !== `context`) type.push(secondary[0])

    return new TypedValue(type, values, _source, _metadata, _issues, _implicit)
  }

  static fromMatch(type, match, text, _source = {}) {
    // ERROR: There must be a group 1 captured in regex
    if (!match[1]) debugger

    const start = match.index + match[0].indexOf(match[1])

    // ERROR: NaN
    if (isNaN(start)) debugger

    // ERROR: ''
    if (match[2] === ``) debugger

    const value = new TypedValue(type, match[2], { text: match[0], from: text, start, end: start + match[1].length - 1, match, ..._source })

    if (type === `context`) value._metadata.shallow = true

    return value
  }

  static fromSubstring(text, start, end, _source = {}) {
    const content = text.substring(start, end + 1)

    return new TypedValue(`string`, content, { text: content, from: text, start, end, ..._source })
  }

  // #endregion

  // #region ISSUES
  addIssue(issue, from) {
    const _issue = { issue, from }
    this._issues.push(_issue)
  }

  deepIssues() {
    return TypedValue.deepIssues(this)
  }

  static deepIssues(object, path = [], depth = 0) {
    const list = []

    if (object._issues.length > 0) list.push([path, object._issues])

    object.children((child, innerPath) => {
      list.push(...TypedValue.deepIssues(child, [...path, ...innerPath], depth + 1))
    })

    return list
  }
  // #endregion

  static unbalance(text) {
    const key = text.trim()
    const tree = new Tree(key)
    tree.parse()

    return tree.root.unbalanced
  }

  /**
   * Prints TypedValue data tree
   *
   * @param depth
   */
  print(depth = 0) {
    TypedValue.print(this, [], depth)
  }

  /**
   * Prints TypedValue data tree
   *
   * @param {TypedValue} value
   * @param {string[]} path
   * @param {number} depth
   */
  static print(value, path = [], depth = 0) {
    const ident = range(0, depth)
      .map(() => `  `)
      .join(``)

    if (value.isTrueType(`primitive`) || value.isContext(true)) console.log(ident, `[${path.join(`.`)}]  ${value._type.join(`/`)}   `, value._value)
    else console.log(ident, `[${path.join(`.`)}]  ${value._type.join(`/`)}   `, value._source.text ?? value._source.from)

    if (value.isTrueType(`primitive`)) {
      // no children
    } else if (value.isContext(false)) {
      if (!isPrimitive(value._value)) TypedValue.print(value._value, [...path, `context`], depth + 1)
    } else if (value.isTrueType(`array`) || value.isTrueType(`options`)) {
      let middlePath = value.isTrueType(`options`) ? [`options`] : []

      for (let i = 0; i < value._value.length; i++) {
        const child = value._value[i]

        TypedValue.print(child, [...path, ...middlePath, i], depth + 1)
      }
    } else if (value.isTrueType(`object`)) {
      for (const key of Object.keys(value._value)) {
        const child = value._value[key]

        TypedValue.print(child, [...path, key], depth + 1)
      }
    } else debugger

    //
    if (depth === 1) console.log(` `)
  }
}

module.exports = TypedValue
