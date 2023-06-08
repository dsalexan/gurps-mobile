/* eslint-disable no-useless-escape */
/* eslint-disable no-debugger */
import {
  isNil,
  isObjectLike,
  isArray,
  get,
  flattenDeep,
  remove,
  zip,
  flatten,
  sortBy,
  orderBy,
  isElement,
  isEmpty,
  isString,
  isEqual,
  uniqBy,
  cloneDeep,
  intersection,
  groupBy,
  filter,
} from "lodash"
import { isNilOrEmpty } from "utils/lodash"
import Fuse from "fuse.js"

import type { GCA as _GCA } from "./types"
import LOGGER from "../../logger"
import * as Feature from "../feature"
import { derivation, proxy } from "../../foundry/actor/feature/pipelines"
import { MERGE } from "../feature/compilation/migration"
import { ISkillFeatureData, SkillManualSource } from "../../foundry/actor/feature/pipelines/skill"
import SkillFeature from "../../foundry/actor/feature/skill"
import SkillFeatureContextTemplate from "../../foundry/actor-sheet/context/feature/variants/skill"

type SearchResult = {
  type: _GCA.Section
  source: `byName` | `byNameExt` | `byFullname` | `byGroup`
  group: string
  weight: number
  item: string
  refIndex: number
  score: number
  matches?: readonly Fuse.FuseResultMatch[] | undefined
}

export default class GCAManager {
  e: number

  cache: Record<string, _GCA.Entry | null>

  entries: Record<string | number, _GCA.Entry>
  index: _GCA.CompletePreCompiledIndex<Record<string, number[]>>

  fuse: _GCA.BarebonesPreCompiledIndex<Fuse<string>>
  types: _GCA.Section[]
  skills: {
    index: Record<string, _GCA.IndexedSkill>
    byId: Record<string, SkillFeature>
    list: _GCA.IndexedSkill[]
    fuse: Fuse<string>
  }

  _names: any
  _type_index: any
  type_index: any
  excludeBooks: any
  books: any
  excludeBooksByType: any

  constructor() {
    this.e = 0.0075

    this.cache = {}

    this.entries = window.GCA_ENTRIES
    this.index = window.GCA_INDEX

    this.fuse = {
      byName: new Fuse(Object.keys(this.index.byName), { includeScore: true }),
      byNameExt: new Fuse(Object.keys(this.index.byNameExt), { includeScore: true }),
      byFullname: new Fuse(Object.keys(this.index.byFullname), { includeScore: true }),
      bySection: Object.fromEntries(
        (Object.keys(this.index.bySection) as _GCA.Section[]).map(key => {
          const section = this.index.bySection[key]

          const bySection = {
            byName: new Fuse(Object.keys(section.byName), { includeScore: true }),
            byNameExt: new Fuse(Object.keys(section.byNameExt), { includeScore: true }),
            byFullname: new Fuse(Object.keys(section.byFullname), { includeScore: true }),
          }

          if (key === `MODIFIERS`) {
            bySection.allGroups = new Fuse(Object.keys(section.byGroup), { includeScore: true })

            bySection.byGroup = {}
            for (const [group, indexes] of Object.entries(section.byGroup)) {
              const entries = indexes.map(index => this.entries[index])

              const names = groupBy(entries, entry => entry.name)
              const nameexts = groupBy(entries, entry => entry.nameext)
              const fullnames = groupBy(entries, entry => `${entry.name}${entry.nameext ? ` (${entry.nameext})` : ``}`)

              section.byGroup[group] = {
                byName: Object.fromEntries(Object.entries(names).map(([name, entries]) => [name, entries.map(entry => entry._index)])),
                byNameExt: Object.fromEntries(Object.entries(nameexts).map(([name, entries]) => [name, entries.map(entry => entry._index)])),
                byFullname: Object.fromEntries(Object.entries(fullnames).map(([name, entries]) => [name, entries.map(entry => entry._index)])),
              }

              bySection.byGroup[group] = {
                byName: new Fuse(Object.keys(names), { includeScore: true }),
                byNameExt: new Fuse(Object.keys(nameexts), { includeScore: true }),
                byFullname: new Fuse(Object.keys(fullnames), { includeScore: true }),
              }
            }
          }

          return [key, bySection]
        }),
      ) as Record<_GCA.Section, { byName: Fuse<string>; byNameExt: Fuse<string>; byFullname: Fuse<string> }>,
    }

    this.types = Object.keys(this.index.bySection) as _GCA.Section[]
    this.skills = this.compileAllGCASkills()
  }

