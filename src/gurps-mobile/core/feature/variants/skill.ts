/* eslint-disable no-debugger */
import { camelCase, flatten, flattenDeep, get, has, isArray, isEmpty, isNil, max, maxBy, omit, orderBy, pick, set, sortBy, sum, transform, uniq, uniqBy, upperFirst } from "lodash"

import { specializedName } from "../utils"

import { GurpsMobileActor } from "../../../foundry/actor"
import BaseFeature, { FeatureTemplate } from "../base"
import GenericFeature from "./generic"
import SkillFeatureCompilationTemplate from "../compilation/templates/skill"
import { FEATURE } from "../type"
import type { GCA } from "../../gca/types"
import { ISkillFeature } from "../compilation/templates/skill"
import { SkillManualSource } from "../compilation/templates/skill"
import { compareComponent } from "../../../../gurps-extension/utils/component"
import { GURPS4th } from "../../../../gurps-extension/types/gurps4th"
import { ILevel } from "../../../../gurps-extension/utils/level"

export default class SkillFeature extends GenericFeature implements ISkillFeature {
  attribute: string
  difficulty: string
  points: number
  training: `trained` | `untrained` | `unknown`
  defaultFrom: object[]
  proxy?: boolean
  form: false | `art` | `sport`


  /**
   * Instantiate new Skill Feature
   */
  constructor(key: string | number, prefix = `system.skills.`, parent: BaseFeature | null = null, template: FeatureTemplate<any>) {
    super(key, prefix, parent, template)
    this.addCompilation(SkillFeatureCompilationTemplate)
  }

  /**
   * Returns best level for skill
   */
  level(attribute: GURPS4th.AttributesAndCharacteristics) {
    const actor = this._actor
    // ERROR: Unimplemented, cannot calculate skill level without actor
    if (!actor) debugger

    const actorComponents = actor.getComponents(`skill_bonus`, component => compareComponent(component, this))
    const actorBonus = sum(actorComponents.map(component => component.amount ?? 0))

    const baseAttribute = attribute ?? this.attribute

    if (this.training === `trained`) {
      // ERROR: Unimplemented
      if (this.levels === undefined) debugger

      // ERROR: Unimplemented wildcard
      if (this.name[this.name.length - 1] === `!`) debugger

      const skillCache = actor.cache._skill?.trained
      const trainedSkills = flatten(Object.values(skillCache ?? {}).map(idMap => Object.values(idMap)))
      const trainedSkillsGCA = trainedSkills.map(skill => skill.__compilation.sources.gca?._index).filter(index => !isNil(index)) as number[]

      for (const _default of this.levels) {
        const targets = Object.values(_default.targets ?? {})
        const compatibleTargets = targets.map(target => {
          if (target.type !== `skill`) return true

          // check if all skills are trained
          const skills = target.value as number[]
          if (!skills || skills?.length === 0) return false

          debugger
          return skills.every(skill => trainedSkillsGCA.includes(skill))
        })

        // all targets are compatible, it is possible to use this default to calculate
        if (targets.length === compatibleTargets.length) {
          let baseLevel
          if (targets.every(target => target.type === 'attribute' && target.value === ))

          let { level, relative } = _default.parse(this, actor) ?? {}

          // ERROR: Unimplemented
          if (level === undefined) debugger
          if (this.points < 0) debugger
          if (this.points === 0) debugger

          const difficultyDecrease = { E: 0, A: 1, H: 2, VH: 3 }[this.difficulty] ?? 0

          // Skill Cost Table, B 170
          //    negative points is possible?
          let boughtIncrease_curve = { 4: 2, 3: 1, 2: 1, 1: 0 }[this.points] ?? (this.points > 4 ? 2 : 0) // 4 -> +2, 2 -> +1, 1 -> +0
          let boughtIncrease_linear = Math.floor((this.points - 4) / 4) // 8 -> +3, 12 -> +4, 16 -> +5, 20 -> +6, ..., +4 -> +1
          const boughtIncrease = boughtIncrease_curve + boughtIncrease_linear

          const modifier = boughtIncrease - difficultyDecrease
          const baseLevel = (level as number) + modifier

          const totalLevel = baseLevel + actorBonus
          if (actorBonus !== 0) debugger

          debugger
        }
      }
    }

    return super.level()
  }

