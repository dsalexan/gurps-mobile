/* eslint-disable no-debugger */
const path = require(`path`)
const fs = require(`fs`)
const _ = require(`lodash`)
const { isNil, isObjectLike, isArray, get, flatten, groupBy, isString, isNumber, isBoolean, flattenDeep, orderBy } = require(`lodash`)

const ignoreImplicitForTypes = [`FEATURES`]

/**
 *
 * @param string
 */
function removeLastQuote(string) {
  if (string === undefined) return string
  return string[string.length - 1] === `"` ? string.substring(0, string.length - 1) : string
}
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

const extendedTypes = {
  TRAITS: [`ATTRIBUTES`, `ADVANTAGES`, `PERKS`, `DISADVANTAGES`, `QUIRKS`, `SKILLS`, `SPELLS`, `EQUIPMENT`, `TEMPLATES`],
  [`TRAITS-WITH-DAMAGE-MODES`]: [`ATTRIBUTES`, `ADVANTAGES`, `PERKS`, `DISADVANTAGES`, `QUIRKS`, `SKILLS`, `SPELLS`, `EQUIPMENT`, `TEMPLATES`],
  // [`TRAITS_WITH_DAMAGE_MODES`]: [
  //   `ATTRIBUTES_WITH_DAMAGE_MODES`,
  //   `ADVANTAGES_WITH_DAMAGE_MODES`,
  //   `PERKS_WITH_DAMAGE_MODES`,
  //   `DISADVANTAGES_WITH_DAMAGE_MODES`,
  //   `QUIRKS_WITH_DAMAGE_MODES`,
  //   `SKILLS_WITH_DAMAGE_MODES`,
  //   `SPELLS_WITH_DAMAGE_MODES`,
  //   `TEMPLATES_WITH_DAMAGE_MODES`,
  // ],
  [`TRAITS-!ATTRIBUTES-!SKILLS-!SPELLS`]: [`ADVANTAGES`, `PERKS`, `DISADVANTAGES`, `QUIRKS`, `EQUIPMENT`, `TEMPLATES`],
  [`TRAITS-!SKILLS-!SPELLS-!EQUIPMENT`]: [`ATTRIBUTES`, `ADVANTAGES`, `PERKS`, `DISADVANTAGES`, `QUIRKS`, `TEMPLATES`],
  [`TRAITS-!EQUIPMENT`]: [`ATTRIBUTES`, `ADVANTAGES`, `PERKS`, `DISADVANTAGES`, `QUIRKS`, `SKILLS`, `SPELLS`, `TEMPLATES`],
}

