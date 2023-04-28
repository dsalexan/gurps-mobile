/* eslint-disable no-debugger */
const path = require(`path`)
const fs = require(`fs`)
const _ = require(`lodash`)
const math = require(`mathjs`)
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
  isEmpty,
  chunk,
  reverse,
  intersection,
  sortBy,
  isSafeInteger,
} = require(`lodash`)
const Fuse = require(`fuse.js`)
const stringSimilarity = require(`string-similarity`)
const { TAG_TO_TYPES, IGNORE_IMPLICIT_FOR_SECTIONS } = require(`./gdf_utils`)

const { Tree, Node } = require(`./tree`)
const TypedValue = require(`./typed_value`)
const { TAG_DIRECTIVES, TAG_TYPES, EXTENDED_TYPES } = require(`./tags`)
const { isPrimitive, isNumeric, isTypePrimitive } = require(`./utils`)
const { dynamicValue } = require(`./dynamic`)

/**
 *
 * @param arrayOfStrings
 * @param pattern
 */
function deepMatch(arrayOfStrings, pattern) {
  if (isNil(arrayOfStrings)) return null
  else if (isArray(arrayOfStrings)) {
    const matches = []

    for (const string of arrayOfStrings) {
      const match = deepMatch(string, pattern)
      if (match) matches.push(match)
    }

    if (matches.length === 0) return null
    return matches
  } else if (isString(arrayOfStrings)) {
    return arrayOfStrings.match(pattern)
  } else debugger
}

function deepSearch(data, search, callback, _path = []) {
  let found = false

  const keys = Object.keys(data)
  for (const key of keys) {
    const path = [..._path, key]
    const value = data[key]

    if (isObjectLike(value)) {
      found = found || deepSearch(value, search, callback, path)
    } else if (isArray(value)) {
      const _searchs = value.map((v, index) => deepSearch(v, search, callback, [...path, index]))
      found = found || _searchs.some(s => !!s)
    } else if (search(value, path)) {
      callback(value, path, data)
      found = true
    }
  }

  return found
}

function deepDyamicCheckNode(node) {
  if (node.type.type === `enclosure`) {
    if ([`brackets`].includes(node.type.character)) {
      // ERROR: Untested
      if (node.children.length != 1) debugger

      const child = node.children[0]
      const type = child.type.type

      if (isTypePrimitive(type)) return [true]

      // ERROR: Unimplemented
      debugger
    } else {
      if (node.children.length > 3) return [false]
      const childrenPaths = []
      for (let i = 0; i < node.children.length; i++) {
        const item = node.children[i]

        childrenPaths.push(...deepDyamicCheckNode(item))
      }

      // // ERROR: Unimplemented
      // if (childrenPaths.length !== 1 && childrenPaths.some(b => !!b)) debugger

      return childrenPaths
    }
  } else {
    if (isTypePrimitive(node.type.type)) return [false]

    // ERROR: Unimplemented
    debugger
  }
}

function deepCheckDynamicTypedValue(value, path = []) {
  // ERROR: Nananinanao
  if (isNil(value)) debugger

  if (value.isArray()) {
    const dynamicPaths = []
    for (let i = 0; i < value._value.length; i++) {
      const item = value._value[i]

      dynamicPaths.push(...deepCheckDynamicTypedValue(item, [...path, i]))
    }

    return dynamicPaths
  } else if (value.isPrimitive()) {
    if (value._metadata.context) {
      const node = value._metadata.node
      const dynamicAnalisis = deepDyamicCheckNode(node)
      const results = uniq(dynamicAnalisis)

      // // ERROR: Unimplemented
      // if (dynamicAnalisis.length !== 1 && dynamicAnalisis.some(b => !!b)) debugger

      return [[results.length === 2 ? false : results[0], [...path]]]
      // return dynamicAnalisis.map(isDynamic => [isDynamic, [...path]])
    }

    return [[false, path]]
  } else {
    // ERROR: Unimplemented
    debugger
    return [[false, path]]
  }
}

class GDF {
  constructor(text, parent, section, book) {
    this.text = text
    this.parent = parent
    this.section = section
    this.book = book

    this.tree = new Tree(this.text)
    this.tree.parse()
    // this.tree.root.traverse()

    // debugger
    this.parse()
  }

  get extendedName() {
    if (isNil(this.data.nameext) || this.data.nameext === ``) return this.data.name
    return `${this.data.name} (${this.data.nameext})`
  }

  parse() {
    const tokenizedContext = GDF.tokenize(this.tree.root)

    const context = new TypedValue(
      `context`,
      tokenizedContext,
      { text: this.tree.root.stringify(), from: this.tree.root.stringify() },
      { shallow: false, context: this.tree.root.context, node: this.tree.root, tokenized: true },
    )

    this._data = GDF.parse(context, { type: `OBJECT` }, null)
    this.data = this._data.serialize()

    if (this.data.name?.[0] === `#`) this._command = true
    if (this.data.name?.[0] === `@`) this._formula = true
  }

