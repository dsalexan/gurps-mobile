import { flattenDeep, get, has, isArray, isEmpty, isNil, set } from "lodash"

import { GurpsMobileActor } from "../../../foundry/actor"

import BaseFeature, { FeatureTemplate } from "../base"
import GenericFeature from "./generic"
import AdvantageFeatureCompilationTemplate from "../compilation/templates/advantage"
import { IAdvantageFeature } from "../compilation/templates/advantage"

export default class AdvantageFeature extends GenericFeature implements IAdvantageFeature {
  cost: string

  /**
   * Instantiate new Advantage Feature
   */
  constructor(key: string | number, prefix = `system.ads.`, parent: BaseFeature | null = null, template: FeatureTemplate<any>) {
    super(key, prefix, parent, template)
    this.addCompilation(AdvantageFeatureCompilationTemplate)
  }

  // INTEGRATING
  _queryGCA() {
    let { name, specializedName, type, merge } = super._queryGCA()

    if (!!name.match(/Language/i) && this.tags.includes(`Language`)) {
      name = `Language`
      type = `LANGUAGES` as any
    }

    return { name, specializedName, type, merge }
  }

  integrate(actor: GurpsMobileActor) {
    super.integrate(actor)

    return this
  }
}