const _tagsTypesIndex = [
  [[`cost`, `base`, `defaultstat`, `relname`, `stepadds`, `subzero`, `zeropointsokay`, ``], `SKILLTYPES`],
  [[`st`, `thr`, `sw`], `BASICDAMAGE`],
  [[`break`, `adddice`, `subtract`], `CONVERTDICE`],
  [[`name`, `display`, `expanded`, `group`, `posx`, `pos`], `BODY`],
  // [[], `SYMBOLS`],
  // [[], `BODYIMAGES`],
  [[`BaseValue`, `Display`, `Down`, `DownFormula`, `InPlayMult`, `MainWin`, `MaxScore`, `MinScore`, `Round`, `Step`, `Symbol`, `Up`, `UpFormula`], `ATTRIBUTES`],
  // [[], `ADVANTAGES`],
  // [[], `LANGUAGES`],
  // [[], `CULTURES`],
  [[`Base`], [`ADVANTAGES`, `PERKS`, `DISADVANTAGES`, `QUIRKS`]],
  [
    [
      `AddMods`,
      `Adds`,
      `BlockAt`,
      `Cat`,
      `ChildOf`,
      `Conditional`,
      `CountAsNeed`,
      `CountCapacity`,
      `Creates`,
      `DB`,
      `Deflect`,
      `Description`,
      `DisplayNameFormula`,
      `DR`,
      `DRNotes`,
      `FencingWeapon`,
      `Fortify`,
      `Gives`,
      `Group`,
      `Hide`,
      `HideMe`,
      `Highlight`,
      `HighlightMe`,
      `Ident`,
      `InitMods`,
      `Bulk`,
      `ItemNotes`,
      `Links`,
      `MergeTags`,
      `Mods`,
      `Name`,
      `NameExt`,
      `Needs`,
      `NewMode`,
      `Notes`,
      `Page`,
      `ParentOf`,
      `ParryAt`,
      `RemoveMods`,
      `ReplaceTags`,
      `RoundLastOnly`,
      `ScopeAcc`,
      `SkillUsed`,
      `STCap`,
      `SubsFor`,
      `Taboo`,
      `TargetListIncludes`,
      `TL`,
      `Units`,
      `UpTo`,
      `UserNotes`,
      `Uses`,
      `Uses_sections`,
      `Uses_settings`,
      `Uses_used`,
      `Vars`,
      `VTTNotes`,
      `VTTModeNotes`,
      `WeightCapacity`,
      `WeightCapacityUnits`,
    ],
    `TRAITS`,
  ],
  [
    [
      `acc`,
      `ArmorDivisor`,
      `Break`,
      `Damage`,
      `DamageBasedOn`,
      `DamageIsText`,
      `DamType`,
      `LC`,
      `MaxDam`,
      `MinST`,
      `MinSTBasedOn`,
      `Mode`,
      `Parry`,
      `Radius`,
      `RangeHalfDam`,
      `RangeMax`,
      `Rcl`,
      `Reach`,
      `ReachBasedOn`,
      `ROF`,
      `Shots`,
    ],
    `TRAITS-WITH-DAMAGE-MODES`,
  ],
  //
  [[`ChildProfile`, `Collapse`, `CollapseMe`], `PARENTTRAITS`],
  [[`Collapse`, `CollapseMe`], `OWNERTRAITS`],
  //
  [[`Formula`, `Cost`], `TRAITS-!ATTRIBUTES-!SKILLS-!SPELLS`],
  [[`Init`, `LevelNames`], `TRAITS-!SKILLS-!SPELLS-!EQUIPMENT`],
  [[`DownTo`], `TRAITS-!EQUIPMENT`],
  [[`DisplayName`, `Invisible`], `SYSTEMTRAITS`],
  // [[], `PERKS`],
  // [[], `FEATURES`],
  // [[], `DISADVANTAGES`],
  // [[], `QUIRKS`],
  [[`Cost`, `default`, `OptSpec`, `Stat`, `Type`], `SKILLS`],
  [[`Cost`, `default`, `OptSpec`, `Stat`, `Type`], `SPELLS`],
  [
    [
      `AddsOrIncreases`,
      `Age`,
      `Appearance`,
      `BodyType`,
      `CharHeight`,
      `CharWeight`,
      `Features`,
      `Hides`,
      `HitTable`,
      `Locks`,
      `Lockstep`,
      `Message`,
      `Owns`,
      `Race`,
      `Removes`,
      `RemovesByTag`,
      `Select`,
      `SelectX`,
      `Sets`,
      `Triggers`,
    ],
    `TEMPLATES`,
  ],
  [[`ammo`, `BaseCost`, `BaseWeight`, `Count`, `Loadout`, `Location`, `TechLvl`, `Where`], `EQUIPMENT`],
  [
    [
      `addmode`,
      `Cost`,
      `Description`,
      `DisplayNameFormula`,
      `DownTo`,
      `ForceFormula`,
      `Formula`,
      `Gives`,
      `Group`,
      `InitMods`,
      `Level`,
      `Mitigator`,
      `Mods`,
      `Name`,
      `NameExt`,
      `Page`,
      `Round`,
      `RoundMods`,
      `ShortLevelNames`,
      `ShortName`,
      `Tier`,
    ],
    `MODIFIERS`,
  ],
  // [[], `GROUPS`],
  // [[], `LISTS`],
  // [[], `BONUSCLASSES`],
  // [[], `WIZARDS`],
]

const tagTypesIndex = {}
for (const [_tags, _types] of _tagsTypesIndex) {
  const types = isArray(_types) ? _types : [_types]
  const tags = _tags.filter(t => t !== ``).map(t => t.toLowerCase())

  for (const tag of tags) {
    if (tagTypesIndex[tag] === undefined) tagTypesIndex[tag] = []
    tagTypesIndex[tag].push(...types)
  }
}
for (const tag in tagTypesIndex) {
  tagTypesIndex[tag] = [...new Set(tagTypesIndex[tag])]
}