  /**
   * Compile all GCA skills into a single index for searching purposes
   */
  compileAllGCASkills() {
    const index = {} as Record<string, _GCA.IndexedSkill>
    const byId = {} as Record<string, SkillFeature>

    const logger = LOGGER.get(`gca`)
    const timer = logger.openGroup(true).info(`Pre-Compile All GCA Skills`, [`color: rgba(0, 0, 0, 0.5); font-weight: regular; font-style: italic;`]).time(`compileAllGCASkills`)

    const byName = this.index.bySection.SKILLS.byName
    for (const [name, skillsAndTechniques] of Object.entries(byName)) {
      if (name.substring(0, 4) === `_New` || name.substring(0, 4) === `New `) continue

      for (const trait of skillsAndTechniques) {
        if (this.entries[trait].type === undefined) debugger
        if (this.entries[trait].type?.match === undefined) debugger
      }
      // TODO: Deal with techniques/combos/imbuements
      const skills = skillsAndTechniques.filter(trait => !this.entries[trait].type?.match(/^(Tech|Combo|Imbue)/i)).map(skill => ({ skill, entry: this.entries[skill] }))
      if (skills.length === 0) continue

      const specializations = skills.filter(skill => skill.entry.nameext)
      const nonSpecializations = skills.filter(skill => isNilOrEmpty(skill.entry.nameext))
      const ignoreSpecialization = specializations.length > 1 || (specializations.length === 1 && nonSpecializations.length > 0)

      // ERROR: Unimplemented
      if (nonSpecializations.length > 1) debugger
      if (!window.FeatureFactory) debugger

      const id = `proxy-gca-${skills[0].skill}`
      const manual = { proxy: true } as SkillManualSource

      const feature = window.FeatureFactory.build(`skill`, id, skills[0].skill, undefined, { context: { templates: SkillFeatureContextTemplate } })
        .addPipeline<ISkillFeatureData>([proxy.manual(`proxy`)])
        .addSource(`manual`, manual, { delayCompile: true })
        .addSource(`gca`, this.entries[skills[0].skill])

      // aggregate specializations
      const indexedSkill: _GCA.IndexedSkill = {
        proxy: feature as any as SkillFeature,
        id,
        name,
        skill: skills[0].skill,
        // entry: skills[0].entry,
        ignoreSpecialization,
        specializations: ignoreSpecialization ? specializations.map(skill => skill.skill) : [],
        _specializations: ignoreSpecialization ? specializations.map(skill => skill.entry.nameext) : [],
      }

      index[name] = indexedSkill
      byId[id] = feature as any as SkillFeature
    }

    window.FeatureFactory.startCompilation()

    timer.group()(`Pre-Compile All GCA Skills`, [`font-weight: bold;`])

    return {
      index,
      byId,
      list: Object.values(index),
      fuse: new Fuse(Object.keys(index), { includeScore: true }),
    }
  }

  //
  getType(_type: Feature.TypeID | Feature.TypeID[]) {
    const typeArray = isArray(_type) ? _type : [_type]

    // treat GURPS Mobile type -> GCA Section types
    const treatedTypes = flatten(
      typeArray.map(type => {
        if (type === `generic_advantage`) return [`advantage`, `disadvantage`]
        else if (type === `spell_as_power`) return [`advantage`]
        return type
      }),
    ) as Feature.TypeID[]

    // pluralize and yield errors if missing
    return treatedTypes.map(lowerType => {
      let type = lowerType.toUpperCase() as _GCA.Section

      if (!this.types.includes(type)) {
        // if type is missing
        // check if arg is singular
        if (type[type.length - 1] !== `S`) {
          type = `${type}S` as _GCA.Section
          if (!this.types.includes(type)) debugger
          if (!this.types.includes(type)) throw new Error(`Type "${type}" is missing in GCA extraction`)
        } else {
          throw new Error(`Type "${type}" is missing in GCA extraction`)
        }
      }

      return type
    })
  }

