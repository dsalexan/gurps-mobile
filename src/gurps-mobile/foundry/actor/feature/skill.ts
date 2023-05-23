/* eslint-disable no-debugger */
import { cloneDeep, flatten, get, groupBy, has, intersection, isArray, isEmpty, isNil, isString, orderBy, set, uniq, upperFirst } from "lodash"
import Feature, { FeatureTemplate } from "."
import { ToggableValue } from "../../../core/feature/base"
import LOGGER from "../../../logger"
import { SkillFeaturePipeline, ISkillFeatureData, SkillManualSource } from "./pipelines/skill"
import { Utils } from "../../../core/feature"
import { GurpsMobileActor } from "../actor"
import { IUsableFeatureData, WeaponizableFeaturePipeline } from "./pipelines/usable"
import FeatureWeaponsDataContextTemplate from "../../actor-sheet/context/feature/usable"
import { isNilOrEmpty, push } from "../../../../december/utils/lodash"
import { GURPS4th } from "../../../../gurps-extension/types/gurps4th"
import GenericFeature from "./generic"
import FeatureFactory from "../../../core/feature/factory"
import { specializedName } from "../../../core/feature/utils"
import { derivation, passthrough, proxy } from "./pipelines"
import { MERGE } from "../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "./pipelines/generic"
import type { GCA } from "../../../core/gca/types"
import {
  ILevel,
  createLevelDefinition,
  createVariable,
  calculateLevel,
  IAttributeVariable,
  allowedSkillVariables,
  getFeaturesFromVariable,
} from "../../../../gurps-extension/utils/level"
import { IComponentDefinition, compareComponent } from "../../../../gurps-extension/utils/component"
import { IFeatureContext } from "../../actor-sheet/context/feature/interfaces"
import BaseContextTemplate from "../../actor-sheet/context/context"
import { FeatureBaseContextSpecs } from "../../actor-sheet/context/feature/base"
import { SkillFeatureContextSpecs } from "../../actor-sheet/context/feature/variants/skill"
import { expression } from "mathjs"

export default class SkillFeature extends GenericFeature {
  declare data: ISkillFeatureData

  constructor(id: string, key: number | number[], parent?: Feature<any, any>, template?: FeatureTemplate) {
    super(id, key, parent, template)
    this.addPipeline(SkillFeaturePipeline)
  }

  listen() {
    super.listen()

    this.on(`update`, event => {
      const { keys, feature } = event.data as { keys: (string | RegExp)[]; feature: SkillFeature }

      if (keys.includes(`level`) && feature.sources.gca) {
        // check if there is a both way default
        const defaultsToThis = GCA.index.bySection[`SKILLS`].byDefault[feature.sources.gca._index] ?? []
        for (const default_ of defaultsToThis) {
          const skill = feature.actor.cache.gca.skill[default_.skill]
          if (!skill) continue
          if (feature.sources.gca._index === skill.sources.gca._index) continue

          // only request compile if there is already a level there
          if (skill.data.level === undefined) continue

          feature.factory.requestCompilation(skill, [`level`], {}, [], {} as any)
        }
      }
    })
  }

  _integrate(actor: GurpsMobileActor) {
    super._integrate(actor)

    // index by name and specializedName for quick reference
    if (!this.data.container) {
      // if (this.sources.gca?._index === 7116) debugger{
      if (this.data.training === undefined || this.data.training.toString() === `undefined`) debugger
      actor.setCache(`_skill.${this.data.training}.${this.id}`, this)

      if (this.sources.gca) {
        if (actor.cache.gca?.skill === undefined) actor.setCache(`gca.skill`, {})
        actor.setCache(`gca.skill.${this.sources.gca._index}`, this)
      }
    }

    return this
  }

  // #region GENERATORS

