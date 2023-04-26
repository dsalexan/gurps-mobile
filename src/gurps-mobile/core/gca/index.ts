/* eslint-disable no-useless-escape */
/* eslint-disable no-debugger */
import { isNil, isObjectLike, isArray, get, flattenDeep, remove, zip, flatten, sortBy, orderBy, isElement, isEmpty, isString, isEqual, uniqBy, cloneDeep } from "lodash"
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
  source: `byName` | `byNameExt` | `byFullname`
  sourceWeight: number
  type: _GCA.Section
  typeWeight: number
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
          return [
            key,
            {
              byName: new Fuse(Object.keys(section.byName), { includeScore: true }),
              byNameExt: new Fuse(Object.keys(section.byNameExt), { includeScore: true }),
              byFullname: new Fuse(Object.keys(section.byFullname), { includeScore: true }),
            },
          ]
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

    const logger = LOGGER.get(`gca`)
    const timer = logger.openGroup(true).info(`Pre-Compile All GCA Skills`, [`color: rgba(0, 0, 0, 0.5); font-weight: regular; font-style: italic;`]).time(`compileAllGCASkills`)

    const byName = this.index.bySection.SKILLS.byName
    for (const [name, skillsAndTechniques] of Object.entries(byName)) {
      if (name.substring(0, 4) === `_New` || name.substring(0, 4) === `New `) continue

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
    }

    window.FeatureFactory.startCompilation()

    timer.group()(`Pre-Compile All GCA Skills`, [`font-weight: bold;`])

    return {
      index,
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
    return types.map(type => {
      const byName = this.fuse.bySection[type].byName.search(name)
      const byFullname = specializedName ? this.fuse.bySection[type].byFullname.search(specializedName) : []

      const typeMatches = [
        ...byName.map(r => ({ ...r, source: `byName`, sourceWeight: 0, type, typeWeight: weight })),
        ...byFullname.map(r => ({ ...r, source: `byFullname`, sourceWeight: 1, type, typeWeight: weight })),
      ]

      return typeMatches as SearchResult[]
    })
  }

  query({ name, specializedName, type: _types }: { name: string; specializedName?: string; type?: Feature.TypeID | Feature.TypeID[] }): _GCA.Entry | null {
    const mainTypes = _types ? this.getType(_types) : []
    const alternativeTypes = _types ? this.getAlternativeType(mainTypes) : []

    if (isNil(mainTypes)) debugger
    if (isNil(alternativeTypes)) debugger

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

    // @ts-ignore
    const allMatches = flattenDeep([this.search(name, specializedName, mainTypes), this.search(name, specializedName, alternativeTypes, 1)]) as SearchResult[]
    const matches = orderBy(allMatches, [`score`, `sourceWeight`, `typeWeight`], [`asc`, `desc`, `desc`])
    const best = matches[0]

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
    if (best.score === matches[1].score) {
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

    const entries = index.map(i => ({ ...this.entries[i], _index: i })).filter(entry => entry.section === best.type)

    // NO ENTRIES WITH CORRECT TYPE
    if (entries.length === 0) debugger

    // TREAT MULTIPLE ENTRIES
    return this.decide(entries, matches, name, specializedName, mainTypes, alternativeTypes) ?? null
  }

  decide(
    entries: _GCA.Entry[],
    matches: SearchResult[],
    name: string,
    specializedName: string | undefined,
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
        else debugger
      } else if (sendNoSpecialization) return entries.find(entry => isNil(entry.nameext) || isEmpty(entry.nameext))
      else debugger
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