  getAlternativeType(types: _GCA.Section[]) {
    return flatten(
      types.map(t => {
        if ([`ADVANTAGES`, `DISADVANTAGES`, `PERKS`, `QUIRKS`].includes(t)) return [`CULTURES`] as _GCA.Section[]
        return []
      }),
    ).filter((value, index, array) => array.findIndex(v2 => value === v2) === index)
  }

  search(name: string, specializedName: string | undefined, types: _GCA.Section[], weight = 0): SearchResult[][] {
    const resultsByType = [] as SearchResult[][]

    for (const type of types) {
      let byName: Fuse.FuseResult<string>[]
      let byFullname: Fuse.FuseResult<string>[]

      if (type === `any`) {
        byName = this.fuse.byName.search(name)
        byFullname = specializedName ? this.fuse.byFullname.search(specializedName) : []
      } else {
        byName = this.fuse.bySection[type].byName.search(name)
        byFullname = specializedName ? this.fuse.bySection[type].byFullname.search(specializedName) : []
      }

      const typeMatches = [
        ...byName.map(r => ({ ...r, source: `byName`, sourceWeight: 0, type, typeWeight: weight })),
        ...byFullname.map(r => ({ ...r, source: `byFullname`, sourceWeight: 1, type, typeWeight: weight })),
      ]

      resultsByType.push(typeMatches as SearchResult[])
    }

    return resultsByType
  }

  search2(source: string, query: string, types: (_GCA.Section | `any`)[], weight = 0): SearchResult[][] {
    const resultsByType = [] as SearchResult[][]

    for (const type of types) {
      let result: Fuse.FuseResult<string>[]

      if (type === `any`) {
        result = this.fuse[source].search(query)
      } else {
        result = this.fuse.bySection[type][source].search(query)
      }

      const typeMatches = result.map(r => ({ ...r, source, type, weight }))

      resultsByType.push(typeMatches as SearchResult[])
    }

    return resultsByType
  }

