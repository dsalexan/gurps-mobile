import { cloneDeep, flatten, get, has, isArray, isEmpty, isNil, isString, orderBy, set, uniq, upperFirst } from "lodash"
import Feature, { FeatureTemplate } from "."
import { ToggableValue } from "../../../core/feature/base"
import LOGGER from "../../../logger"
import { SkillFeaturePipeline, ISkillFeatureData, SkillManualSource } from "./pipelines/skill"
import { Utils } from "../../../core/feature"
import { GurpsMobileActor } from "../actor"
import { IWeaponizableFeatureData, WeaponizableFeaturePipeline } from "./pipelines/weaponizable"
import FeatureWeaponsDataContextTemplate from "../../actor-sheet/context/feature/weapons"
import { isNilOrEmpty } from "../../../../december/utils/lodash"
import { GURPS4th } from "../../../../gurps-extension/types/gurps4th"
import GenericFeature from "./generic"
import FeatureFactory from "../../../core/feature/factory"
import { specializedName } from "../../../core/feature/utils"
import { derivation, passthrough, proxy } from "./pipelines"
import { MERGE } from "../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "./pipelines/generic"
import type { GCA } from "../../../core/gca/types"
import { ILevel, ILevelDefinition, buildLevel, parseLevel } from "../../../../gurps-extension/utils/level"
import { IComponentDefinition, compareComponent } from "../../../../gurps-extension/utils/component"

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
      if (this.data.training !== `unknown`) {
        actor.setCache(`_${this.type.value}.${this.data.training}.${this.specializedName}.${this.id}`, this)
        actor.setCache(`_${this.type.value}.${this.data.training}.${this.data.name}.${this.id}`, this)
      }

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

    const trainedSkillIndex = actor.cache._skill?.trained ?? {}
    const trainedSkills = flatten(Object.values(trainedSkillIndex).map(skillsById => Object.values(skillsById)))
    const trainedSkillsGCAIndex = trainedSkills.map(feature => feature.sources.gca?._index).filter(index => !isNil(index))

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
          tl: skillFeature.data.tl?.level,
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

      const id = `gca-${skill._index}`
      const skillTemplate = cloneDeep(template)
      const manual = { training: `untrained`, tl: tls[0] } as SkillManualSource

      const newFeature = factory.build(`skill`, id, parseInt(skillIndex), undefined, skillTemplate)
      if (tls.length === 1)
        newFeature.addPipeline<IGenericFeatureData>([
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
    // TODO: implement byDefaultAttribute with this shit

    // pre-process indexes for trained/untrained skills
    const trainedSkills = Object.fromEntries(
      flatten(Object.values(actor.cache._skill?.trained ?? {}).map(features => Object.values(features).map(feature => [feature.sources.gca._index, feature]))),
    )
    const untrainedSkills = Object.fromEntries(
      flatten(Object.values(actor.cache._skill?.untrained ?? {}).map(features => Object.values(features).map(feature => [feature.sources.gca._index, feature]))),
    )

    const skills = {} as Record<string, { base?: GCA.IndexedSkill; trained?: SkillFeature[]; untrained?: SkillFeature[] }>
    // index all skills as base
    for (const [name, skill] of Object.entries(GCA.allSkills.index)) set(skills, [name, `base`], skill)

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

      const tl = parseInt(actor.system.traits.techlevel)

      const id = `proxy-gca-${base.skill}`
      const skillTemplate = cloneDeep(template)
      const manual = { training: `unknown`, tl, proxy: true } as SkillManualSource

      const newFeature = factory
        .build(`skill`, id, base.skill, undefined, skillTemplate)
        .addPipeline<IGenericFeatureData>([
          //
          derivation.manual(`tl`, `tl`, manual => ({ tl: MERGE(`tl`, { level: manual.tl }) })),
          proxy.manual(`proxy`),
        ])
        .addSource(`manual`, manual, { delayCompile: true })
        .addSource(`gca`, GCA.entries[base.skill])
        .integrateOn(`compile:gca`, actor)

      features[name] = newFeature as any
    }

    return features
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

  calcActorModifier(): number {
    const actor = this.actor

    // ERROR: Unimplemented
    if (isNil(actor)) throw new Error(`Cannot calculate actor modifier for skill an actor dude`)

    // CALCULATE SKILL BONUS FROM ACTOR
    //    actor components can give some bonuses to skill
    const actorComponents = actor.getComponents(`skill_bonus`, component => compareComponent(component, this))
    const componentsBonus = [] as { component: IComponentDefinition<any>; value: number }[]
    for (const component of actorComponents) {
      let modifier = 1
      if (component.per_level) modifier = component.feature.data.level

      const value = component.amount * modifier

      if (isNil(value) || isNaN(value)) {
        LOGGER.warn(
          `${name}·level`,
          `Component with undetermined level`,
          component.type,
          component.selection_type,
          JSON.stringify(component.name),
          `◄`,
          component.feature.specializedName,
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

    const actorBonus = availableComponents.map(({ value }) => value).reduce((a, b) => a + b, 0)

    return actorBonus
  }

  calcAttributeBasedLevel({ attribute: targetAttribute, modifier: withModifier }: { attribute?: GURPS4th.AttributesAndCharacteristics; modifier?: boolean }): ILevel | null {
    const actor = this.actor
    const { attribute, training } = this.data

    const baseAttribute = targetAttribute ?? attribute

    // TODO: Implement techniques
    if (this.sources.gcs?.type === `technique`) return null

    // ERROR: Unimplemented
    if (isNil(actor)) throw new Error(`Cannot calculate attribute-based skill level without actor`)

    if (training === `trained`) {
      // CALCULATE LEVEL BASED ON ATTRIBUTE
      let baseLevel = (actor.system.attributes[baseAttribute.toUpperCase()] ?? actor.system[baseAttribute]).value
      baseLevel = Math.min(20, baseLevel) // The Rule of 20, B 173

      const skillModifier = withModifier ? this.data.proficiencyModifier : 0
      const actorModifier = withModifier ? this.data.actorModifier : 0

      const flags = baseAttribute !== attribute ? [`other-based`] : []
      const attributeBasedLevel = buildLevel(baseLevel, skillModifier + actorModifier, { attribute: baseAttribute, flags })

      // ERROR: Cannot
      if (isNaN(attributeBasedLevel.level) || isNil(attributeBasedLevel.level)) debugger

      return attributeBasedLevel
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

    // TODO: Implement techniques
    if (this.sources.gcs?.type === `technique`) return null

    if (training === `trained` || training === `untrained`) {
      // ERROR: Unimplemented wildcard
      if (name[name.length - 1] === `!`) debugger

      // GET ALL TRAINED SKILLS
      // TODO: Can only calculate after trained skills are cached
      const skillCache = actor.cache._skill?.trained
      const trainedSkills = flatten(Object.values(skillCache ?? {}).map(idMap => Object.values(idMap)))
      const trainedSkillsGCA = trainedSkills.map(skill => skill.sources.gca?._index).filter(index => !isNil(index)) as number[]

      // ERROR: Cannot be
      if (skillCache === undefined) debugger

      // CALCULATE ATTRIBUTE-BASED LEVEL OF DEFAULTS
      const defaultsAttributeBasedLevels = [] as { level: ILevel; definition: ILevelDefinition }[]
      for (const _default of defaults ?? []) {
        const targets = _default.targets ? Object.values(_default.targets) : []
        const attributes = targets.filter(target => target.type === `attribute`)
        const nonAttributes = targets.filter(target => target.type !== `attribute`)

        let level: ILevel | null = null
        if (nonAttributes.length === 0) {
          // WARN: Untested
          if (attributes.length > 1) debugger

          // ignore attribute-only-based defaults
          continue
        } else {
          const skills = targets.filter(target => target.type === `skill`)
          const trainedSkills = skills.filter(target => {
            // check if all skills are trained
            //    get skill entries
            const skills = target.value as number[]
            if (!skills || skills?.length === 0) return false

            //    check if there is some entry with a trained feature AND that entry is not self
            return skills.some(skill => skill !== this.sources.gca?._index && trainedSkillsGCA.includes(skill))
          })

          // If not all skill targets are trained skills, then ignore level for this default
          if (trainedSkills.length === skills.length) {
            // WARN: Untested
            if (trainedSkills.length > 1) debugger
            const skill = trainedSkills[0]
            const features = ((skill.value as number[])?.map(index => actor.cache.gca.skill[index]) ?? []).filter(feature => !isNil(feature))
            const trainedFeatures = features.filter(feature => feature.data.training === `trained`)

            // ERROR: Unimplemented
            if (trainedFeatures.length !== 1) debugger

            const feature = trainedFeatures[0]

            // check if there is a both way default
            const defaultsToThis = GCA.index.bySection[`SKILLS`].byDefault[this.sources.gca._index]
            const featureDefaultsToThis = defaultsToThis?.some(default_ => default_.skill === feature.sources.gca._index)

            // if there is a both way default, ignore this default if its proficiencyModifier is smaller than self.proficiencyModifier
            if (featureDefaultsToThis) {
              if (proficiencyModifier >= feature.data.proficiencyModifier) continue
            }

            // if (_default._raw === `"SK:Smith (Iron)" - me::default2`) debugger
            const defaultLevel = _default.parse(this, actor)

            // WARN: Untested
            if (defaultLevel === null) debugger

            level = defaultLevel
          } else if (trainedSkills.length > 0) {
            // WARN: Untested when some targets are trained skills
            debugger
          }
        }

        if (!isNil(level)) defaultsAttributeBasedLevels.push({ level, definition: _default })
      }

      const orderedLevels = orderBy(defaultsAttributeBasedLevels, ({ level }) => level.level, `desc`)

      if (orderedLevels.length === 0) return attributeBasedLevel
      if (attributeBasedLevel?.level > orderedLevels[0].level.level) return attributeBasedLevel
      if (training != `trained`) return orderedLevels[0].level

      // IF A DEFAULT HAS AN ABL BIGGER THEN SELF ABL, THEN USE ITS ABL AS BASE LEVEL (making it a DEFAULT-BASED LEVEL)
      const baseLevel = orderedLevels[0].level.level

      debugger
      const flags = [`default-based`]
      const defaultBasedLevel = buildLevel(baseLevel, proficiencyModifier + actorModifier, { skill: definition.fullName, flags })

      debugger
      return defaultBasedLevel
    } else if (training === `untrained`) {
      debugger
    }

    return null
  }
}
