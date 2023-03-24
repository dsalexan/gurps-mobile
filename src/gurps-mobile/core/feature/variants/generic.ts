import { GurpsMobileActor } from "../../../foundry/actor"
import BaseFeature, { FeatureTemplate, IFeature } from "../base"
import { IWeaponizableFeature } from "../compilation/templates/weaponizable"

import GenericFeatureCompilationTemplate from "../compilation/templates/generic"
import WeaponizableFeatureCompilationTemplate from "../compilation/templates/weaponizable"
import { get, has, isArray } from "lodash"
import FeatureWeaponsDataContextTemplate from "../../../foundry/actor-sheet/context/feature/weapons"
import { isNilOrEmpty } from "../../../../december/utils/lodash"
import { IWeaponFeature } from "../compilation/templates/weapon"

export default class GenericFeature extends BaseFeature implements IWeaponizableFeature {
  declare value?: string | number
  weapons: BaseFeature[]

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
        if (!has(actor.cache, `modifiers.${component.type}`)) actor.setCache(`modifiers.${component.type}`, [])
        const modifierArray = get(actor.cache, `modifiers.${component.type}`) as any as any[]
        if (isArray(modifierArray)) modifierArray.push(component)
      }
    }

    // LINKS
    //    generic
    const sheetLinks = get(actor.cache.links, `${this.id}`) ?? []
    this.links = sheetLinks.map(uuid => actor.cache.features?.[uuid]?.name ?? `<Missing link:${uuid}>`)

    //    defenses
    this.links.push(...GenericFeature.linkForDefenses(this))

    actor.cacheLink(this.id, ...this.links)

    // TECH_LEVEL
    if (this.tlRequired && isNilOrEmpty(this.tl)) {
      // ERROR: Untrained take TL from default, and all shit from GCS should come with tech_level already
      debugger
    }

    return this
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

    // DODGE

    // PARRY
    if (feature.weapons?.length > 0) {
      const canParry = feature.weapons.filter((weapon: IWeaponFeature) => weapon.parry !== false)
      if (canParry.length > 0) links.push(`defenses.parry`)
    }

    return links
  }

  /**
   * Calculate active defense level for a feature
   */
  static activeDefenseLevel(activeDefense: `block` | `dodge` | `parry` | `all`, feature: GenericFeature) {
    if (feature.type.compare(`spell`)) return null

    const actor = feature._actor

    if (activeDefense === `block`) {
      debugger
    } else if (activeDefense === `dodge`) {
      debugger
    } else if (activeDefense === `parry`) {
      debugger
    }
  }
}
