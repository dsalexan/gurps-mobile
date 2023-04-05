import { get, has, isArray, isEmpty, isNil, isString, uniq } from "lodash"
import Feature, { FeatureTemplate } from "."
import { ToggableValue } from "../../../core/feature/base"
import LOGGER from "../../../logger"
import { SkillFeaturePipeline, ISkillFeatureData } from "./pipelines/skill"
import { Utils } from "../../../core/feature"
import { GurpsMobileActor } from "../actor"
import { IWeaponizableFeatureData, WeaponizableFeaturePipeline } from "./pipelines/weaponizable"
import FeatureWeaponsDataContextTemplate from "../../actor-sheet/context/feature/weapons"
import { isNilOrEmpty } from "../../../../december/utils/lodash"
import { GURPS4th } from "../../../../gurps-extension/types/gurps4th"
import GenericFeature from "./generic"

export default class SkillFeature extends GenericFeature {
  declare data: ISkillFeatureData

  constructor(id: string, key: number | number[], parent?: Feature<any, any>, template?: FeatureTemplate) {
    super(id, key, parent, template)
    this.addPipeline(SkillFeaturePipeline)
  }

  integrate(actor: GurpsMobileActor) {
    super.integrate(actor)

    // index by name and specializedName for quick reference
    if (!this.data.container) {
      if (this.data.training !== `unknown`) {
        actor.setCache(`_${this.type.value}.${this.data.training}.${this.specializedName}.${this.id}`, this)
        actor.setCache(`_${this.type.value}.${this.data.training}.${this.data.name}.${this.id}`, this)
      }

      if (this.sources.gca) actor.setCache(`gca.skill.${this.sources.gca._index}`, this)
    }

    return this
  }

  // #region GENERATORS

  // static untrained(actor: GurpsMobileActor, template: FeatureTemplate<SkillManualSource>) {
  //   if (!template.factory) throw new Error(`Missing factory on untrained call`)

  //   const trainedSkillIndex = actor.cache._skill?.trained ?? {}
  //   const trainedSkills = flatten(Object.values(trainedSkillIndex).map(skillsById => Object.values(skillsById)))
  //   const trainedSkillsGCAIndex = trainedSkills.map(feature => feature.__compilation.sources.gca?._index)

  //   // extract a list of all untrained skills with viable SKILL defaults
  //   const untrainedSkills = {} as Record<
  //     string,
  //     {
  //       _index: number
  //       _skill: string
  //       _from: string | string[]
  //       _text: string
  //       _source: number
  //       from: number | string
  //       tl?: number
  //     }[]
  //   >
  //   for (const skillFeature of trainedSkills) {
  //     const gcaIndex = skillFeature.__compilation.sources.gca?._index as number

  //     // ERROR: Unimplemented
  //     // eslint-disable-next-line no-debugger
  //     if (gcaIndex === undefined) debugger

  //     const defaultOf = GCA.index.bySection.SKILLS.byDefault[gcaIndex]
  //     if (defaultOf === undefined) continue // no skill default to feature

  //     // other skills that default o skillFeature
  //     // defaultOf.map(({skill}) => GCA.entries[skill])

  //     // math expressions for defaulting
  //     // defaultOf.map(({skill, source}) => GCA.entries[skill].default[source])

  //     for (let i = 0; i < defaultOf.length; i++) {
  //       const { skill: untrainedIndex, source, text } = defaultOf[i]

  //       // skill is already trained
  //       if (trainedSkillsGCAIndex.includes(untrainedIndex)) continue
  //       if (untrainedSkills[untrainedIndex] === undefined) untrainedSkills[untrainedIndex] = []

  //       untrainedSkills[untrainedIndex].push({
  //         _index: i,
  //         _skill: specializedName(GCA.entries[untrainedIndex]),
  //         _from: skillFeature.specializedName,
  //         _text: text,
  //         _source: source,
  //         from: gcaIndex,
  //         tl: skillFeature.tl?.level,
  //       })
  //     }
  //   }
  //   const untrainedSkillsGCAIndex = Object.keys(untrainedSkills).map(s => parseInt(s))

  //   // extract a list of all untrained skills with viable ATTRIBUTE defaults (that arent already in untrainedSkills)
  //   const attributes = [`ST`, `DX`, `IQ`, `HT`, `Will`, `Per`, `Dodge`]
  //   for (const attribute of attributes) {
  //     let defaults = GCA.index.bySection.SKILLS.byDefaultAttribute[attribute] ?? GCA.index.bySection.SKILLS.byDefaultAttribute[upperFirst(attribute)]
  //     // defaults = defaults.filter(d => GCA.index.bySection.SKILLS.byName[`Shield`].includes(d.skill))

  //     // check the ones that are ONLY defaulted to attributes
  //     const onlyAttributes = defaults.filter(_default => {
  //       const skill = GCA.entries[_default.skill]
  //       const targetsList = skill.default.map(skillDefault => Object.values(skillDefault.targets ?? {}))

  //       for (const targets of targetsList) {
  //         if (targets.length === 0) continue
  //         const attributeOnlyTargets = targets.filter(target => target.type === `attribute`)
  //         if (attributeOnlyTargets.length === targets.length) return true
  //       }

  //       return false
  //     })

  //     // if onlyAttributes.length === 0, there is NO skills that default to this attribute only

  //     const onlyUntrained = onlyAttributes.filter(_default => !trainedSkillsGCAIndex.includes(_default.skill))
  //     const onlyNewUntrained = onlyUntrained.filter(_default => !untrainedSkillsGCAIndex.includes(_default.skill))
  //     const skillsAndTechniques = onlyNewUntrained.map(_default => [_default, GCA.entries[_default.skill]] as const)
  //     const skills = skillsAndTechniques.filter(([_default, trait]) => !trait.type?.match(/^(Tech|Combo)/i))

