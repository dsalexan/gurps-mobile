import { cloneDeep } from "lodash"
import { GurpsMobileActor } from "../../foundry/actor"
import GenericFeature from "../../foundry/actor/feature/generic"

export class FeatureCollection<TFeature extends GenericFeature = GenericFeature> {
  items: TFeature[]

  constructor(items: TFeature[] = []) {
    this.items = items
  }

  add(...items: TFeature[]) {
    this.items.push(...items)
  }

  loadFromGCA(cache = false) {
    this.items.map(item => item.loadFromGCA(cache))

    return this
  }

  loadFromGCAOn(eventName: string, cache = false) {
    this.items.map(item => item.on(eventName, event => event.data.feature.loadFromGCA(cache)))
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

  integrateOn(eventName: string, actor: GurpsMobileActor) {
    this.items.map(item => item.on(eventName, event => event.data.feature.integrate(actor)))
    return this
  }
}