  prebuild(entries, index) {
    // TODO: Pre-parse @ expressions beforehand

    const changes = []
    const data = this.data

    // SKILLS: defaults
    if (this.section === `SKILLS`) {
      // defaults
      const default_ = data.default ?? []
      if (default_.length > 0) {
        const mappedDefault = []
        const ATTRIBUTES = [`ST`, `DX`, `IQ`, `HT`, `WILL`, `PER`, `DODGE`]

        for (const defaultSkill of default_) {
          // if (defaultSkill === `SK:Cooking-3`) debugger

          const tree = new Tree(defaultSkill.trim().replaceAll(/[""]/g, `"`), [
            { type: `enclosure`, character: [`parenthesis`, `braces`, `brackets`, `quotes`, `percentage`] },
            { type: `math`, character: [`minus`, `plus`] },
          ])
          tree.parse()

          // if (defaultSkill === `"SK:%Gun SkillsList%::level" - 4 + ST:IQ - ST:DX`) debugger

          let text = tree.root.stringify(true)
          const tokens = TypedValue.tokenize(new TypedValue(`string`, text, { from: text, context: tree.root }), TypedValue.COMPLETE_PROTOCOL_PATTERNS)
          const context = GDF.contextualize(tree.root, tokens, TypedValue.COMPLETE_PROTOCOL_PATTERNS)

          let obj = TypedValue.math(context)

          // fix non mathematical defaults
          if (!obj.math) {
            const simpleContext = TypedValue.simplify(context)

            if (isString(simpleContext) || simpleContext.context !== undefined) obj = TypedValue.math(context.math([context], [], `plus`)) // single value
            else if (simpleContext.length === 3) {
              if (isString(simpleContext[1]) && simpleContext[1].match(/^\s+$/)) obj = TypedValue.math(context.math([context._value[0]], [context._value[2]], `plus`)) // %A% %B%
              else if (simpleContext.filter(c => c.context !== undefined).length === 1) obj = TypedValue.math(context.math([context], [], `plus`)) // SK:[A]::level
              else debugger
            } else if (simpleContext.length === 2) {
              if (simpleContext.filter(c => c.context !== undefined).length === 1) obj = TypedValue.math(context.math([context], [], `plus`)) // SK:[A] or name (nameext)
              else debugger // ?? ??
            } else debugger

            if (!obj.math)
              obj = {
                value: obj,
                text: tree.root.subText,
              }
          }

          if (obj.variables) {
            // build target object from variable
            obj.targets = {}

            for (const [key, _value] of Object.entries(obj.variables)) {
              // clean value from prefix/suffix
              if (_value.match === undefined) debugger
              const _prefix = _value.match(/^([^:]+):(?!:)/)
              let type = { SK: `skill`, ST: `attribute` }[_prefix?.[1]] ?? `unknown`
              let transform

              const _transform = _value.match(/\s*::(\w+)\s*$/)
              if (_transform) transform = _transform[1]

              const valueWithoutPrefix = _prefix ? _value.replace(/^([^:]+):(?!:)/, ``) : _value
              const valueWithoutTransform = _transform ? valueWithoutPrefix.replace(/\s*::(\w+)\s*$/, ``) : valueWithoutPrefix

              // re-parse tree to extract extensions and what nots
              const tree = new Tree(valueWithoutTransform.trim().replaceAll(/[""]/g, `"`), [
                { type: `enclosure`, character: [`parenthesis`, `braces`, `brackets`, `quotes`, `percentage`] },
              ])
              tree.parse()

              let text = tree.root.stringify(true)
              const tokens = TypedValue.tokenize(new TypedValue(`string`, text, { from: text, context: tree.root }), TypedValue.COMPLETE_PROTOCOL_PATTERNS)
              const context = GDF.contextualize(tree.root, tokens, TypedValue.COMPLETE_PROTOCOL_PATTERNS)

              let simpleContext = TypedValue.simplify(context, { trim: true })
              if (!isArray(simpleContext)) simpleContext = [simpleContext]
              else if (simpleContext.length === 3) {
                if (isString(simpleContext[1]) && simpleContext[1].match(/^\s+$/)) simpleContext.splice(1, 1)
                else debugger
              } else if (simpleContext.length !== 2 && simpleContext.length !== 1) debugger

              let [_name, _nameext] = simpleContext

              // parse target object
              if (type === `unknown`) {
                if (ATTRIBUTES.includes(valueWithoutTransform.toUpperCase())) type = `attribute`
                else if (simpleContext.length <= 2 && (isString(simpleContext[0]) || simpleContext[0].context === `quotes`)) type = `skill`
              }

              let value
              let fullName = valueWithoutTransform
              let name
              let nameext

              // NAME/NAMEEXT
              if (isString(_name)) name = _name.trim()
              else if (isObjectLike(_name) && _name.context !== undefined) {
                name = dynamicValue(`unknown`, _name.value)

                if ([`percentage`].includes(_name.context)) name = dynamicValue(`list`, { options: _name.value })
                else if ([`brackets`].includes(_name.context)) name = dynamicValue(`input`, { label: _name.value, schema: { type: `string` } })
                else debugger
              } else debugger

              if (_nameext !== undefined) {
                if (_nameext.context === `parenthesis`) {
                  _nameext = _nameext.value
                } else if (isString(_nameext)) {
                  // ERROR: whut? should be parenthesis always
                  debugger
                }

                if (isString(_nameext)) nameext = _nameext.trim()
                else {
                  nameext = dynamicValue(`unknown`, _nameext.value.trim())

                  if ([`percentage`].includes(_nameext.context)) nameext = dynamicValue(`list`, { options: _nameext.value.trim() })
                  else if ([`brackets`].includes(_nameext.context)) nameext = dynamicValue(`input`, { label: _nameext.value.trim(), schema: { type: `string` } })
                  else debugger
                }
              }

              // ERROR: Uncovered
              if (simpleContext.length > 2 || simpleContext.length === 0) debugger

              // if (this.data.name === `Armoury` && this.data.nameext === `Body Armor`) debugger

              // VALUE
              if (fullName === `me`) type = `me`
              if (type === `attribute`) value = fullName
              else if (type === `skill`) {
                let fullMatch = true

                // first try with FULLNAME, should work for non-specialized or specializations that already exists
                value = index.byFullname[fullName] ?? index.byName[fullName]
                if (value === undefined) {
                  fullMatch = false
                  if (name !== fullName && isString(name)) value = index.byName[name]

                  // if (fullName === `Engineer (Battlesuits)`) debugger

                  // pre-refinement since it was not a full match
                  if (isString(nameext) && value?.length > 0) {
                    const _value = (value ?? []).map(i => entries[i])

                    const nonSpecialized = _value.filter(entry => isNil(entry.data.nameext))
                    const dynamicSpecialization = _value.filter(entry => entry.data.dynamic?.includes(`nameext`))
                    const specialized = _value.filter(entry => entry.data.nameext)

                    if (dynamicSpecialization.length > 0 && nonSpecialized.length > 0) debugger
                    else if (dynamicSpecialization.length > 0) value = dynamicSpecialization.map(entry => entry._index)
                    else if (nonSpecialized.length > 0) value = nonSpecialized.map(entry => entry._index)
                  } else if (isString(name) && nameext === undefined) {
                    value = index.byNameExt[name]

                    if (value !== undefined) {
                      if (value.length !== 1) {
                        // ERRROR: Unimplemented
                        debugger
                      }
                    }
                  }
                }

                // Refine results
                if (value?.length > 1) {
                  const _value = (value ?? []).map(i => entries[i])

                  const nonSpecialized = _value.filter(entry => isNil(entry.data.nameext))
                  const dynamicSpecialization = _value.filter(entry => entry.data.dynamic?.includes(`nameext`))
                  const specialized = _value.filter(entry => !isNil(entry.data.nameext))

                  if (fullMatch) {
                    if (nameext) {
                      // TODO: Refine results
                    } else if (nonSpecialized.length > 0) value = nonSpecialized.map(entry => entry._index)
                  } else {
                    // TODO: Refine results
                  }
                }
              }

              // ERROR: Cannot have unknown default
              const ignoreError = name.type !== undefined || name === `me`
              if (!ignoreError && (type === `unknown` || value === undefined)) {
                if (value === undefined)
                  console.log(
                    `  `,
                    `  `,
                    `Could not find reference "${type}" for "${data.name}":`,
                    defaultSkill,
                    // `  |  `,
                    // ...modifiers.map(modifier => modifier.value),
                    `  |  `,
                    value,
                    `>  `,
                    fullName,
                    name,
                    nameext,
                  )
                else if (type === `unknown`)
                  console.log(
                    `  `,
                    `  `,
                    `Unknown default for "${data.name}":`,
                    defaultSkill,
                    // `  |  `,
                    // ...modifiers.map(modifier => modifier.value),
                    // `  |  `,
                    value,
                    `>  `,
                    fullName,
                    name,
                    nameext,
                  )
                // context.print(4)
                // debugger
              }

              const target = { _raw: _value, type, fullName, name }
              if (nameext) target.nameext = nameext
              if (value) target.value = value
              if (transform) target.transform = transform

              // if (!isString(name) || (!isString(nameext) && nameext !== undefined)) debugger

              obj.targets[key] = target
            }
          }

          obj._raw = defaultSkill

          // debugger
          mappedDefault.push(obj)
        }

        if (mappedDefault.length > 0) changes.push({ default: mappedDefault })
      }
    }

    // first-order inputable values
    const keys = [`basecost`, `baseweight`]
    for (const key of keys) {
      if (!has(data, key)) continue
      const value = data[key]
      const source = this._data._value[key]

      const dynamicAnalysis = deepCheckDynamicTypedValue(source)
      const dynamicPaths = dynamicAnalysis.filter(([isDynamic]) => isDynamic).map(([, path]) => path)
      if (dynamicPaths.length > 0) {
        // ERROR: Unimplemented
        if (dynamicPaths.length > 1) debugger

        const path = dynamicPaths[0]

        // ERROR: Unimplemented for other paths than root
        if (path.length !== 0) debugger

        data[key] = dynamicValue(`input`, { label: value, schema: { type: `string` } })
      }
    }

    // specialization required
    const nameext = data.nameext
    // if (nameext === `Status %Status%`) debugger
    const x = data.x ?? [] // Array<Object<string:any>>
    if (data.nameext?.match(/%[\w -\(\)]+%/)) changes.push({ specializationRequired: true })
    else {
      for (const tag of x) {
        for (const key of Object.keys(tag)) {
          const keyIsAllowed = [`#InputToTag`, `#InputReplace`, `#InputToTagReplace`, `#ChoiceList`].includes(key)
          const matchesSpecialize = deepMatch(tag[key], /( +specialize|specialize +)/)
          const matchesSpecialization = deepMatch(tag[key], /( +specialization|specialization +)/)
          const manipulatesNameExt = deepMatch(tag[key], /^ *nameext *$/i)

          // key is not on list of allowance for specialization requirement
          if ((matchesSpecialize || matchesSpecialization) && !keyIsAllowed) debugger

          if (((matchesSpecialize || matchesSpecialization) && keyIsAllowed) || manipulatesNameExt) changes.push({ specializationRequired: true })
        }
      }
    }

    if (changes.length > 0) {
      for (const change of changes) {
        for (const key of Object.keys(change)) this.data[key] = change[key]
      }
    }
  }

