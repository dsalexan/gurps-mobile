import { get, has, isArray, isEmpty, isNil, isString, uniq } from "lodash"
import Feature, { FeatureTemplate } from "."
import { ToggableValue } from "../../../core/feature/base"
import LOGGER from "../../../logger"
import { DefenseFeaturePipeline, IDefenseFeatureData } from "./pipelines/defense"
import { Utils } from "../../../core/feature"
import { GurpsMobileActor } from "../actor"
import FeatureWeaponsDataContextTemplate from "../../actor-sheet/context/feature/usable"
import { isNilOrEmpty } from "../../../../december/utils/lodash"
import { GURPS4th } from "../../../../gurps-extension/types/gurps4th"
import GenericFeature from "./generic"
import { GenericSource } from "./pipelines"

export default class DefenseFeature extends GenericFeature {
  declare data: IDefenseFeatureData

  constructor(id: string, key: string | number | (string | number)[], parent?: Feature<any, any>, template?: FeatureTemplate) {
    super(id, key, parent, template)
    this.addPipeline(DefenseFeaturePipeline)
  }

  _integrate(actor: GurpsMobileActor) {
    super._integrate(actor)

    return this
  }

  prepareQueryGCA() {
    return { directive: `skip` } as const
  }
}