class Entry {
  constructor(raw, parent, type) {
    this._raw = raw
    this.parent = parent
    this.type = type

    const tree = Entry.extract(this._raw)
    this._data = Entry.parseEntry(tree.root, tree.nesting)
    this.process()

    this.data._raw = this._raw
  }

  get compoundData() {
    return [...this._data, ...flatten(this._mergeTags ?? [])]
  }

  mergeTags(rawTags) {
    if (this.data._mergeTags === undefined) this.data._mergeTags = []
    if (this._mergeTags === undefined) this._mergeTags = []

    if (this.data._mergeTags.includes(rawTags)) return true

    this.data._mergeTags.push(rawTags)

    const tree = Entry.extract(rawTags)
    this._mergeTags.push(Entry.parseEntry(tree.root, tree.nesting))

    this.process()
  }

  process() {
    this.processBase()
    this.processFeature()
  }

  processBase() {
    const _data = this.compoundData
    // ERROR: there should be no root _data with options (only happens if a NAME get piped)
    if (_data.options) debugger
    this.data = Entry.processProperty({ name: this.type, value: _data })

    // if processed data returned a non-dict, then it is some weirld structure like commands or formulas
    if (!isObjectLike(this.data) || isArray(this.data)) {
      this.data = { body: this.data }
    }

    this.tags = Object.keys(this.data)
    this.data._parent = this.parent
    this.data._type = this.type

    if (isNil(this.data.name)) {
      if (this.data.name?.options) {
        // the entire line is wrapped by parenthesis, and the inside is piped
        // e.g. (SK:Smallsword | SK:Spear | SK:Staff | SK:Two-Handed Sword)

        this.data.name = this.parent
      }
    }
    if (!isNil(this.data.name)) {
      if (this.data.name[0] === `"` && this.data.name[this.data.name.length - 1] === `"`) this.data.name = this.data.name.substring(1, this.data.name.length - 1)
    }
  }

  processFeature() {
    if (this.data._command) return

    this.data._feature = true

    // if (this.data.name === `Fireball`) {
    //   console.log(this)
    //   debugger
    // }
  }

  processType() {
    // determine type based on keys
    const genericTags = [`name`, `isparent`, `x`, `y`, `noresync`, `resync`, `displaycost`, `displayweight`]
    const tags = this.tags.filter(tag => !genericTags.includes(tag))

    // ERROR: No tags means no type
    if (tags.length === 0) {
      debugger
    }

    const tagAnalysis = {}
    const typeAnalysis = {}
    let types = []
    for (const tag of tags) {
      let _types = tagTypesIndex[tag]
      if (_types !== undefined) {
        _types = _types.map(t => extendedTypes[t] ?? t)
        _types = [...new Set(flattenDeep(_types))]

        tagAnalysis[tag] = _types

        types.push(..._types)

        _types.map(type => {
          if (typeAnalysis[type] === undefined) typeAnalysis[type] = []
          typeAnalysis[type].push(tag)
        })
      } else {
        tagAnalysis[tag] = []
      }
    }
    types = [...new Set(types)]

    const typesByMatch = orderBy(
      Object.entries(typeAnalysis).map(([type, _tags]) => ({ type, matches: _tags.length, confidence: _tags.length / tags.length })),
      `matches`,
      [`desc`],
    )

    const e = 1
    const best = typesByMatch[0]
    const silver = typesByMatch[1]

    // ERROR: Trying to process type in a typed entry
    if (this.type !== undefined) {
      debugger
    }

    // ERROR: No match
    if (!best) {
      debugger
    }

    // cannot decide between best matches, mark entry for later search
    if (silver && best.confidence === silver.confidence) {
      const pool = typesByMatch.filter(type => type.confidence === best.confidence)
      this.type = {
        undetermined: true,
        pool,
      }

      // console.log(`  `, `    `, `Undetermined type | `, pool.map(t => `${t.type} (${t.confidence})`).join(` vs `))

      return
    }

    // ERROR: Best match has low confidence level
    if (best.confidence < e) {
      debugger
    }

    this.type = best.type
  }