  /**
   *
   * @param {Node} node
   * @param patterns
   * @returns {TypedValue}
   */
  static tokenize(node, patterns = TypedValue.PROTOCOL_PATTERNS) {
    const _comma = / *, */g
    const _pipe = / *\| */g

    // breaks a context's contents by comma and pipe, in any order necessary
    // but always outputs in the same way: PIPE > COMMA > STRING/CONTEXT

    const _contents = node.stringify()

    if (node.type.type === `math`) {
      const before = TypedValue.array(
        node.before.map(child => {
          const source = { from: child.tree.text, text: child.subText, start: child.start, end: child.end }

          let token
          if (child.type.type === `string`) token = new TypedValue(`string`, child.stringify(), source)
          else token = new TypedValue(`context`, child.context, source, { shallow: true })

          return GDF.contextualize(child, token, patterns)
        }),
        TypedValue.source(node.tree.text.substring(node.start, node.operatorIndex), node.tree.text, node.start, node.operatorIndex, node),
        { before: true, parent: node },
      )

      const after = TypedValue.array(
        node.after.map(child => {
          const source = { from: child.tree.text, text: child.subText, start: child.start, end: child.end }

          let token
          if (child.type.type === `string`) token = new TypedValue(`string`, child.stringify(), source)
          else token = new TypedValue(`context`, child.context, source, { shallow: true })

          return GDF.contextualize(child, token, patterns)
        }),
        TypedValue.source(node.tree.text.substring(node.operatorIndex + 1), node.tree.text, node.operatorIndex + 1, node.end, node),
        { after: true, parent: node },
      )

      return new TypedValue(`array`, [before, after], TypedValue.source(_contents, node.tree.text, node.start, node.end, node), { mathContent: true })
    }

    // there is never a PIPE at first level (only inside a parenthesis, so the first level would be just a context alone)
    // so first spliting is always comma
    const contents = _contents.replace(/ *N *\| *A */i, `N/A`)
    if (contents === ``) return new TypedValue(`string`, ``, TypedValue.source(``, contents, 0, 0, node), { emptyString: true })

    // #region PRE-SPLIT
    // ------------------------------------------------------------------------------------------------------------
    let DELIMITERS = []

    if (contents.match(_comma)) DELIMITERS = [`comma`]
    if (contents.match(_pipe)) DELIMITERS = [`pipe`]

    /**
     * Effect: Incapacitating, -10, shortname(Incapacitating), group(Addiction), page(B122)
     *  | Effect: Totally addictive (-10 on withdrawal roll), -10, shortname(Totally addictive), group(Addiction), page(B122)
     *  | Legality: Illegal, +0, shortname(Illegal), group(Addiction), page(B122)
     */

    // if both appears, decide first
    if (contents.match(_pipe) && contents.match(_comma)) {
      DELIMITERS = [`comma`, `pipe`] // default behaviour

      // this is a complex set of ifs to ease my mind
      //    with this ill check each case???

      const index = { "|": [], ",": [] }
      const ocurrences = { "|": [], ",": [] }

      const _contents = [...contents]
      _contents.map((c, i) => [`|`, `,`].includes(c) && index[c].push(i))
      const characters = _contents.filter(c => [`|`, `,`].includes(c))
      characters.map((c, i) => ocurrences[c].push(i))

      const pipe = { raw: index[`|`], index: ocurrences[`|`], max: max(ocurrences[`|`]), min: min(ocurrences[`|`]) }
      const comma = { raw: index[`,`], index: ocurrences[`,`], max: max(ocurrences[`,`]), min: min(ocurrences[`,`]) }

      const d = { both: {}, pipe: {}, comma: {} }
      d.comma.isFirst = d.pipe.isLast = comma.min < pipe.min && comma.max < pipe.min
      d.comma.firstOfAll = comma.min < pipe.min

      d.pipe.isFirst = d.comma.isLast = comma.min > pipe.max && comma.max > pipe.max
      d.pipe.firstOfAll = pipe.min < comma.min

      d.both.areMixed = !d.comma.isFirst && !d.pipe.isLast && !d.pipe.isFirst && !d.comma.isLast

      if (!d.both.areMixed && d.pipe.isLast) DELIMITERS = [`comma`, `pipe`]
      else {
        const pipeIndexAtNoWhiteSpace = []
        const contentsWithoutWhiteSpace = [...contents.replaceAll(` `, ``)]
        contentsWithoutWhiteSpace.map((c, i) => c === `|` && pipeIndexAtNoWhiteSpace.push(i))

        // if before each PIPE there is virtually nothing (at most white spaces) until it found a comma
        //    ex.: Area_Effect <#ρ1.a>, +100%, group<#ρ1.b>, page<#ρ1.c>, shortname<#ρ1.d>, gives<#ρ1.e>,
        //        | Advantage: Enhanced Move 0.5 <#ρ1.f>, +100%, group<#ρ1.g>, page<#ρ1.h>,
        //        | Emanation, -20%, group<#ρ1.i>, page<#ρ1.j>,gives<#ρ1.k>,
        //        | Extended Duration <#ρ1.l>, +150%, group<#ρ1.m>, page<#ρ1.n>,
        //        | Malediction, +100%/+150%/+200%, upto<#ρ1.o>, group<#ρ1.p>, page<#ρ1.q>,levelnames<#ρ1.r>,gives<#ρ1.s>,
        //        | Preparation Required <#ρ1.t>, -50%, group<#ρ1.u>, page<#ρ1.v>,
        //        | Selective Area, +20%, group<#ρ1.w>, page<#ρ1.x>
        //
        //    THEN just split first by PIPE
        d.pipe.beforeEachThereIsVirtuallyAComma = pipeIndexAtNoWhiteSpace.every(index => contentsWithoutWhiteSpace[index - 1] === `,`)

        if (!d.comma.firstOfAll && !d.pipe.beforeEachThereIsVirtuallyAComma && !d.pipe.firstOfAll) debugger
        DELIMITERS = [`pipe`, `comma`]

        // if (d.pipe.beforeEachThereIsVirtuallyAComma) FIRST_SPLIT = `|`
        // else if (d.comma.firstOfAll) FIRST_SPLIT = `,`
        // else {
        //   debugger
        // }
      }
    }
    // ------------------------------------------------------------------------------------------------------------
    // #endregion

    let tokens = new TypedValue(`string`, contents, { from: contents, context: node })
    for (let depth = 0; depth < DELIMITERS.length; depth++) {
      const delimiter = DELIMITERS[depth]

      tokens = TypedValue.split(tokens, delimiter)
    }

    tokens = TypedValue.tokenize(tokens, patterns)

    return GDF.contextualize(node, tokens, patterns)
  }

