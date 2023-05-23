import { GurpsMobileActor } from "../../../foundry/actor"
import BaseFeature, { FeatureTemplate, IFeature } from "../base"
import { IWeaponizableFeature } from "../compilation/templates/weaponizable"

import GenericFeatureCompilationTemplate from "../compilation/templates/generic"
import WeaponizableFeatureCompilationTemplate from "../compilation/templates/weaponizable"
import { cloneDeep, flatten, get, has, isArray, isNil, orderBy, sum, uniq } from "lodash"
import FeatureWeaponsDataContextTemplate from "../../../foundry/actor-sheet/context/feature/usable"
import { isNilOrEmpty } from "../../../../december/utils/lodash"
import { IWeaponFeature } from "../compilation/templates/weapon"
import WeaponFeature from "./weapon"
import { Utils } from ".."
import { ILevel, ILevelDefinition, calculateLevel, orderLevels } from "../../../../gurps-extension/utils/level"
import { FeatureState } from "../utils"
import { parseBonus } from "../../../../gurps-extension/utils/bonus"
import { GURPS4th } from "../../../../gurps-extension/types/gurps4th"

export interface IGenericFeature extends IFeature {
  container: boolean

  label: string
  tl?: {
    level: number
    required?: boolean
    range?: string
  }

  categories: string[]
  notes: string[]
  meta: string
  tags: string[]
  conditional: string[]
  activeDefense?: Record<`block` | `dodge` | `parry`, string[]>

  reference: string[]

  level?: ILevel | null
  defaults?: ILevelDefinition[]
  // calcLevel(attribute: GURPS4th.AttributesAndCharacteristics): ILevel | null
}

export default class GenericFeature extends BaseFeature implements IGenericFeature, IWeaponizableFeature {
  // structural
  container: boolean

  // data
  label: string
  tl?: {
    level: number
    required?: boolean
    range?: string
  }

  value?: string | number
  categories: string[]
  notes: string[]
  meta: string
  reference: string[]
  tags: string[]
  conditional: string[]

  weapons: WeaponFeature[]
  activeDefense?: Record<`block` | `dodge` | `parry`, string[]>

  level?: ILevel | null
  defaults?: ILevelDefinition[]

  /**
   * Instantiate new Generic Feature
   */
  constructor(key: string | number, prefix = `system.`, parent: BaseFeature | null = null, template: FeatureTemplate) {
    super(key, prefix, parent, template)
    this.addCompilation(GenericFeatureCompilationTemplate)
    this.addCompilation(WeaponizableFeatureCompilationTemplate)

    this._context.templates.push(FeatureWeaponsDataContextTemplate as any)
  }

  integrate(actor: GurpsMobileActor) {
    super.integrate(actor)

    if (this.weapons) this.weapons.map(feature => feature.integrate(actor))

    // COMPONENTS
    if (this.components) {
      for (const component of this.components) {
        component.feature = this
        if (!has(actor.cache, `components.${component.type}`)) actor.setCache(`components.${component.type}`, [])
        const modifierArray = get(actor.cache, `components.${component.type}`) as any as any[]
        if (isArray(modifierArray)) modifierArray.push(component)
      }
    }

    // LINKS
    //    generic
    const sheetLinks = get(actor.cache.links, `${this.id}`) ?? []
    this.links = sheetLinks.map(uuid => actor.cache.features?.[uuid]?.name ?? `<Missing link:${uuid}>`)

    //    defenses
    this.links.push(...GenericFeature.linkForDefenses(this))
    this.links = uniq(this.links)

    actor.cacheLink(this.id, ...this.links)

    // TECH_LEVEL
    if (this.tl?.required && isNilOrEmpty(this.tl.level)) {
      // ERROR: Untrained take TL from default, and all shit from GCS should come with tech_level already
      debugger
    }

    return this
  }

