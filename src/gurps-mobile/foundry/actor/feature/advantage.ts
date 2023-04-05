import { get, has, isArray, isEmpty, isNil, isString, uniq } from "lodash"
import Feature, { FeatureTemplate } from "."
import { ToggableValue } from "../../../core/feature/base"
import LOGGER from "../../../logger"
import { AdvantageFeaturePipeline, IAdvantageFeatureData } from "./pipelines/advantage"
import { Utils } from "../../../core/feature"
import { GurpsMobileActor } from "../actor"
import { IWeaponizableFeatureData, WeaponizableFeaturePipeline } from "./pipelines/weaponizable"
import FeatureWeaponsDataContextTemplate from "../../actor-sheet/context/feature/weapons"
import { isNilOrEmpty } from "../../../../december/utils/lodash"
import { GURPS4th } from "../../../../gurps-extension/types/gurps4th"
import GenericFeature from "./generic"

export default class AdvantageFeature extends GenericFeature {
  declare data: IAdvantageFeatureData

  constructor(id: string, key: number | number[], parent?: Feature<any, any>, template?: FeatureTemplate) {
    super(id, key, parent, template)
    this.addPipeline(AdvantageFeaturePipeline)
  }

  integrate(actor: GurpsMobileActor) {
    super.integrate(actor)

    return this
  }

  // #region GCA query
  prepareQueryGCA() {
    const parameters = super.prepareQueryGCA()

    if (!!parameters.name?.match(/Language/i) && this.data.tags.includes(`Language`)) {
      parameters.name = `Language`
      parameters.type = `LANGUAGES` as any
    }

    return { ...parameters }
  }

  // #endregion
}