  query({
    name,
    specializedName,
    groups,
    type: _types,
  }: {
    name: string
    specializedName?: string
    groups?: string[]
    type?: Feature.TypeID | Feature.TypeID[]
  }): _GCA.Entry | null {
    let mainTypes = _types ? this.getType(_types) : []
    const alternativeTypes = _types ? this.getAlternativeType(mainTypes) : []

    if (isNil(mainTypes)) debugger
    if (isNil(alternativeTypes)) debugger

    // if (mainTypes.length === 0) debugger
    if (mainTypes.length === 0) mainTypes = [`any`]

    const weightedSections = mainTypes.map(section => [0, section]) as [number, _GCA.Section][]
    if (alternativeTypes.length > 0) weightedSections.push(...(alternativeTypes.map(section => [100, section]) as [number, _GCA.Section][]))

    // name0 @ types
    //   (if imperfect matching) name0 @ alternative types
    //   (if imperfect matching) name1 @ types
    //   (if imperfect matching) name1 @ alternative types
    //   ...

    // const protocols = flatten(
    //   names.map(name => {
    //     const protocol = [{ query: name, types: mainTypes }]
    //     if (useAlternativeTypes) protocol.push({ query: name, types: alternativeTypes })
    //     return protocol
    //   }),
    // )

    // for each protocol, search fuse names in type-related indexes

    // PROTOTYPE
    //    fuse by name

    const indexes = [] as { fuse: Fuse<string>; type: _GCA.Section; source: string; query: string; weight: number; group?: string }[]
    for (const [weight, section] of weightedSections) {
      let preCompiledIndex = this.fuse
      if (section !== `any`) preCompiledIndex = this.fuse.bySection[section]

      if (!preCompiledIndex) debugger

      indexes.push({ fuse: preCompiledIndex.byName, type: section, source: `byName`, query: name, weight: weight + 0 })
      if (specializedName) indexes.push({ fuse: preCompiledIndex.byFullname, type: section, source: `byFullname`, query: specializedName, weight: weight + 1 })

      if (section === `MODIFIERS` && !isNilOrEmpty(groups)) {
        for (const groupQuery of groups) {
          const groupResults = this.fuse.bySection[`MODIFIERS`].allGroups.search(groupQuery)
          const best = groupResults[0]

          // NO MATCH/IMPERFECT MATCHING for group
          if (!best || best.score > this.e) {
            LOGGER.warn(`gca`, !best ? `No match for group` : `Imperfect matching for group`, `"${groupQuery}"`, `from entry`, `"${specializedName ?? name}"`, groupResults, [
              `color: #826835;`,
              `color: rgba(130, 104, 53, 60%); font-style: italic;`,
              `color: black; font-style: regular; font-weight: bold`,
              `color: rgba(130, 104, 53, 60%); font-style: italic;`,
              `color: black; font-style: regular; font-weight: bold`,
              ``,
            ])
            return null
          }

          const group = best.item

          preCompiledIndex = this.fuse.bySection[`MODIFIERS`].byGroup[group]

          if (!preCompiledIndex) debugger

          indexes.push({ fuse: preCompiledIndex.byName, type: section, source: `byName`, query: name, group, weight: weight + 10 + 0 })
          if (specializedName) indexes.push({ fuse: preCompiledIndex.byFullname, type: section, source: `byFullname`, query: specializedName, group, weight: weight + 10 + 1 })
        }
      }
    }

    const allMatches = indexes.map(index => {
      const results = index.fuse.search(index.query)

      const searchResults = [] as SearchResult[]
      for (const result of results) {
        const searchResult = {
          ...result,
          type: index.type,
          source: index.source,
          group: index.group,
          weight: index.weight,
        } as SearchResult

        searchResults.push(searchResult)
      }

      return searchResults
    })

    const matches = orderBy(allMatches.flat(), [`score`, `weight`], [`asc`, `desc`])
    const best = matches[0]

    // if (name === `Affliction)`) debugger
    if (weightedSections.filter(([weight, section]) => section === `MODIFIERS`).length > 1) debugger

    // NOT MATCH
    if (isNil(best)) {
      LOGGER.warn(`gca`, `No match for entry`, `"${name}"`, matches, [
        `color: #826835;`,
        `color: rgba(130, 104, 53, 60%); font-style: italic;`,
        `color: black; font-style: regular; font-weight: bold`,
        ``,
      ])
      return null
    }

    // IMPERFECT MATCHING
    if (best.score > this.e) {
      LOGGER.warn(`gca`, `Imperfect matching for entry`, `"${name}"`, matches, [
        `color: #826835;`,
        `color: rgba(130, 104, 53, 60%); font-style: italic;`,
        `color: black; font-style: regular; font-weight: bold`,
        ``,
      ])
      return null
    }

    // multiple match warning
    if (best.score === matches[1].score && best.weight === matches[1].weight) {
      if (!!specializedName && best.source !== matches[1].source) {
        // do nothing
      } else {
        LOGGER.warn(`gca`, `Multiple best match for entry`, `"${name}"`, matches, [
          `color: #826835;`,
          `color: rgba(130, 104, 53, 60%); font-style: italic;`,
          `color: black; font-style: regular; font-weight: bold`,
          ``,
        ])
        debugger
      }
    }

    // pack it and ship it
    const index = this.index[best.source][best.item]

    const entries = [] as _GCA.Entry[]
    for (const i of index) {
      const entry = this.entries[i]
      entry._index = i

      const anyType = best.type === `any`
      const matchingType = entry.section === best.type

      const groupMatters = best.type === `MODIFIERS` && !isNilOrEmpty(best.group)
      const matchingGroup = groupMatters ? entry.group === best.group : true

      if (anyType || (matchingType && matchingGroup)) entries.push(entry)
    }
    // const entries = index.map(i => ({ ...this.entries[i], _index: i })).filter(entry => best.type === `any` || entry.section === best.type)

    // NO ENTRIES WITH CORRECT TYPE
    if (entries.length === 0) debugger

    // TREAT MULTIPLE ENTRIES
    return this.decide(entries, matches, name, specializedName, groups, mainTypes, alternativeTypes) ?? null
  }