  /**
   *
   * @param {Node} parent
   * @param {TypedValue} token
   * @param patterns
   * @returns {TypedValue}
   */
  static contextualize(parent, token, patterns) {
    if (token.isTrueType(`string`)) return token
    else if (token.isTrueType(`array`) | token.isTrueType(`options`)) {
      token._value = token._value.map(value => GDF.contextualize(parent, value, patterns))
      return token
    }

    // ERROR: Can only contextualize CONTEXTS
    if (!token.isContext()) debugger

    /** @type {Node} */
    const node = parent.context === token._value ? parent : parent.children.find(n => n.context === token._value)

    const contextualizedValue = node.stringify()
    const deepUncontextualizedValue = node.subText

    token._metadata[`shallow`] = false
    token._metadata[`context`] = token._value
    token._metadata[`contextualizedValue`] = contextualizedValue
    token._metadata[`deepUncontextualizedValue`] = deepUncontextualizedValue
    token._metadata[`node`] = node
    token._metadata[`tokenized`] = true
    if (node.type.type === `math`) token._metadata[`math`] = true

    // if (token._value === `ρ0.o`) debugger
    token._value = GDF.tokenize(node, patterns)

    return token
  }

  /**
   * @typedef {object} Directive
   * @property {any} directive
   * @property {boolean} noDirective
   * @property {string[]} expextedType
   * @property {boolean} ANY
   * @property {boolean} STRING
   * @property {boolean} ARRAY_STRING
   * @property {boolean} BOOLEAN
   * @property {boolean} ARRAY
   * @property {boolean} ARRAY_OBJECT
   * @property {boolean} OBJECT
   * @property {boolean} CONTEXT
   * @property {boolean} CONTEXT_SHALLOW
   * @property {boolean} OPTIONS
   */