  /**
   * Returns best level for feature
   */
  calcLevel(attribute: GURPS4th.AttributesAndCharacteristics) {
    const actor = this._actor
    // ERROR: Unimplemented, cannot calculate skill level without actor
    if (!actor) debugger

    const baseAttribute = attribute ?? this.attribute

    if (this.training === `trained`) {
      // ERROR: Unimplemented
      if (this.defaults === undefined) debugger

      // ERROR: Unimplemented wildcard
      if (this.name[this.name.length - 1] === `!`) debugger

      const sourcedLevel = [] as { level: number; source: { type: string; name: string }; raw: string | ILevelDefinition }[]

      // CALCULATE SKILL MODIFIER FROM DIFFICULTY
      const difficultyDecrease = { E: 0, A: 1, H: 2, VH: 3 }[this.difficulty] ?? 0

      // Skill Cost Table, B 170
      //    negative points is possible?
      let boughtIncrease_curve = { 4: 2, 3: 1, 2: 1, 1: 0 }[this.points] ?? (this.points > 4 ? 2 : 0) // 4 -> +2, 2 -> +1, 1 -> +0
      let boughtIncrease_linear = Math.floor((this.points - 4) / 4) // 8 -> +3, 12 -> +4, 16 -> +5, 20 -> +6, ..., +4 -> +1
      const boughtIncrease = boughtIncrease_curve + boughtIncrease_linear

      const skillModifier = boughtIncrease - difficultyDecrease

      // CALCULATE SKILL BONUS FROM ACTOR
      const actorComponents = actor.getComponents(`skill_bonus`, component => compareComponent(component, this))
      const actorBonus = sum(
        actorComponents.map(component => {
          let modifier = 1
          if (component.per_level) modifier = component.feature.level

          const value = component.amount * modifier

          // ERROR: Unimplemented
          if (isNaN(value)) debugger

          return value
        }),
      )

      // CALCULATE LEVEL BASED ON ATTRIBUTE
      let baseLevel = (actor.system.attributes[baseAttribute.toUpperCase()] ?? actor.system[baseAttribute]).value
      baseLevel = Math.min(20, baseLevel) // The Rule of 20, B 173

      sourcedLevel.push({
        level: baseLevel,
        source: {
          type: `attribute`,
          name: baseAttribute,
        },
        raw: baseAttribute,
      })

      // CALCULATE LEVEL BASED ON DEFAULTS
      const skillCache = actor.cache._skill?.trained
      const trainedSkills = flatten(Object.values(skillCache ?? {}).map(idMap => Object.values(idMap)))
      const trainedSkillsGCA = trainedSkills.map(skill => skill.__compilation.sources.gca?._index).filter(index => !isNil(index)) as number[]

      for (const _default of this.defaults) {
        const targets = Object.values(_default.targets ?? {})
        // skill targets compatible (clear for defaulting, usually are trained skills)
        const compatibleTargets = targets.filter(target => {
          if (target.type !== `skill`) return true

          // check if all skills are trained
          const skills = target.value as number[]
          if (!skills || skills?.length === 0) return false

          return skills.some(skill => skill !== this.__compilation.sources.gca?._index && trainedSkillsGCA.includes(skill))
        })

        // if are targets are compatible (type any OR type skill and trained)
        if (compatibleTargets.length === targets.length) {
          const defaultLevel = _default.parse(this, actor)

          // ERROR: Unimplemented
          if (!defaultLevel) debugger
          if (targets.length !== 1) debugger

          sourcedLevel.push({
            level: defaultLevel?.level as number,
            source: {
              type: targets[0].type,
              name: targets[0].fullName,
            },
            raw: _default,
          })
        }
      }

      const orderedLevels = orderBy(sourcedLevel, level => level.level, `desc`)
      if (orderedLevels.length === 0) return null

      const highest = orderedLevels[0]
      const flags = highest.source.type === `attribute` && highest.source.name !== this.attribute ? [`other-based`] : []
      const level = buildLevel(highest.level, skillModifier + actorBonus, { [highest.source.type]: highest.source.name, flags })
      debugger
      return level
    }
  }

  /**
   * (For "MoveFeature") Set feature as default move in actor
   */
  setMoveDefault() {
    // TODO: there should be a reference to actor here?
    const actor = this._actor

    if (this.path) {
      console.log(`setMoveDefault`, this.path.split(`.`)[2])
      actor.setMoveDefault(this.path.split(`.`)[2])
    }
  }

  static linkForDefenses(feature: GenericFeature) {
    if (feature.type.compare(`spell`)) return []

    const links = [] as string[]

    // BLOCK
    if (feature.weapons?.length > 0) {
      const canBlock = feature.weapons.filter((weapon: IWeaponFeature) => weapon.block !== false)
      if (canBlock.length > 0) links.push(`defenses.block`)
    }
    if (feature.activeDefense?.block?.length) links.push(`defenses.block`)

    // DODGE
    if (feature.activeDefense?.dodge?.length) {
      debugger
      links.push(`defenses.dodge`)
    }

    // PARRY
    if (feature.weapons?.length > 0) {
      const canParry = feature.weapons.filter((weapon: IWeaponFeature) => weapon.parry !== false)
      if (canParry.length > 0) links.push(`defenses.parry`)
    }
    if (feature.activeDefense?.parry?.length) links.push(`defenses.parry`)

    return uniq(links)
  }
}
