import { camelCase, flatten, flattenDeep, get, has, isArray, isEmpty, isNil, max, maxBy, omit, orderBy, pick, set, sortBy, transform, uniq, uniqBy } from "lodash"

import { RelativeSkillLevel, specializedName } from "../utils"

import { GurpsMobileActor } from "../../../foundry/actor"
import BaseFeature, { FeatureTemplate } from "../base"
import GenericFeature from "./generic"
import SkillFeatureCompilationTemplate from "../compilation/templates/skill"
import { FEATURE } from "../type"
import type { GCA } from "../../gca/types"
import { ISkillFeature } from "../compilation/templates/skill"
import { SkillManualSource } from "../compilation/templates/skill"
import { IRollDefinition } from "../../../../gurps-extension/utils/roll"

export default class SkillFeature extends GenericFeature implements ISkillFeature {
  attribute: string
  difficulty: string
  sl: string
  rsl: RelativeSkillLevel
  default: IRollDefinition[]
  untrained: boolean
  defaultFrom: object[]
  proxy?: boolean

  /**
   * Instantiate new Skill Feature
   */
  constructor(key: string | number, prefix = `system.skills.`, parent: BaseFeature | null = null, template: FeatureTemplate<any>) {
    super(key, prefix, parent, template)
    this.addCompilation(SkillFeatureCompilationTemplate)
  }

  // INTEGRATING
  integrate(actor: GurpsMobileActor) {
    super.integrate(actor)

    // index by name and specializedName for quick reference
    if (!this.container) {
      actor.setCache(`_${this.type.value}.${this.specializedName}.${this.id}`, this)
      actor.setCache(`_${this.type.value}.${this.name}.${this.id}`, this)

      if (this.type.compare(FEATURE.SKILL)) {
        if (this.untrained) actor.setCache(`_untrainedSkill.${this.specializedName}.${this.id}`, this)
        else {
          actor.setCache(`_trainedSkill.${this.specializedName}.${this.id}`, this)
          if (this.__compilation.sources.gca) actor.setCache(`gca.skill.${this.__compilation.sources.gca._index}`, this)
        }
      }
    }

    return this
  }

  // GENERATORS
  static untrained(actor: GurpsMobileActor, template: FeatureTemplate<SkillManualSource>) {
    if (!template.factory) throw new Error(`Missing factory on untrained call`)

    const trainedSkillIndex = actor.cache._trainedSkill ?? {}
    const trainedSkills = flatten(Object.values(trainedSkillIndex).map(features => Object.values(features)))
    const trainedSkillsGCAIndex = trainedSkills.map(feature => feature.__compilation.sources.gca?._index)

    // extract a list of all untrained skills with viable SKILL defaults
    const untrainedSkills = {} as Record<
      string,
      {
        _index: number
        _skill: string
        _from: string | string[]
        _text: string
        expression: GCA.Expression
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
        const { skill: otherIndex, source: expression, text } = defaultOf[i]

        // skill is already trained
        if (trainedSkillsGCAIndex.includes(otherIndex)) continue

        if (untrainedSkills[otherIndex] === undefined) untrainedSkills[otherIndex] = []

        untrainedSkills[otherIndex].push({
          _index: i,
          _skill: specializedName(GCA.entries[otherIndex]),
          _from: skillFeature.specializedName,
          _text: text,
          tl: skillFeature.tl,
          expression,
        })
      }
    }

    // for each skill, inject attribute defaults
    for (const skillIndex of Object.keys(untrainedSkills)) {
      const skill = GCA.entries[skillIndex]

      const attributeExpressions = skill.default
        .map((_, index) => index)
        .filter(expressionIndex => {
          const expression = skill.default[expressionIndex]
          const _targetTypes = Object.values(expression.targets ?? {}).map(target => target.type)
          const targetTypes = uniq(_targetTypes).filter(t => ![`me`].includes(t))

          if (targetTypes.length === 1) {
            if (targetTypes[0] === `attribute`) return true
          } else debugger

          return false
        })

      untrainedSkills[skillIndex].push(
        ...attributeExpressions.map((expression, i) => {
          const attributes = Object.values(skill.default[expression].targets ?? {}).map(target => target.fullName)

          // ERROR: Unimplemented
          if (attributes.length > 1) debugger

          return {
            _index: untrainedSkills[skillIndex].length + i,
            _skill: specializedName(skill),
            _from: attributes,
            _text: skill.default[expression]._raw,
            expression: skill.default[expression],
          }
        }),
      )
    }

    // instantiate these defaulted skills
    //    each "default definition" (set of rules to determine skill level for skill) should have ALL necessary information for its calculation
    //    NOTHING from outside the definition can be used in the computation of final skill level

    const features = [] as SkillFeature[]
    for (const [skillIndex, defaultDefinition] of Object.entries(untrainedSkills)) {
      const skill = GCA.entries[skillIndex]

      // TODO: Special treatment for elixirs (ointments)
      if (skill.ointment === `X`) continue

      const tls = uniq(defaultDefinition.map(definition => definition.tl).filter(tl => !isNil(tl)))

      // ERROR: Unimplemented
      if (tls.length > 1) debugger

      const skillTemplate: FeatureTemplate<SkillManualSource> = {
        ...omit(template, [`manual`]),
        manual: {
          ...get(template, `manual`, {}),
          id: () => `gca-${skillIndex}`,
          // ignoreSpecialization: !!ignoreSpecialization,
          trained: false,
          defaultDefinition: defaultDefinition.map(definition => ({ ...definition, actor })),
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
      flatten(Object.values(actor.cache._trainedSkill ?? {}).map(features => Object.values(features).map(feature => [feature.__compilation.sources.gca._index, feature]))),
    )
    const untrainedSkills = Object.fromEntries(
      flatten(Object.values(actor.cache._untrainedSkill || {}).map(features => Object.values(features).map(feature => [feature.__compilation.sources.gca._index, feature]))),
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

    // for (const [index, feature] of Object.entries(untrainedSkills)) {
    //   const name = feature.name
    //   if (skills[name] === undefined) skills[name] = {}
    //   if (skills[name].untrained === undefined) skills[name].untrained = []
    //   skills[name].untrained.push(feature)
    // }

    // create missing entries
    const features = {} as Record<string, SkillFeature>
    for (const [name, { base, trained, untrained }] of Object.entries(skills)) {
      const trainedOrUntrained = trained || untrained
      if (trainedOrUntrained && trainedOrUntrained.length > 0) {
        // ERROR: Unimplemented
        if (trainedOrUntrained.length > 1) debugger

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
          trained: () => !!trained,
          proxy: true,
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
