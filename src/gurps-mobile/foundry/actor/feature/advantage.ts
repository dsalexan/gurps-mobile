import { get, has, isArray, isEmpty, isNil, isString, uniq } from "lodash"
import Feature, { FeatureTemplate } from "."
import { ToggableValue } from "../../../core/feature/base"
import LOGGER from "../../../logger"
import { AdvantageFeaturePipeline, IAdvantageFeatureData } from "./pipelines/advantage"
import { Utils } from "../../../core/feature"
import { GurpsMobileActor } from "../actor"
import { IUsableFeatureData, WeaponizableFeaturePipeline } from "./pipelines/usable"
import FeatureWeaponsDataContextTemplate from "../../actor-sheet/context/feature/usable"
import { isNilOrEmpty } from "../../../../december/utils/lodash"
import { GURPS4th } from "../../../../gurps-extension/types/gurps4th"
import GenericFeature from "./generic"

export default class AdvantageFeature extends GenericFeature {
  declare data: IAdvantageFeatureData

  constructor(id: string, key: number | number[], parent?: Feature<any, any>, template?: FeatureTemplate) {
    super(id, key, parent, template)
    this.addPipeline(AdvantageFeaturePipeline)
  }

  _integrate(actor: GurpsMobileActor) {
    super._integrate(actor)

    return this
  }

  // #region GCA query
  prepareQueryGCA() {
    const parameters = super.prepareQueryGCA()

    if (this.data) {
      if (this.data.name === `Talent`) {
        // TODO: Talent is a special case, its GCA counterpart is "_New Talent" and i'm not in the mood to deal with that
        return { directive: `skip` } as const
      } else if (this.data.name === `List`) {
        // just a container for other features
        return { directive: `skip` } as const
      }
    }

    if (!!parameters.name?.match(/Language/i) && this.data.tags.includes(`Language`)) {
      parameters.name = `Language`
      parameters.type = `LANGUAGES` as any
    }

    return { ...parameters }
  }

  // #endregion
}
