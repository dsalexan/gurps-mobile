import GenericFeature from "./generic"
import BaseFeature, { FeatureTemplate } from "../base"
import { GurpsMobileActor } from "../../../foundry/actor"

import WeaponFeatureCompilationTemplate from "../compilation/templates/weapon"
import { IWeaponFeature } from "../compilation/templates/weapon"
import { IRollDefinition } from "../../../../gurps-extension/utils/roll"
import { StringIterator } from "lodash"

export default class WeaponFeature extends GenericFeature implements IWeaponFeature {
  block: string | false
  damage: string
  parry: string | false
  range: string
  reach: string[]
  usage: string
  strength: number

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