  // INTEGRATING
  integrate(actor: GurpsMobileActor) {
    super.integrate(actor)

    // index by name and specializedName for quick reference
    if (!this.container) {
      if (this.training !== `unknown`) {
        actor.setCache(`_${this.type.value}.${this.training}.${this.specializedName}.${this.id}`, this)
        actor.setCache(`_${this.type.value}.${this.training}.${this.name}.${this.id}`, this)
      }

      if (this.__compilation.sources.gca) actor.setCache(`gca.skill.${this.__compilation.sources.gca._index}`, this)
    }

    return this
  }

  // GENERATORS
  static untrained(actor: GurpsMobileActor, template: FeatureTemplate<SkillManualSource>) {
    if (!template.factory) throw new Error(`Missing factory on untrained call`)

    const trainedSkillIndex = actor.cache._skill?.trained ?? {}
    const trainedSkills = flatten(Object.values(trainedSkillIndex).map(skillsById => Object.values(skillsById)))
    const trainedSkillsGCAIndex = trainedSkills.map(feature => feature.__compilation.sources.gca?._index)

    // extract a list of all untrained skills with viable SKILL defaults
    const untrainedSkills = {} as Record<
      string,
      {
        _index: number
        _skill: string
        _from: string | string[]
        _text: string
        _source: number
        from: number | string
        tl?: number
      }[]
    >
    for (const skillFeature of trainedSkills) {
      const gcaIndex = skillFeature.__compilation.sources.gca?._index as number

      // ERROR: Unimplemented
      // eslint-disable-next-line no-debugger
      if (gcaIndex === undefined) debugger

      const defaultOf = GCA.index.bySection.SKILLS.byDefault[gcaIndex]
      if (defaultOf === undefined) continue // no skill default to feature

      // other skills that default o skillFeature
      // defaultOf.map(({skill}) => GCA.entries[skill])

      // math expressions for defaulting
      // defaultOf.map(({skill, source}) => GCA.entries[skill].default[source])

      for (let i = 0; i < defaultOf.length; i++) {
        const { skill: untrainedIndex, source, text } = defaultOf[i]

        // skill is already trained
        if (trainedSkillsGCAIndex.includes(untrainedIndex)) continue
        if (untrainedSkills[untrainedIndex] === undefined) untrainedSkills[untrainedIndex] = []

        untrainedSkills[untrainedIndex].push({
          _index: i,
          _skill: specializedName(GCA.entries[untrainedIndex]),
          _from: skillFeature.specializedName,
          _text: text,
          _source: source,
          from: gcaIndex,
          tl: skillFeature.tl?.level,
        })
      }
    }
    const untrainedSkillsGCAIndex = Object.keys(untrainedSkills).map(s => parseInt(s))

    // extract a list of all untrained skills with viable ATTRIBUTE defaults (that arent already in untrainedSkills)
    const attributes = [`ST`, `DX`, `IQ`, `HT`, `Will`, `Per`, `Dodge`]
    for (const attribute of attributes) {
      let defaults = GCA.index.bySection.SKILLS.byDefaultAttribute[attribute] ?? GCA.index.bySection.SKILLS.byDefaultAttribute[upperFirst(attribute)]
      // defaults = defaults.filter(d => GCA.index.bySection.SKILLS.byName[`Shield`].includes(d.skill))

      // check the ones that are ONLY defaulted to attributes
      const onlyAttributes = defaults.filter(_default => {
        const skill = GCA.entries[_default.skill]
        const targetsList = skill.default.map(skillDefault => Object.values(skillDefault.targets ?? {}))

        for (const targets of targetsList) {
          if (targets.length === 0) continue
          const attributeOnlyTargets = targets.filter(target => target.type === `attribute`)
          if (attributeOnlyTargets.length === targets.length) return true
        }

        return false
      })

      // if onlyAttributes.length === 0, there is NO skills that default to this attribute only

      const onlyUntrained = onlyAttributes.filter(_default => !trainedSkillsGCAIndex.includes(_default.skill))
      const onlyNewUntrained = onlyUntrained.filter(_default => !untrainedSkillsGCAIndex.includes(_default.skill))
      const skillsAndTechniques = onlyNewUntrained.map(_default => [_default, GCA.entries[_default.skill]] as const)
      const skills = skillsAndTechniques.filter(([_default, trait]) => !trait.type?.match(/^(Tech|Combo)/i))

      if (skills.length === 0) continue

      for (let i = 0; i < skills.length; i++) {
        const [_default, untrainedSkillEntry] = skills[i]
        const { skill: untrainedIndex, source, text } = _default

        // skill is already trained
        if (trainedSkillsGCAIndex.includes(untrainedIndex)) continue
        if (untrainedSkills[untrainedIndex] === undefined) untrainedSkills[untrainedIndex] = []

        untrainedSkills[untrainedIndex].push({
          _index: i,
          _skill: specializedName(untrainedSkillEntry),
          _from: attribute,
          _text: text,
          _source: source,
          from: attribute,
          tl: parseInt(actor.system.traits.techlevel),
        })
      }
    }

    // instantiate these defaulted skills
    //    each "default definition" (set of rules to determine skill level for skill) should have ALL necessary information for its calculation
    //    NOTHING from outside the definition can be used in the computation of final skill level

    const features = [] as SkillFeature[]
    for (const [skillIndex, sources] of Object.entries(untrainedSkills)) {
      const skill = GCA.entries[skillIndex]

      // TODO: Special treatment for elixirs (ointments)
      if (skill.ointment === `X`) continue

      const tls = uniq(sources.map(source => source.tl).filter(tl => !isNil(tl)))

      // ERROR: Unimplemented
      if (tls.length > 1) debugger

      const skillTemplate: FeatureTemplate<SkillManualSource> = {
        ...omit(template, [`manual`]),
        manual: {
          ...get(template, `manual`, {}),
          id: () => `gca-${skillIndex}`,
          // ignoreSpecialization: !!ignoreSpecialization,
          training: `untrained`,
        },
      }

      if (tls.length === 1) skillTemplate.manual.tl = () => tls[0]

      const newFeature = template.factory
        .build(`skill`, skillIndex, `untrainedSkills.`, null, skillTemplate) //
        .addSource(`gca`, skill)
        .compile() as SkillFeature

      features.push(newFeature)
    }

    return features
  }

