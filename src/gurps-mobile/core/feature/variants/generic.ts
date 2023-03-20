import { GurpsMobileActor } from "../../../foundry/actor"
import BaseFeature, { FeatureTemplate } from "../base"
import { IWeaponizableFeature } from "../compilation/templates/weaponizable"

import GenericFeatureCompilationTemplate from "../compilation/templates/generic"
import WeaponizableFeatureCompilationTemplate from "../compilation/templates/weaponizable"
import { get } from "lodash"
import FeatureWeaponsDataContextTemplate from "../../../foundry/actor-sheet/context/feature/weapons"
import { isNilOrEmpty } from "../../../../december/utils/lodash"

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

    // LINKS
    const sheetLinks = get(actor.cache.links, `${this.id}`) ?? []
    this.links = sheetLinks.map(uuid => actor.cache.features?.[uuid]?.name ?? `<Missing link:${uuid}>`)

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
}
