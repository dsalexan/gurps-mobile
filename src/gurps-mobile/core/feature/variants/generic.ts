import { GurpsMobileActor } from "../../../foundry/actor"
import BaseFeature, { FeatureTemplate, IFeature } from "../base"
import { IWeaponizableFeature } from "../compilation/templates/weaponizable"

import GenericFeatureCompilationTemplate from "../compilation/templates/generic"
import WeaponizableFeatureCompilationTemplate from "../compilation/templates/weaponizable"
import { cloneDeep, get, has, isArray, isNil, orderBy, sum, uniq } from "lodash"
import FeatureWeaponsDataContextTemplate from "../../../foundry/actor-sheet/context/feature/weapons"
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
  levels?: ILevelDefinition[]
  activeDefense?: Record<`block` | `dodge` | `parry`, string[]>

  reference: string[]

  level(attribute: GURPS4th.AttributesAndCharacteristics): ILevel | null
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
  levels?: ILevelDefinition[]

  weapons: WeaponFeature[]
  activeDefense?: Record<`block` | `dodge` | `parry`, string[]>

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
  level(attribute?: GURPS4th.AttributesAndCharacteristics) {
    if (this.levels) {
      const levels = orderLevels(this.levels, this, this._actor)

      // if (feature.specializedName === `Armoury (Body Armor)`) debugger

      if (levels.length > 0) return levels[0]
    }

    return null
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