  static extract(raw) {
    // un-nest parenthesis
    let refereceNesting = {}
    let latest = { entry: raw }
    let level = 0
    do {
      latest = Entry.extractLeaves(latest.entry, level)
      level++
      refereceNesting = { ...refereceNesting, ...latest.index }
    } while (latest.length != 0)

    return {
      root: latest.entry,
      nesting: refereceNesting,
    }
  }

  static extractLeaves(inlineEntry, level = 0) {
    // const _leaf = /(?<!\w (\(\w+)?)\([^\(\)]+\)/g
    const _leaf = /\(([^()]+)\)/g

    let entry = inlineEntry
    const index = {}

    const leaves = [...inlineEntry.matchAll(_leaf)]
    for (let i = leaves.length - 1; i >= 0; i--) {
      const match = leaves[i]
      const length = match[0].length

      const id = `${level}.${i}`
      index[id] = match[0].substring(1, match[0].length - 1)

      entry = `${entry.substring(0, match.index)}<#${id}>${entry.substring(match.index + length)}`
    }

    return {
      entry,
      level,
      index,
      length: leaves.length,
    }
  }

  static parseCommand(entry) {
    const _command = /^#(\w+)/i
    const _rootComma = / *, *(?=(?:[^"]|"[^"]*")*$)/g

    let properties = []
    /**
     *
     * @param name
     * @param value
     * @param parsed
     */
    function add(name, value, parsed = false) {
      properties.push({ name, value, parsed })
    }

    const command = entry.match(_command)
    if (command) {
      const commandName = command[1]
      const commandBody = entry.replace(command[0], ``).trim()

      add(`_command`, true, true)
      add(`name`, commandName)
      add(`body`, commandBody, true)

      // pre-process commands
      if (commandName === `MergeTags`) {
        const _target = / ?in (all)? *"?(.+)"? with "?(.+)"?$/i
        const target = commandBody.match(_target)

        if (target) {
          add(`all`, target[1] !== undefined, true)
          add(`target`, removeLastQuote(target[2]))
          add(`with`, removeLastQuote(target[3]))
        } else {
          // ERROR: Unknown syntax for command
          debugger
        }
      } else if (commandName === `ReplaceTags`) {
        const _target = / ?in "?(.+)"? with "?(.+)"?$/i
        const target = commandBody.match(_target)

        if (target) {
          add(`all`, target[1] !== undefined, true)
          debugger
          add(`target`, removeLastQuote(target[2]))
          add(`with`, removeLastQuote(target[3]))
        } else {
          // ERROR: Unknown syntax for command
          debugger
        }
      } else if (commandName === `Delete`) {
        const _target = /"?(.+)"?$/i
        const target = commandBody.match(_target)

        if (target) {
          add(`target`, removeLastQuote(target[1]))
        } else {
          // ERROR: Unknown syntax for command
          debugger
        }
      } else if (commandName === `Clone`) {
        const _target = /"?(.+)"? as "?(.+)"?$/i
        const target = commandBody.match(_target)

        if (target) {
          add(`target`, removeLastQuote(target[1]))
          add(`as`, removeLastQuote(target[2]))
        } else {
          // ERROR: Unknown syntax for command
          debugger
        }
        // } else if (commandName === `InputReplace`) {
        //   const args = commandBody.split(_rootComma)

        //   args.map((arg, i) => {
        //     add(`arg${i}`, arg)
        //   })
        //   debugger
      } else {
        // ERROR: Unknown command
        console.log(`  `, `    `, `Unknown Command "${commandName}"`)
        add(`args`, commandBody.split(_rootComma))
        // debugger
      }

      return properties
    }

    return false
  }

  static parseEntry(flatEntry, reference, level = 0) {
    const _rootComma = / *, *(?=(?:[^"]|"[^"]*")*$)/g
    const _referencedIndex = /([^,]+)?<#([\d.]+)>/
    const _pipe = / *\| */g

    const piped = level === 0 ? [flatEntry] : flatEntry.split(_pipe)

    const options = []
    for (const _option of piped) {
      let option = _option
      let rawProperties

      // COMMAND
      const command = Entry.parseCommand(_option)
      if (command) {
        rawProperties = command
      } else {
        // REGULAR ENTRY
        rawProperties = option.split(_rootComma).map(o => ({ value: o }))
      }

      const properties = []
      for (const rawProperty of rawProperties) {
        if (rawProperty.parsed) {
          delete rawProperty.parsed
          properties.push(rawProperty)
          continue
        }

        let property

        let workingName = rawProperty.name
        let workingProperties = isArray(rawProperty.value) ? rawProperty.value : [rawProperty.value]
        let resultingProperties = []

        for (let i = 0; i < workingProperties.length; i++) {
          let workingProperty = workingProperties[i]
          let localProperty

          let numberOfPasses = 0
          let referencedIndex
          let lastTreatAsText
          // a text could have multiple parenthesis inside, so there is multiple passes of referencedIndex replacement
          do {
            numberOfPasses++
            referencedIndex = workingProperty.match(_referencedIndex)

            if (referencedIndex) {
              // if there is a referencedIndex inside property, parse it
              let name = referencedIndex[1]
              const value = reference[referencedIndex[2]]

              // debugger
              const valueHasPipe = value.indexOf(`|`) !== -1
              const nameIsLowerCase = name && name.toLowerCase() === name
              const nameIsCommand = name && name[0] === `#`
              const nameIsFormula = name && [`@`, `$`].includes(name[0]) // not all formulas match this variable, btw
              const nameHaveFormulatAtTheEnd = name && name.match(/[@$][a-z]+$/) // first word touching parenthesis is lower case and has a "@" at the beginning (so it doesnt look like a formula looking from the beginning)
              const noSpaceBetweenNameAndValue = name && name[name.length - 1] !== ` ` // no whitespace between name and the opening parenthesis of value
              const nameIsString = isString(name) && !isNumeric(name)
              const noNameAndNoPipedValue = !!(!name && !valueHasPipe) // something like "({value})" or "(10 * 5)"

              const probablyAInlineFormula = nameIsFormula || nameHaveFormulatAtTheEnd
              const probablyAProperty = (nameIsLowerCase || probablyAInlineFormula) && noSpaceBetweenNameAndValue && nameIsString
              const probablyOptions = (name === `` || !name) && valueHasPipe

              let treatAsText = (probablyAInlineFormula || !probablyAProperty) && !nameIsCommand

              // ERROR: There should not be a just text and piped options at the same time
              if (probablyOptions && !probablyAProperty) {
                debugger
              } else {
                const _value = Entry.parseEntry(value, reference, level + 1)

                // cannot just treat as text if, after parsed, value has other shit than ONE value
                if (treatAsText && _value.find(v => Object.values(v).length !== 1) !== undefined) {
                  treatAsText = false
                }

                // ERROR: THERE CAN ONLY BE ONE!!
                if (!treatAsText && numberOfPasses > 1) debugger

                if (treatAsText) {
                  workingProperty = workingProperty.replace(`<#${referencedIndex[2]}>`, `(${_value.map(v => v.value)})`).trim()

                  // since its value is set reusing workingProperty, its ok to overwrite it here
                  // but ONLY if its a chain of treat as text

                  // ERROR: Cannot overwrite localProperty value if it was set as property, not text
                  if (!lastTreatAsText && localProperty?.value !== undefined) debugger

                  // build property
                  localProperty = { value: workingProperty.trim() }
                } else {
                  // just to indicate that this referenced index was already parsed
                  workingProperty = workingProperty.replace(`<#${referencedIndex[2]}>`, `(—)`).trim()

                  // build property
                  localProperty = _value.value === undefined ? { value: _value } : _value
                  if (!isNil(name)) localProperty.name = name.trim()
                }

                lastTreatAsText = treatAsText
              }
            }
          } while (referencedIndex)

          // fallbacking
          if (localProperty === undefined) localProperty = { value: workingProperty.trim() }

          resultingProperties.push(localProperty)
        }

        // collapse resulting properties if possible
        if (resultingProperties.length === 1) property = resultingProperties[0]
        else property = { value: resultingProperties }

        if (workingName !== undefined) {
          // since a workingName was provided for a named property, wrap it around
          if (property.name !== undefined) {
            property = {
              name: workingName,
              value: property,
            }
          } else {
            property.name = workingName
          }
        }

        properties.push(property)
      }

      options.push(properties)
    }

    if (options.length === 1) return options[0]
    else {
      return {
        options: true,
        value: options,
      }
    }
  }

  static processProperty({ name: propertyName, value: properties, ...fields }, level = 0) {
    const data = {}
    const implicit = []

    // ERROR: cannot parse property without name or value
    if (propertyName === undefined && properties === undefined) {
      debugger
    }

    // ERROR: dont know what to do with other fields
    if (Object.keys(fields).length > 0) {
      debugger
    }

    // property value is a primitive, so just send it back
    if (!isArray(properties)) {
      const name = propertyName
      const value = properties

      // ERROR: What to do with a non-number non-string non-bool value ???
      if (!isString(value) && !isNumber(value) && !isBoolean(value)) {
        // ERROR: What to to with a object that is not a nested property
        if (
          !(
            (
              isObjectLike(value) && //
              (Object.keys(value).includes(`name`) || Object.keys(value).includes(`value`)) && // is a nested property, probably for a command
              [`with`].includes(propertyName)
            ) // if it is a command, then these nested properties should be inside a with or similar
          )
        ) {
          debugger
        }
      }

      return value
    }

    const allPropertiesAreImplicit = properties.find(v => v.name !== undefined) === undefined
    const hasExplicitNameInProperties = properties.find(v => v.name === `name`) !== undefined

    const canFirstBeName = !hasExplicitNameInProperties && !(allPropertiesAreImplicit && properties.length > 1)

    for (let i = 0; i < properties.length; i++) {
      const property = properties[i]
      const keys = Object.keys(property)

      let name = property.name
      let value = Entry.processProperty(property, level + 1)

      const onlyKeyIsValue = keys.length === 1 && keys[0] === `value`

      // if there is no explicit name, check if first value is just "value"
      if (canFirstBeName && i === 0 && onlyKeyIsValue) {
        name = `name`
      }

      // light formatting
      if (name === `name`) {
        if (isArray(value)) value = value.join(`, `)
      }

      if (name === undefined) {
        implicit[i] = value
      } else {
        data[name] = value
      }
    }

    const keys = Object.keys(data)

    // if there is only one property inside data, and no implicit
    if (implicit.length === 0) {
      if (keys.length === 1) {
        // if key is name, just return primitive value
        if (keys[0] === `name`) return data[keys[0]]

        // ERROR: There is only one key, but IT IS NOT name
        debugger
      }
    } else if (implicit.length > 0 && keys.length === 0) {
      // all properties are implicit and there is no keys

      // so just return implicit, it propably is just a list of stuff
      return implicit
    } else if (implicit.length > 0) {
      // implicit data treatment
      for (let i = 0; i < implicit.length; i++) {
        const value = implicit[i]
        if (value === undefined) continue
        if (value.match(/^[#@$]/)) {
          // formula or commands are not implicit
          delete implicit[i]
          continue
        }

        let name

        // decide based on propertyName (which, at root, is type) (e.g. propertyName = MODIFIERS or SKILLS)
        if (propertyName === `MODIFIERS`) {
          if (i === 1) name = `modifier`
        } else if ([`ADVANTAGES`, `DISADVANTAGES`, `PERKS`, `QUIRKS`].includes(propertyName)) {
          if (i === 1) name = `cost`
        } else if (propertyName === `SKILLS`) {
          if (i === 1) name = `type`
        } else if (ignoreImplicitForTypes.includes(propertyName)) {
          continue
        }

        if (name !== undefined) {
          if (data[name] !== undefined) {
            // ERROR: There is already a value inside impled name
            debugger
          }

          data[name] = value

          delete implicit[i]
          continue
        }

        // ERROR: Rogue implicit
        debugger
      }

      if (implicit.filter(v => v !== undefined).length > 0) {
        // ERROR: There cannot be any implicit data
        //      here is commented because im choosing to ignore some implicit in certain types, its too much work to find them all for now
        //      but i still wanna save them as implicit in case something pops out into the light in the future
        // debugger
        data._ = implicit
      }
    }

    return data
  }
}

module.exports = Entry
