import BaseFeature, { FeatureTemplate } from "../base"
import { GurpsMobileActor } from "../../../foundry/actor"

import GenericFeature from "./generic"
import EquipmentFeatureCompilationTemplate from "../compilation/templates/equipment"
import { IEquipmentFeature } from "../compilation/templates/equipment"

export default class EquipmentFeature extends GenericFeature implements IEquipmentFeature {
  description: string
  carried: boolean
  quantity: number
  cost: { base: number | null; extended: string; unit: string }
  weight: { base: number | null; extended: string; unit: string }
  piece: { value: number; weight: number }

  constructor(key: string | number, prefix = `system.equipment.`, parent: BaseFeature | null = null, template: FeatureTemplate<any>) {
    super(key, prefix, parent, template)
    this.addCompilation(EquipmentFeatureCompilationTemplate)
  }

  // INTEGRATING
  integrate(actor: GurpsMobileActor) {
    super.integrate(actor)

    return this
  }
}
