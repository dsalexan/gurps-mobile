import { cloneDeep, flatten, get, has, isArray, isEmpty, isNil, isString, set, uniq, upperFirst } from "lodash"
import Feature, { FeatureTemplate } from "."
import { SpellFeaturePipeline, ISpellFeatureData } from "./pipelines/spell"
import { GurpsMobileActor } from "../actor"
import GenericFeature from "./generic"

export default class SpellFeature extends GenericFeature {
  declare data: ISpellFeatureData

  constructor(id: string, key: number | number[], parent?: Feature<any, any>, template?: FeatureTemplate) {
    super(id, key, parent, template)
    this.addPipeline(SpellFeaturePipeline)
  }

  _integrate(actor: GurpsMobileActor) {
    super._integrate(actor)

    return this
  }
}
