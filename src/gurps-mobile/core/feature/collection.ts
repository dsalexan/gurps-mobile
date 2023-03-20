import { GurpsMobileActor } from "../../foundry/actor"
import BaseFeature, { FeatureTemplate } from "./base"

export class FeatureCollection {
  items: BaseFeature[]

  constructor(items: BaseFeature[] = []) {
    this.items = items
  }

  add(...items: BaseFeature[]) {
    this.items.push(...items)
  }

  loadFromGCA(cache = false) {
    this.items.map(item => item.loadFromGCA(cache))

    return this
  }

  /**
   * Integrates feature into sheetData before rendering
   * A BaseFeature, by default, has no required integrations
   */
  integrate(actor: GurpsMobileActor) {
    this.items.map(item => item.integrate(actor))

    return this
  }
}