  static all(actor: GurpsMobileActor, template: FeatureTemplate) {
    // TODO: implement byDefaultAttribute with this shit

    // pre-process indexes for trained/untrained skills
    const trainedSkills = Object.fromEntries(
      flatten(Object.values(actor.cache._skill?.trained ?? {}).map(features => Object.values(features).map(feature => [feature.__compilation.sources.gca._index, feature]))),
    )
    const untrainedSkills = Object.fromEntries(
      flatten(Object.values(actor.cache._skill?.untrained ?? {}).map(features => Object.values(features).map(feature => [feature.__compilation.sources.gca._index, feature]))),
    )

    const skills = {} as Record<string, { base?: GCA.IndexedSkill; trained?: SkillFeature[]; untrained?: SkillFeature[] }>
    // index all skills as base
    for (const [name, skill] of Object.entries(GCA.allSkills.index)) set(skills, [name, `base`], skill)

    // index trained/untrained skills
    //    trained -> character has "formal training", i.e. some level bought with points
    //    untrained -> character doesnt have "formal training", but other skill influentiates it, i.e. default of skill is trained
    //    other -> any skill not trained or untrained
    for (const [index, feature] of Object.entries(trainedSkills)) {
      const name = feature.name
      if (skills[name] === undefined) skills[name] = {}
      if (skills[name].trained === undefined) skills[name].trained = []

      // @ts-ignore
      skills[name].trained.push(feature)
    }

    for (const [index, feature] of Object.entries(untrainedSkills)) {
      const name = feature.name
      if (skills[name] === undefined) skills[name] = {}
      if (skills[name].untrained === undefined) skills[name].untrained = []

      // @ts-ignore
      skills[name].untrained.push(feature)
    }

    // create missing entries
    const features = {} as Record<string, SkillFeature>
    for (const [name, { base, trained, untrained }] of Object.entries(skills)) {
      const trainedOrUntrained = trained || untrained
      if (trainedOrUntrained && trainedOrUntrained.length > 0) {
        // // ERROR: Unimplemented
        // if (trainedOrUntrained.length > 1) debugger

        // TODO: How to deal with multiple specializations?

        features[name] = trainedOrUntrained[0]
        continue
      }

      // ERROR: Unimplemented
      if (base === undefined) debugger
      if (base === undefined) continue

      const skillTemplate: FeatureTemplate<SkillManualSource> = {
        ...omit(template, [`manual`]),
        manual: {
          ...get(template, `manual`, {}),
          id: () => `proxy-gca-${base.skill}`,
          ignoreSpecialization: () => base.ignoreSpecialization,
          proxy: () => true,
          training: `unknown`,
        },
      }

      const tl = parseInt(actor.system.traits.techlevel)

      const feature = template.factory
        .build(`skill`, base.skill, `gca.skills.`, null, skillTemplate) //
        .addSource(`gca`, GCA.entries[base.skill])
        .compile({ tl }) as SkillFeature

      // TODO: Skill from ALL should have actor linked?
      feature._actor = actor

      features[name] = feature
    }

    return features
  }
}