  // GENERATORS
  static untrained(actor: GurpsMobileActor, factory: FeatureFactory, template: FeatureTemplate) {
    if (!factory) throw new Error(`Missing factory on untrained call`)

    const trainedSkills = Object.values(actor.cache._skill?.trained ?? {}).filter(skill => skill.data.training === `trained`)
    const trainedSkillsGCAIndex = trainedSkills.map(feature => feature.sources.gca?._index).filter(index => !isNil(index))

    // ERROR: Cannot be
    if (trainedSkillsGCAIndex.length === 0) debugger

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
      const gcaIndex = skillFeature.sources.gca?._index as number
      if (gcaIndex === undefined) continue

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

        const entry = GCA.entries[untrainedIndex]

        // TODO: Deal with techniques/combos/imbuements
        if (entry.type?.match(/^(Tech|Combo|Imbue)/i)) continue

        if (untrainedSkills[untrainedIndex] === undefined) untrainedSkills[untrainedIndex] = []
        untrainedSkills[untrainedIndex].push({
          _index: i,
          _skill: specializedName(entry),
          _from: skillFeature.specializedName,
          _text: text,
          _source: source,
          from: gcaIndex,
          tl: skillFeature.data.tl?.level,
        })
      }
    }
    const untrainedSkillsGCAIndex = Object.keys(untrainedSkills).map(s => parseInt(s))

    // extract a list of all untrained skills with viable ATTRIBUTE defaults (that arent already in untrainedSkills)
    const attributes = [`ST`, `DX`, `IQ`, `HT`, `Will`, `Per`, `Dodge`]
    for (const attribute of attributes) {
      // get all default definitions for
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

        // TODO: Deal with techniques/combos/imbuements
        if (untrainedSkillEntry.type?.match(/^(Tech|Combo|Imbue)/i)) continue

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

      const id = `gca-${skill._index}`
      const skillTemplate = cloneDeep(template)
      const manual = { training: `untrained`, tl: tls[0] } as SkillManualSource

      const newFeature = factory.build(`skill`, id, parseInt(skillIndex), undefined, skillTemplate)
      if (tls.length === 1)
        newFeature.addPipeline<ISkillFeatureData>([
          //
          derivation.manual(`tl`, `tl`, manual => ({ tl: MERGE(`tl`, { level: manual.tl }) })),
        ])
      newFeature.addSource(`manual`, manual, { delayCompile: true })
      newFeature.addSource(`gca`, skill)
      newFeature.integrateOn(`compile:gca`, actor)

      features.push(newFeature as any)
    }

    return features
  }

  static all(actor: GurpsMobileActor, factory: FeatureFactory, template: FeatureTemplate) {
    // pre-process indexes for trained/untrained skills
    const trainedSkills = Object.fromEntries(
      Object.values(actor.cache._skill?.trained ?? {})
        .filter(feature => !isNil(feature.sources.gca))
        .map(feature => [feature.sources.gca?._index, feature]),
    )
    const untrainedSkills = Object.fromEntries(
      Object.values(actor.cache._skill?.untrained ?? {})
        .filter(feature => !isNil(feature.sources.gca))
        .map(feature => [feature.sources.gca?._index, feature]),
    )

    const skills = {} as Record<string, { base?: GCA.IndexedSkill; trained?: SkillFeature[]; untrained?: SkillFeature[] }>
    // index all skills as base
    for (const [name, skill] of Object.entries(GCA.skills.index)) set(skills, [name, `base`], skill)

    // index trained/untrained skills
    //    trained -> character has "formal training", i.e. some level bought with points
    //    untrained -> character doesnt have "formal training", but other skill influentiates it, i.e. default of skill is trained
    //    other -> any skill not trained or untrained
    for (const [index, feature] of Object.entries(trainedSkills)) {
      const name = feature.data.name
      if (skills[name] === undefined) skills[name] = {}
      if (skills[name].trained === undefined) skills[name].trained = []

      // @ts-ignore
      skills[name].trained.push(feature)
    }

    for (const [index, feature] of Object.entries(untrainedSkills)) {
      const name = feature.data.name
      if (skills[name] === undefined) skills[name] = {}
      if (skills[name].untrained === undefined) skills[name].untrained = []

      // @ts-ignore
      skills[name].untrained.push(feature)
    }

    // create proxy context specs
    const contextSpecs = {} as Record<string, { specs: Partial<SkillFeatureContextSpecs>; features: SkillFeature[] }>
    for (const [name, { base, trained, untrained }] of Object.entries(skills)) {
      // WARN: Unimplemented for non-GCA skills?? Shouldnt be possible
      if (base === undefined) debugger

      const proxy = base?.proxy

      // ERROR: Every pre-indexed skill should have a proxy feature
      if (!proxy) debugger

      const trainedOrUntrained = [...(trained ?? []), ...(untrained ?? [])]

      // if (trainedOrUntrained && trainedOrUntrained.length > 0) {
      //   // ERROR: Unimplemented
      //   if (trainedOrUntrained.length > 1)
      //     LOGGER.warn(`gca`, `Multiple possible entries for queriable skill`, `"${name}"`, trainedOrUntrained, [
      //       `color: #826835;`,
      //       `color: rgba(130, 104, 53, 60%); font-style: italic;`,
      //       `color: black; font-style: regular; font-weight: bold`,
      //       ``,
      //     ])
      // }

      contextSpecs[name] = {
        specs: {
          ignoreSpecialization: base?.ignoreSpecialization,
          proxyTo: trainedOrUntrained,
          tl: parseInt(actor.system.traits.techlevel),
        },
        features: trainedOrUntrained,
      }
    }

    return contextSpecs
  }

  // #endregion

  calcProficiencyModifier(): number {
    const { difficulty, points, training } = this.data

    if (training === `trained`) {
      // CALCULATE SKILL MODIFIER FROM DIFFICULTY
      const difficultyDecrease = { E: 0, A: 1, H: 2, VH: 3 }[difficulty] ?? 0

      // Skill Cost Table, B 170
      //    negative points is possible?
      let boughtIncrease_curve = { 4: 2, 3: 1, 2: 1, 1: 0 }[points] ?? (points > 4 ? 2 : 0) // 4 -> +2, 2 -> +1, 1 -> +0
      let boughtIncrease_linear = Math.floor((points - 4) / 4) // 8 -> +3, 12 -> +4, 16 -> +5, 20 -> +6, ..., +4 -> +1
      const boughtIncrease = boughtIncrease_curve + boughtIncrease_linear

      const skillModifier = boughtIncrease - difficultyDecrease

      return skillModifier
    }

    return 0
  }

  calcActorModifier(actor: GurpsMobileActor, components = false): number | { component: IComponentDefinition; value: number }[] {
    // ERROR: Unimplemented
    if (isNil(actor)) throw new Error(`Cannot calculate actor modifier for skill an actor dude`)

    // CALCULATE SKILL BONUS FROM ACTOR
    //    actor components can give some bonuses to skill
    const actorComponents = actor.getComponents(`skill_bonus`, component => compareComponent(component, this))
    const componentsBonus = [] as { component: IComponentDefinition; value: number }[]
    for (const component of actorComponents) {
      const componentFeature = actor.cache.features?.[component.feature]
      if (!componentFeature) debugger

      let modifier = 1
      if (component.per_level) modifier = componentFeature!.data.level

      const value = component.amount * modifier

      if (isNil(value) || isNaN(value)) {
        LOGGER.warn(
          `${name}·level`,
          `Component with undetermined level`,
          component.type,
          component.selection_type,
          JSON.stringify(component.selection_filter),
          `◄`,
          componentFeature!.specializedName,
          component,
          [
            `color: #826835;`,
            `color: rgba(130, 104, 53, 60%); font-style: italic;`,
            `color: black; font-style: regular; font-weight: bold`,
            `color: #826835;`,
            `color: rgba(130, 104, 53, 60%); font-style: italic;`,
            `color: black; font-style: regular; font-weight: bold`,
            `color: #826835;`,
            ``,
          ],
        )
      }

      componentsBonus.push({ component, value })
    }

    const unavailableComponents = componentsBonus.filter(({ value }) => isNil(value) || isNaN(value))
    const availableComponents = componentsBonus.filter(({ value }) => !(isNil(value) || isNaN(value)))

    if (components) return availableComponents

    const actorBonus = availableComponents.map(({ value }) => value).reduce((a, b) => a + b, 0)

    return actorBonus
  }

  calcAttributeBasedLevel({ attribute: targetAttribute, modifier: withModifier }: { attribute?: GURPS4th.AttributesAndCharacteristics; modifier?: boolean }): ILevel | null {
    const actor = this.actor
    const { attribute, training, defaults } = this.data

    const baseAttribute = targetAttribute ?? attribute

    if (this.sources.gcs?.type?.match(/^(Tech|Combo|Imbue)/i)) return null

    // ERROR: Unimplemented
    if (isNil(actor)) throw new Error(`Cannot calculate attribute-based skill level without actor`)

    if (training === `trained`) {
      // CALCULATE LEVEL BASED ON ATTRIBUTE

      const proficiencyModifier = withModifier ? this.data.proficiencyModifier : 0
      const actorModifier = withModifier ? this.data.actorModifier : 0

      const flags = baseAttribute !== attribute ? [`other-based`] : []

      // The Rule of 20, B 173 [max=20]
      const B = createVariable(`B`, `attribute`, baseAttribute, { flags, transforms: [`max=20`] })

      let expression = `∂B`
      const variables = { B } as any

      if (proficiencyModifier) {
        variables.PROFICIENCY_MODIFIER = createVariable(`PROFICIENCY_MODIFIER`, `constant`, proficiencyModifier, { label: `Proficiency` })
        expression += ` + ∂PROFICIENCY_MODIFIER`
      }

      if (actorModifier) {
        variables.ACTOR_MODIFIER = createVariable(`ACTOR_MODIFIER`, `constant`, actorModifier, { label: `Actor Bonus`, flags: [`actor-component`] })
        expression += ` + ∂ACTOR_MODIFIER`
      }

      const definition = createLevelDefinition(expression, variables, { flags })
      // console.warn(`gurps-mobile`, this.id, `pre-calculateLevel`, definition, this)
      const attributeBasedLevel = calculateLevel(definition, this, actor)

      // ERROR: Cannot
      if (isNil(attributeBasedLevel) || isNaN(attributeBasedLevel?.value)) debugger

      return attributeBasedLevel
    } else if (training === `untrained`) {
      if (!defaults) return null

      // ERROR: Wot dawg
      if (isNil(baseAttribute)) debugger

      // CALCULATE ATTRIBUTE-BASED LEVEL OF ATTRIBUTE-ONLY DEFAULTS
      const defaultsAttributeBasedLevels = [] as ILevel[]
      for (const definition of defaults ?? []) {
        const variables = Object.values(definition.variables ?? {})
        const attributes = variables.filter(variable => variable.type === `attribute`)
        const nonAttributes = variables.filter(variable => variable.type !== `attribute`)

        let localDefinition = definition
        let level: ILevel | null = null

        // just use attribute-only-based defaults
        if (nonAttributes.length === 0) {
          // WARN: Unimplemented case (since i'm hardcoding changing variable "A" always)
          if (attributes.length > 1) debugger

          if (baseAttribute !== attributes[0].value) {
            // if base attribute is different than default attribute, just change target/variables in default

            localDefinition = cloneDeep(definition)

            const handle = attributes[0].handle
            const attributeVariable = localDefinition.variables![handle] as IAttributeVariable

            attributeVariable.value = baseAttribute
            attributeVariable.meta = { name: baseAttribute }
            attributeVariable.flags = [...(attributeVariable.flags ?? []), `other-based`]

            push(localDefinition, `flags`, `other-based`)
          }

          level = calculateLevel(localDefinition, this, actor)
        }

        if (!isNil(level)) defaultsAttributeBasedLevels.push(level)
      }

      // in the case of multiple attribute-only default (like Boating) choose those matching base attribute
      const ablsWithBaseAttribute = orderBy(defaultsAttributeBasedLevels, level => level.value, `desc`)

      return ablsWithBaseAttribute[0] ?? null
    }

    return null
  }

  /**
   * Returns best level for feature
   */
  calcLevel(attribute?: GURPS4th.AttributesAndCharacteristics) {
    const actor = this.actor
    const { proficiencyModifier, actorModifier, attributeBasedLevel, defaults, name, training } = this.data

    // ERROR: Unimplemented
    if (isNil(actor)) throw new Error(`Cannot calculate skill level without defaults and actor`)

    // TODO: Deal with techniques/combos/imbuements
    if (this.sources.gcs?.type?.match(/^(Tech|Combo|Imbue)/i)) return null

    if (training === `trained` || training === `untrained`) {
      // ERROR: Unimplemented wildcard
      if (name[name.length - 1] === `!`) debugger

      // GET ALL TRAINED SKILLS
      const allTrainedSkills = Object.values(actor.cache._skill?.trained ?? {}).filter(skill => skill.data.training === `trained`)
      //    make sure to not list self as trained skill
      const trainedSkillsGCA = allTrainedSkills.map(feature => feature.sources.gca?._index).filter(index => !isNil(index) && index !== this.sources.gca?._index)

      // ERROR: Cannot be
      if (trainedSkillsGCA.length === 0) debugger

      // CALCULATE ATTRIBUTE-BASED LEVEL OF DEFAULTS
      const defaultsAttributeBasedLevels = [] as ILevel[]
      for (const definition of defaults ?? []) {
        if (!definition.variables) continue

        // if (training === `untrained` && name === `Smith`) debugger

        // viability check
        // ignore if definition doenst have any trained skill in variables
        const variables = allowedSkillVariables(definition, trainedSkillsGCA)
        if (variables.length === 0) continue

        // ERROR: Untested, multiple trained skill variables in definition // COMMENT
        //        Since bellow i'm assuming there is only only trained-skill-based target to get its skill feature // COMMENT
        if (variables.length > 1) debugger // COMMENT

        const features = getFeaturesFromVariable(actor, variables[0]).filter(feature => feature.data.training === `trained`)

        // ERROR: Unimplemented // COMMENT
        if (features.length !== 1) debugger // COMMENT

        // check if there is a both way default (current skill defaults to default skill and default skill defaults to current skill)
        const skillsThatDefaultToThis = GCA.index.bySection[`SKILLS`].byDefault[this.sources.gca._index] ?? []
        const featureDefaultsToThis = skillsThatDefaultToThis.some(defaultDefinition => defaultDefinition.skill === features[0].sources.gca._index)
        //    no need to check the other way since we already now that this DO defaults to feature (we get feature from this.defaults after all)

        //    if there is a both way default, ignore current default definition ONLY if this.proficiencyModifier is greather than feature.proficiencyModifier
        //        if this has a better modifier to begin with then basing it on feature is pointless, the final level would be worse
        //        having a bigger proficiency modifier means the character spent more points in this skill
        if (featureDefaultsToThis) {
          if (proficiencyModifier >= features[0].data.proficiencyModifier) continue
        }

        // default is good to go, calculate level and ship it
        const level = calculateLevel(definition, this, actor)

        // ERROR: Untested // COMMENT
        if (level === null) debugger // COMMENT

        if (level) defaultsAttributeBasedLevels.push(level)
      }

      // if (this.id === `gca-528`) debugger

      const orderedLevels = orderBy(defaultsAttributeBasedLevels, level => level.value, `desc`)

      if (orderedLevels.length === 0) return attributeBasedLevel
      if (attributeBasedLevel?.value > orderedLevels[0].value) return attributeBasedLevel
      if (training !== `trained`) return orderedLevels[0].value

      // IF A DEFAULT HAS AN ABL BIGGER THEN SELF ABL, THEN USE ITS ABL AS BASE LEVEL (making it a DEFAULT-BASED LEVEL)
      const baseLevel = orderedLevels[0].value

      debugger
      const flags = [`default-based`]
      const defaultBasedLevel = buildLevel(baseLevel, proficiencyModifier + actorModifier, { skill: definition.fullName, flags })

      debugger
      return defaultBasedLevel
    } else if (training === `unknown`) {
      debugger
    }

    return null
  }
}
