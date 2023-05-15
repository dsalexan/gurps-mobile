import { get, has, isArray, isEmpty, isNil, isString, uniq } from "lodash"
import Feature, { FeatureTemplate } from "."
import { ToggableValue } from "../../../core/feature/base"
import LOGGER from "../../../logger"
import { DefenseFeaturePipeline, IDefenseFeatureData } from "./pipelines/defense"
import { Utils } from "../../../core/feature"
import { GurpsMobileActor } from "../actor"
import { IUsableFeatureData, WeaponizableFeaturePipeline } from "./pipelines/usable"
import FeatureWeaponsDataContextTemplate from "../../actor-sheet/context/feature/weapons"
import { isNilOrEmpty } from "../../../../december/utils/lodash"
import { GURPS4th } from "../../../../gurps-extension/types/gurps4th"
import GenericFeature from "./generic"

export default class DefenseFeature extends GenericFeature {
  declare data: IDefenseFeatureData

  defense: `block` | `dodge` | `parry`

  constructor(id: string, key: number | number[], parent?: Feature<any, any>, template?: FeatureTemplate) {
    super(id, key, parent, template)
    this.addPipeline(DefenseFeaturePipeline)

    this.defense = id.replace(`activedefense-`, ``) as `block` | `dodge` | `parry`
  }

  _integrate(actor: GurpsMobileActor) {
    super._integrate(actor)

    return this
  }

  prepareQueryGCA() {
    return { directive: `skip` } as const
  }
}