  /**
   *
   * @param {TypedValue} token
   * @param {object} overwrite
   * @param {string} overwrite.areTypedValues
   * @returns {Directive}
   */
  static directive(token, overwrite = {}) {
    const tag = token._metadata.tag

    // #region TAG DIRECTIVE
    let directive

    if (tag !== undefined) {
      directive = TAG_DIRECTIVES[tag]
      while (directive?.equivalent) {
        // ERROR: Cannot have other than equivalent in keys
        if (Object.keys(directive).length > 1) debugger

        directive = TAG_DIRECTIVES[directive.equivalent]
      }
    }
    let noDirective = directive === undefined
    if (noDirective) directive = { type: [`any`] }

    // base directives
    const _ = {
      directive,
      noDirective,
      expextedType: [],
      // protocols
      CONTEXT: token.isContext(),
      CONTEXT_SHALLOW: token.isContext(true),
      OPTIONS: token.isType(`options`),
      // types
      ANY: false, //isEqual(directive.type, [`any`]),
      STRING: false, //isEqual(directive.type, [`string`]),
      ARRAY_STRING: false, //isEqual(directive.type, [`array`, `string`]),
      BOOLEAN: false, //isEqual(directive.type, [`boolean`]),
      ARRAY: false, //isEqual(directive.type, [`array`]),
      ARRAY_OBJECT: false, //isEqual(directive.type, [`array`, `object`]),
      OBJECT: false, //isEqual(directive.type, [`object`]),
    }

    // type directives
    const _types = {
      ANY: [`any`],
      STRING: [`string`],
      ARRAY_STRING: [`array`, `string`],
      BOOLEAN: [`boolean`],
      ARRAY: [`array`],
      ARRAY_OBJECT: [`array`, `object`],
      OBJECT: [`object`],
    }

    if (overwrite.type) {
      _[overwrite.type] = true
      _.expextedType = _types[overwrite.type]
    } else {
      Object.entries(_types).map(([name, type]) => (_[name] = isEqual(directive.type, type)))
      _.expextedType = _types[directive.type]
    }

    if (_.noDirective) directive = { type: [`any`] }
    if (tag === undefined) _.noDirective = false // ignore no directive for no tags

    // #endregion

    return _
  }
  /**
   *
   * @param {TypedValue} root
   * @param {Directive} directive
   * @param parent
   * @returns {TypedValue}
   */
  static parse(root, directive, parent) {
    // if it ever gets necessary to add another argument here, instead change "tag" to protocol,
    //    for more complex specializations
    const _ = GDF.directive(root, directive)
    const tag = root._metadata.tag
    const index = root._metadata.index

    // SAME AS DEBUG ON CONTENTS
    // --------------------------------------------------------------------------------
    // if (tokenizedContext._source.from === `hide<#ρ2.a>`) debugger
    // if (tag === `initmods` && !_.OPTIONS) debugger
    // if (tag === `itemnotes`) debugger
    // --------------------------------------------------------------------------------

    /** @type {TypedValue} */
    let result = root

    if (_.ANY) {
      // kk
    } else if (_.OPTIONS) {
      const options = root.value
      for (let i = 0; i < options.length; i++) {
        if (tag !== undefined) root.value[i]._metadata.tag = tag
        result.value[i] = GDF.parse(root.value[i], {}, root)
      }
    } else if (_.STRING) {
      const delimiter = root.leaf.delimiter ?? ``
      if (delimiter !== ``) debugger

      const newString = root.string(root, delimiter)

      const joinEXp = root.join()

      if (root.isContext()) result = root.make(`context`, newString)
      else result = newString

      if (_.directive.discardFinalPoint) {
        const value = result.leaf.value
        if (value[value.length - 1] === `.`) result.leaf.value = value.substring(0, value.length - 1)
      }
    } else if (_.BOOLEAN) {
      if (_.directive.delimiter) debugger
      if (_.directive.discardFinalPoint) debugger

      result = root.flatten()
      result._type = [`boolean`]
      result._value = result._value === `yes` ? true : false
    } else if (_.ARRAY_STRING || _.ARRAY_OBJECT) {
      if (!_.directive.delimiter) {
        if (_.directive.discardFinalPoint) debugger

        const values = root.isArray() && !root.leaf._source.token ? root.value : [root]
        const _parent = root.isArray() && !root.leaf._source.token ? root : parent

        // if (root.leaf._source.token) debugger
        // if (_.ARRAY_OBJECT) debugger

        result = root.array(values.map(value => GDF.parse(value, { type: _.ARRAY_STRING ? `STRING` : `OBJECT` }), _parent))
      } else {
        // parse it all to string
        //  re-split it with new delimiter

        const newString = GDF.parse(root, { type: `STRING` }, parent)
        const values = newString.value.split(new RegExp(` *${_.directive.delimiter} *`, `g`))
        result = root.array(
          values.map(string => root.make(`string`, string, { resplited: true })),
          { delimiter: _.directive.delimiter },
        )
      }
    } else if (_.ARRAY) {
      if (_.directive.delimiter) debugger
      if (_.directive.discardFinalPoint) debugger

      if (root.leaf._source.token) {
        if (!root.isArray()) debugger

        const tokens = root.value
        const allTokensArePrimitive = tokens.every(token => token.isPrimitive())
        if (allTokensArePrimitive) {
          if (root.leaf._source.delimiter) debugger

          result = root.clone()
          result = result.join()
        }
      }

      if (!root.isArray()) result = root.array([root])
    } else if (_.OBJECT) {
      // usually born from tags
      // detect and parse tags, add non-tags as implicits
      // root will be a array (unless root is an empty string)

      // here we are expected to receive COMPONENTS (split by comma)
      //    so all tokens must be wrapped at least
      let components = root.value
      if (root.leaf._source.delimiter !== `comma`) components = [root]
      // if (root.leaf._source.delimiter !== `comma`) debugger

      // if (parent === null) debugger

      const partials = []
      // for each component, parse partial (a duple of key + value for final object) OR implicit
      for (let c = 0; c < components.length; c++) {
        const component = components[c]

        /** @type {TypedValue[]} */
        const tokens = component.isArray() ? component.value : [component]

        const chunks = []
        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i]
          const next = tokens[i + 1]

          const tokenIsPrimitive = !!token.isPrimitive()
          const tokenIsStringWithNoSpaceBetweenItAndContext = tokenIsPrimitive && token.value[token.value.length - 1] !== ` `
          const tokenDoesntLookLikeATag = tokenIsPrimitive && !!token.value.match(/( - ?|(- ))/)

          const nextIsContext = !!next?.isContext()
          const nextIsParenthesis = nextIsContext && tokens[1]._metadata.node.type.character === `parenthesis`

          let isTag = tokenIsStringWithNoSpaceBetweenItAndContext && !tokenDoesntLookLikeATag && nextIsParenthesis
          if (isTag && parent === null && c === 0) {
            const tokenHasWhiteSpaces = tokenIsPrimitive && !!token.value.match(/ /)
            isTag = !tokenHasWhiteSpaces
          }

          // if (tokenIsStringWithNoSpaceBetweenItAndContext && tokenDoesntLookLikeATag && nextIsParenthesis) debugger

          // WARNING: Weird that there is a line where the first shit is a tag (and therefore not a name)
          if (isTag && parent === null && c === 0 && token.value !== `name`) debugger

          if (isTag) {
            let key = Tree.removeUnbalance(token.value.trim())

            next._metadata.tag = key
            next._metadata.index = c

            const newTag = GDF.parse(next, {}, root)
            newTag._source = { ...next._source, ...newTag._source }
            newTag._metadata = { ...next._metadata, ...newTag._metadata }
            newTag._issues = [...next._issues, ...newTag._issues]

            chunks.push(newTag)
            i++
          } else {
            token._metadata.implicit = true
            chunks.push(token)
          }
        }

        // deal with "errors" (implicits and chunks)
        const implicitness = chunks.filter(token => token._metadata.implicit !== undefined).length
        if (implicitness === chunks.length) {
          // everything is implicit, so actually 1ROOT is implicit (and probably is a token for a higher object????)
          component._metadata.implicit = true
          chunks.splice(0, chunks.length, component)
        } else {
          // chunking, implies the lack of a comma (typo most likely)
          const numberOfChunks = chunks.length - implicitness
          if (numberOfChunks > 1) result.addIssue({ chunking: chunks.map(newTag => newTag._metadata.tag) }, root._source.from)
        }

        partials.push(...chunks)
      }

