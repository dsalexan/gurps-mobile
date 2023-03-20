import GenericFeature from "./generic"
import BaseFeature, { FeatureTemplate } from "../base"
import { GurpsMobileActor } from "../../../foundry/actor"

import WeaponFeatureCompilationTemplate from "../compilation/templates/weapon"
import { IWeaponFeature } from "../compilation/templates/weapon"
import { IRollDefinition } from "../../../../gurps-extension/utils/roll"

export default class WeaponFeature extends GenericFeature implements IWeaponFeature {
  damage: string
  parry: string
  range: string
  usage: string
  defaults: IRollDefinition[]

  constructor(key: string | number, prefix = `system.melee.`, parent: BaseFeature | null = null, template: FeatureTemplate<any>) {
    super(key, prefix, parent, template)
    this.addCompilation(WeaponFeatureCompilationTemplate)
  }

  // INTEGRATING
  integrate(actor: GurpsMobileActor) {
    super.integrate(actor)

    return this
  }
}