  //     if (skills.length === 0) continue

  //     for (let i = 0; i < skills.length; i++) {
  //       const [_default, untrainedSkillEntry] = skills[i]
  //       const { skill: untrainedIndex, source, text } = _default

  //       // skill is already trained
  //       if (trainedSkillsGCAIndex.includes(untrainedIndex)) continue
  //       if (untrainedSkills[untrainedIndex] === undefined) untrainedSkills[untrainedIndex] = []

  //       untrainedSkills[untrainedIndex].push({
  //         _index: i,
  //         _skill: specializedName(untrainedSkillEntry),
  //         _from: attribute,
  //         _text: text,
  //         _source: source,
  //         from: attribute,
  //         tl: parseInt(actor.system.traits.techlevel),
  //       })
  //     }
  //   }

  //   // instantiate these defaulted skills
  //   //    each "default definition" (set of rules to determine skill level for skill) should have ALL necessary information for its calculation
  //   //    NOTHING from outside the definition can be used in the computation of final skill level

  //   const features = [] as SkillFeature[]
  //   for (const [skillIndex, sources] of Object.entries(untrainedSkills)) {
  //     const skill = GCA.entries[skillIndex]

  //     // TODO: Special treatment for elixirs (ointments)
  //     if (skill.ointment === `X`) continue

  //     const tls = uniq(sources.map(source => source.tl).filter(tl => !isNil(tl)))

  //     // ERROR: Unimplemented
  //     if (tls.length > 1) debugger

  //     const skillTemplate: FeatureTemplate<SkillManualSource> = {
  //       ...omit(template, [`manual`]),
  //       manual: {
  //         ...get(template, `manual`, {}),
  //         id: () => `gca-${skillIndex}`,
  //         // ignoreSpecialization: !!ignoreSpecialization,
  //         training: `untrained`,
  //       },
  //     }

  //     if (tls.length === 1) skillTemplate.manual.tl = () => tls[0]

  //     const newFeature = template.factory
  //       .build(`skill`, skillIndex, `untrainedSkills.`, null, skillTemplate) //
  //       .addSource(`gca`, skill)
  //       .compile() as SkillFeature

  //     features.push(newFeature)
  //   }

  //   return features
  // }

  // static all(actor: GurpsMobileActor, template: FeatureTemplate) {
  //   // TODO: implement byDefaultAttribute with this shit

  //   // pre-process indexes for trained/untrained skills
  //   const trainedSkills = Object.fromEntries(
  //     flatten(Object.values(actor.cache._skill?.trained ?? {}).map(features => Object.values(features).map(feature => [feature.__compilation.sources.gca._index, feature]))),
  //   )
  //   const untrainedSkills = Object.fromEntries(
  //     flatten(Object.values(actor.cache._skill?.untrained ?? {}).map(features => Object.values(features).map(feature => [feature.__compilation.sources.gca._index, feature]))),
  //   )

  //   const skills = {} as Record<string, { base?: GCA.IndexedSkill; trained?: SkillFeature[]; untrained?: SkillFeature[] }>
  //   // index all skills as base
  //   for (const [name, skill] of Object.entries(GCA.allSkills.index)) set(skills, [name, `base`], skill)

  //   // index trained/untrained skills
  //   //    trained -> character has "formal training", i.e. some level bought with points
  //   //    untrained -> character doesnt have "formal training", but other skill influentiates it, i.e. default of skill is trained
  //   //    other -> any skill not trained or untrained
  //   for (const [index, feature] of Object.entries(trainedSkills)) {
  //     const name = feature.name
  //     if (skills[name] === undefined) skills[name] = {}
  //     if (skills[name].trained === undefined) skills[name].trained = []

  //     // @ts-ignore
  //     skills[name].trained.push(feature)
  //   }

  //   for (const [index, feature] of Object.entries(untrainedSkills)) {
  //     const name = feature.name
  //     if (skills[name] === undefined) skills[name] = {}
  //     if (skills[name].untrained === undefined) skills[name].untrained = []

  //     // @ts-ignore
  //     skills[name].untrained.push(feature)
  //   }

  //   // create missing entries
  //   const features = {} as Record<string, SkillFeature>
  //   for (const [name, { base, trained, untrained }] of Object.entries(skills)) {
  //     const trainedOrUntrained = trained || untrained
  //     if (trainedOrUntrained && trainedOrUntrained.length > 0) {
  //       // // ERROR: Unimplemented
  //       // if (trainedOrUntrained.length > 1) debugger

  //       // TODO: How to deal with multiple specializations?

  //       features[name] = trainedOrUntrained[0]
  //       continue
  //     }

  //     // ERROR: Unimplemented
  //     if (base === undefined) debugger
  //     if (base === undefined) continue

  //     const skillTemplate: FeatureTemplate<SkillManualSource> = {
  //       ...omit(template, [`manual`]),
  //       manual: {
  //         ...get(template, `manual`, {}),
  //         id: () => `proxy-gca-${base.skill}`,
  //         ignoreSpecialization: () => base.ignoreSpecialization,
  //         proxy: () => true,
  //         training: `unknown`,
  //       },
  //     }

  //     const tl = parseInt(actor.system.traits.techlevel)

  //     const feature = template.factory
  //       .build(`skill`, base.skill, `gca.skills.`, null, skillTemplate) //
  //       .addSource(`gca`, GCA.entries[base.skill])
  //       .compile({ tl }) as SkillFeature

  //     // TODO: Skill from ALL should have actor linked?
  //     feature._actor = actor

  //     features[name] = feature
  //   }

  //   return features
  // }

  // #endregion
}