      // consolidate partials into object
      const object = {}
      const implicit = []
      for (let i = 0; i < partials.length; i++) {
        let key, value

        const token = partials[i]
        if (token._metadata.tag && token._metadata.implicit) {
          if (token.leaf._metadata.emptyString) {
            // do nothing let it be a empty value

            if (partials.length > 1) debugger // BUT WHAT TO DO WITH THE REST?
          } else implicit[i] = token
        } else if (token._metadata.tag) {
          key = token._metadata.tag
          value = token
        } else if (token._metadata.implicit) {
          implicit[i] = token // pre-set implicit

          // is it really implicit?

          const isPrimitive = token.isDeepType(`primitive`, true)
          const isObject = token.isDeepType(`object`, true)
          const isEmptyString = token._metadata.emptyString
          const isWhitespace = token.isPrimitive() && !!token.value.match(/^ +$/g)

          const isLastItem = i + 1 === partials.length

          const doReject = (isEmptyString && isLastItem) || isWhitespace
          const doGuessKey = !isObject

          if (doReject) delete implicit[i]
          else if (doGuessKey) {
            // try and guess key
            if (i == 0 && isPrimitive) key = `name`
            else if (i === 1 && isPrimitive) key = `cost`

            // if a key was found, parse token with key
            if (key !== undefined) {
              token._metadata.tag = key
              token._metadata.index = i
              delete token._metadata.implicit

              const tagToken = GDF.parse(token, {}, root)
              tagToken._source = { ...token._source, ...tagToken._source }
              tagToken._metadata = { ...token._metadata, ...tagToken._metadata }
              tagToken._issues = [...token._issues, ...tagToken._issues]

              value = tagToken

              delete implicit[i]
            }
          }
        } else debugger

        // add to key
        if (key !== undefined) {
          // overriding existing key
          if (object[key] !== undefined) {
            while (object[key] !== undefined) key = `_${key}`
            value.addIssue({ repeatedKey: key }, root._source.from)
          }

          // FORMATTING
          if (key === `name`) {
            const valueIsPrimitive = value.isPrimitive()
            const valueHasParenthesis = valueIsPrimitive && !!value.value.match(/\([^()]+\)/)
            const valueIsSpecial = valueIsPrimitive && [`@`, `#`].includes(value.value[0])

            if (valueHasParenthesis && !valueIsSpecial) {
              const _pattern = value.value.match(/([^()]+) *\(([^()]+)\)/)
              if (_pattern === null) debugger
              const [, name, nameext] = _pattern
              value.leaf.value = name.trim()

              if (object[`nameext`] !== undefined) debugger
              object[`nameext`] = value.clone()
              object[`nameext`].leaf.value = nameext.trim()

              if (nameext.trim().match(/^\[[^\[\]]+\]$/) || nameext.trim().match(/^%[^%]+%$/)) {
                debugger
                if (object[`dynamic`] === undefined) object[`dynamic`] = new TypedValue([`array`, `string`], [], { manual: true })
                object[`dynamic`].value.push(new TypedValue(`string`, `nameext`))
              }
            }
          } else if (key === `nameext`) {
            if (value._metadata.node.children[0]?.type?.character === `brackets` || value.value.trim().match(/^%[^%]+%$/)) {
              if (object[`dynamic`] === undefined) object[`dynamic`] = new TypedValue([`array`, `string`], [], { manual: true })
              object[`dynamic`].value.push(new TypedValue(`string`, `nameext`))
            }
          }
          // else {
          //   const directive = TAG_DIRECTIVES[key]
          //   // eslint-disable-next-line no-inner-declarations
          //   function deepCheckDynamic(value, path = []) {
          //     if (value.isArray()) {
          //       const dynamicPaths = []
          //       for (let i = 0; i < value._value.length; i++) {
          //         const item = value._value[i]

          //         dynamicPaths.push(...deepCheckDynamic(item, [i]))
          //       }

          //       return dynamicPaths
          //     } else if (value.isPrimitive()) {
          //       if (value._metadata.context) {
          //         const node = value._metadata.node
          //         if (node.type.type === `enclosure`) {
          //           if ([``].includes(node.type.character)) {
          //             debugger
          //           } else {
          //             return deepCheckDynamic(value._value)
          //           }
          //         }
          //       }

          //       return [[false, path]]
          //     } else {
          //       debugger
          //       return [[false, path]]
          //     }
          //   }

          //   if (directive) {
          //     const dynamicAnalysis = deepCheckDynamic(value)
          //     const dynamicPaths = dynamicAnalysis.filter(([isDynamic]) => isDynamic).map(([, path]) => path)
          //     if (dynamicPaths.length > 0) {
          //       debugger
          //     }
          //   }
          // }

          object[key] = value
        }
      }