  decide(
    entries: _GCA.Entry[],
    matches: SearchResult[],
    name: string,
    specializedName: string | undefined,
    groups: string[] | undefined,
    mainTypes: _GCA.Section[],
    alternativeTypes: _GCA.Section[],
  ): _GCA.Entry | undefined {
    if (entries.length === 1) return entries[0]
    else {
      const matchingSpecialization = !!specializedName && entries.find(entry => Feature.Utils.specializedName(entry.name, entry.nameext) === specializedName)

      const onlyOneIsNotSpecialized = entries.filter(entry => isNil(entry.nameext) || isEmpty(entry.nameext)).length === 1
      const oneOfThemIsSpecialized = entries.some(entry => !isNil(entry.nameext) && !isEmpty(entry.nameext))

      const onesWithMandatorySpecialization = entries.filter(entry => entry.specializationRequired)

      const sendMandatorySpecialization = onesWithMandatorySpecialization.length > 0
      const sendNoSpecialization = oneOfThemIsSpecialized && !matchingSpecialization && onlyOneIsNotSpecialized

      // // WARNING: how to deal with multiple types here?
      // if (mainTypes.length > 1) debugger
      // if (alternativeTypes.length >= 1) debugger

      if (sendMandatorySpecialization) {
        const onesWithMandatorySpecializationAndNameExt = onesWithMandatorySpecialization.filter(entry => !isNilOrEmpty(entry.nameext))
        if (onesWithMandatorySpecializationAndNameExt.length === 1) return onesWithMandatorySpecializationAndNameExt[0]
        else if (onesWithMandatorySpecialization.length === 1) return onesWithMandatorySpecialization[0]
        else {
          // ERROR: Too many mandatory specialization options
          debugger
        }
      } else if (sendNoSpecialization) return entries.find(entry => isNil(entry.nameext) || isEmpty(entry.nameext))

      // test for ointments bother
      const anyType = mainTypes.some(type => type === `any`)
      const nonPotions = entries.filter(entry => !(entry.section === `EQUIPMENT` && intersection([`Potion`, `Ointment`], entry.mods).length > 0))

      const sendNonPotions = anyType && nonPotions.length > 0

      if (sendNonPotions) {
        if (nonPotions.length === 1) return nonPotions[0]
        else {
          // ERROR: Too many non-potions options
          debugger
        }
      }

      // test for generic groups in modifiers
      const areModifiers = mainTypes.some(type => type === `MODIFIERS`) || alternativeTypes.some(type => type === `MODIFIERS`)
      if (areModifiers) {
        const entryGroups = entries.map(entry => entry.group)

        const overlapingGroups = intersection(groups ?? [], entryGroups)

        if (overlapingGroups.length > 0) {
          // ERROR: There is a overlap, why are we here?
          debugger
        }

        const genericGroups = entries.filter(entry => entry.group.startsWith(`_`))
        if (genericGroups.length === 1) return genericGroups[0]

        // too many generic group option, thin the herd
        const isGroupAttack = groups?.some(group => group.match(/attack/i))
        if (isGroupAttack) {
          const genericAttackGroups = genericGroups.filter(entry => entry.group.match(/attack/i))
          if (genericAttackGroups.length === 1) return genericGroups[0]

          // ERROR: Too many generic attack group options
          debugger
        }

        // ERROR: Too many generic group options
        debugger
      }

      // ERROR: Unimplemented decision tree
      debugger
    }

    return undefined
  }

  // CACHE
  getCache(id: string): _GCA.Entry | null {
    return this.cache[id]
  }
  setCache(id: string, object: _GCA.Entry | null) {
    if (object !== undefined) this.cache[id] = object
  }
  removeCache(id: string) {
    delete this.cache[id]
  }
}
