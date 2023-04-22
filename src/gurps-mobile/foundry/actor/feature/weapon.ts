import { cloneDeep, flatten, get, has, isArray, isEmpty, isNil, isString, set, uniq, upperFirst } from "lodash"
import Feature, { FeatureTemplate } from "."
import { ToggableValue } from "../../../core/feature/base"
import LOGGER from "../../../logger"
import { WeaponFeaturePipeline, IWeaponFeatureData } from "./pipelines/weapon"
import { Utils } from "../../../core/feature"
import { GurpsMobileActor } from "../actor"
import { IWeaponizableFeatureData, WeaponizableFeaturePipeline } from "./pipelines/weaponizable"
import FeatureWeaponsDataContextTemplate from "../../actor-sheet/context/feature/weapons"
import { isNilOrEmpty } from "../../../../december/utils/lodash"
import { GURPS4th } from "../../../../gurps-extension/types/gurps4th"
import GenericFeature from "./generic"
import FeatureFactory from "../../../core/feature/factory"
import { specializedName } from "../../../core/feature/utils"
import { derivation, passthrough, proxy } from "./pipelines"
import { MERGE } from "../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "./pipelines/generic"
import type { GCA } from "../../../core/gca/types"

export default class WeaponFeature extends GenericFeature {
  declare data: IWeaponFeatureData

  constructor(id: string, key: number | number[], parent?: Feature<any, any>, template?: FeatureTemplate) {
    super(id, key, parent, template)
    this.addPipeline(WeaponFeaturePipeline)
  }

  _integrate(actor: GurpsMobileActor) {
    super._integrate(actor)

    return this
  }
}