      // pack it
      result = root.make(`object`, object) // CANT USE MAKE BCAUSE CHUNKS ARE ALREADY BEING STORED INSIDE RESULT'S ISSUES
      result._implicit = implicit

      implicit.forEach((value, index) => {
        if (value === undefined) return
        result.addIssue({ index, implicit: value.stringify() }, value._source.from)
      })
    } else debugger

    // ERROR: Type outside directive
    if (_.noDirective && !_.ANY && !result.isDeepType(_.expextedType)) debugger

    // sending
    // ---------------------------------------------------------------------------------------
    // only really happens when there is a tag
    if (_.noDirective) result.addIssue({ directiveless: tag }, `${root._source.from} → ${root._metadata.contextualizedValue}`)

    return result
  }

  guessType(master, books) {
    const byTag = this.typeByTag()
    const byName = this.typeByName(master, books)

    // if (byTag.error !== undefined && byName.error !== undefined) debugger

    // if (byName.error !== undefined) debugger
    // if (byName.type === undefined) debugger

    const nameError = byName.error !== undefined
    const tagError = byTag.error !== undefined

    const bothError = nameError && tagError

    const inter = intersection(flattenDeep([byName.type]), flattenDeep([byTag.type])).filter(t => t !== undefined)
    let type = byName.type

    if (!nameError) {
      if (isString(type)) {
        // CARRY ON MY WAYWAAAAAAAAAARD SOOOOOOOOON
      } else if (isArray(type)) {
        if (type.length === 1) type = type[0]
        else debugger
      } else debugger
    } else {
      if (inter.length === 1) type = inter[0]
      else debugger
    }

    // if ([undefined, `MULTIPLE_MATCH`, `LOW_CONFIDENCE`]) {
    // } else debugger

    this.type = type.toLowerCase()
  }

  typeByTag() {
    // determine type based on keys
    const genericTags = [`name`, `isparent`, `x`, `y`, `noresync`, `resync`, `displaycost`, `displayweight`, /select\d+/m, `replacetags`]
    const tags = Object.keys(this.data).filter(tag => genericTags.find(t => (t instanceof RegExp ? tag.match(t) : t === tag)) === undefined)

    // ERROR: No tags means no type
    if (tags.length === 0) return { error: `NO_TAGS`, tags }

    const TAGS = Object.fromEntries(
      tags.map(tag => {
        let types = (TAG_TYPES[tag] ?? []).map(t => EXTENDED_TYPES[t] ?? t)
        types = uniq(flattenDeep(types))
        return [tag, types]
      }),
    )
    const types = uniq(flattenDeep(Object.values(TAGS)))
    const TYPES = Object.fromEntries(types.map(type => [type, tags.filter(tag => TAGS[tag].includes(type))]))

    const typesByMatch = orderBy(
      Object.entries(TYPES).map(([type, _tags]) => ({ type, matches: _tags.length, confidence: _tags.length / tags.length })),
      `matches`,
      [`desc`],
    )

    const e = 1
    const best = typesByMatch[0]
    const silver = typesByMatch[1]

    // ERROR: Trying to process type in a typed entry
    if (this.type !== undefined) debugger

    // ERROR: No match
    if (!best) return { error: `NO_MATCH`, tags, types, TAGS, TYPES, typesByMatch }

    // cannot decide between best matches, mark entry for later search
    if (silver && best.confidence === silver.confidence) {
      const pool = typesByMatch.filter(type => type.confidence === best.confidence)

      return {
        error: `MULTIPLE_MATCH`,
        tags,
        types,
        TAGS,
        TYPES,
        typesByMatch,
        type: best.confidence === 1 ? pool.filter(t => t.confidence === 1).map(t => t.type) : pool.map(t => t.type),
      }
    }

    // ERROR: Best match has low confidence level
    if (best.confidence < e) {
      return {
        error: `LOW_CONFIDENCE`,
        tags,
        types,
        TAGS,
        TYPES,
        typesByMatch,
        type: best.type,
      }
    }

    return { type: best.type }
  }

  typeByName(master, books) {
    const e = 0.0075

    const d = this.data.name !== this.extendedName

    const SEND_INDEX = paths => {
      const entries = paths.map(([book, index]) => books[book].entries[index])

      if (entries.length > 1) {
        const type = uniq(flatten(entries.map(e2 => e2.section)))

        if (type.length === 1) return { type }

        return {
          error: `MULTIPLE_MATCH`,
          result: entries.map(entry => ({
            item: entry.name,
            score: 1,
          })),
          entries,
          type: uniq(flatten(entries.map(e2 => e2.section))),
        }
      }

      return {
        entries,
        type: entries[0].section,
      }
    }

    const nameByName = master.byName[this.data.name]
    const fullnameByName = d && master.byName[this.extendedName]
    const nameByFullname = master.byFullname[this.data.name]
    const fullnameByFullname = d && master.byFullname[this.extendedName]

    const name = isEqual(nameByName, nameByFullname) && nameByName
    const nameext = isEqual(fullnameByName, fullnameByFullname) && nameByName

    if (!d && !!name) return SEND_INDEX(name)
    else if (!!name && isEqual(name, nameext)) return SEND_INDEX(name)

    // SEARCH WITH FUSE
    const result = []
    result.push(...master.fuse.byName.search(this.data.name).map(r => ({ ...r, _index: `byName`, _query: `name` })))
    if (d) result.push(...master.fuse.byName.search(this.extendedName).map(r => ({ ...r, _index: `byName`, _query: `nameext` })))
    result.push(...master.fuse.byFullname.search(this.data.name).map(r => ({ ...r, _index: `byFullname`, _query: `name` })))
    if (d) result.push(...master.fuse.byFullname.search(this.extendedName).map(r => ({ ...r, _index: `byFullname`, _query: `nameext` })))

    orderBy(result, [`score`], [`asc`])
    const entries = result.map(es => {
      return master[es._index][es.item].map(path => {
        const [book, index] = path
        return books[book].entries[index]
      })
    })

    const best = result[0]
    if (best === undefined)
      return {
        error: `NO_MATCH`,
        result,
        entries,
        name,
      }

    if (best?.score > e)
      return {
        error: `IMPERFECT_MATCH`,
        result,
        entries,
        name,
        type: uniq(flatten(entries.map(e => e.map(e2 => e2.section)))),
      }

    if (best.score === result[1]?.score)
      return {
        error: `MULTIPLE_MATCH`,
        result,
        entries,
        name,
        type: uniq(flatten(entries.map(e => e.map(e2 => e2.section)))),
      }

    const type = uniq(entries[0].map(e => e.section))
    if (type.length > 0)
      return {
        error: `MULTIPLE_MATCH`,
        result,
        entries,
        name,
        type: type,
      }

    return {
      result,
      entries,
      name,
      type: type[0],
    }
  }

  typeByIndex(name, master, books, byIndex = `byName`) {
    const e = 0.0075

    if (master[byIndex][name]) {
      const paths = master[byIndex][name]
      const entries = paths.map(([book, index]) => books[book].entries[index])

      if (entries.length > 1) {
        const type = uniq(flatten(entries.map(e2 => e2.section)))

        if (type.length === 1) return { type }

        return {
          error: `MULTIPLE_MATCH`,
          result: entries.map(entry => ({
            item: entry.name,
            score: 1,
          })),
          entries,
          type: uniq(flatten(entries.map(e2 => e2.section))),
        }
      }

      return {
        entries,
        type: entries[0].section,
      }
    }

    const names = Object.keys(master[byIndex])

    const result = master.fuse[byIndex].search(name)
    const entries = result.map(es => {
      return master[byIndex][es.item].map(path => {
        const [book, index] = path
        return books[book].entries[index]
      })
    })

    const best = result[0]
    if (best === undefined)
      return {
        error: `NO_MATCH`,
        result,
        entries,
        name,
      }

    if (best?.score <= e)
      return {
        error: `IMPERFECT_MATCH`,
        result,
        entries,
        name,
        type: uniq(flatten(entries.map(e => e.map(e2 => e2.section)))),
      }

    if (best.score === result[1]?.score)
      return {
        error: `MULTIPLE_MATCH`,
        result,
        entries,
        name,
        type: uniq(flatten(entries.map(e => e.map(e2 => e2.section)))),
      }

    debugger
  }
}

module.exports = GDF
