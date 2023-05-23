import { cloneDeep, flatten, get, has, isArray, isEmpty, isNil, isString, set, uniq, upperFirst } from "lodash"
import Feature, { FeatureTemplate } from "."
import { ToggableValue } from "../../../core/feature/base"
import LOGGER from "../../../logger"
import { FeatureUsagePipeline, IUsageFeatureData, IFeatureUsageData } from "./pipelines/usage/usage"
import { Utils } from "../../../core/feature"
import { GurpsMobileActor } from "../actor"
import FeatureWeaponsDataContextTemplate from "../../actor-sheet/context/feature/usable"
import { isNilOrEmpty } from "../../../../december/utils/lodash"
import { GURPS4th } from "../../../../gurps-extension/types/gurps4th"
import GenericFeature from "./generic"
import FeatureFactory from "../../../core/feature/factory"
import { specializedName } from "../../../core/feature/utils"
import { derivation, passthrough, proxy } from "./pipelines"
import { MERGE } from "../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "./pipelines/generic"
import type { GCA } from "../../../core/gca/types"

export default class FeatureUsage extends Feature<IFeatureUsageData, any> {
  declare data: IFeatureUsageData
  declare parent: GenericFeature

  constructor(id: string, key: number | number[], parent?: GenericFeature, template?: FeatureTemplate) {
    super(id, key, parent, template)
    this.addPipeline(FeatureUsagePipeline)
  }

  _integrate(actor: GurpsMobileActor) {
    super._integrate(actor)

    const logger = LOGGER.get(`actor`)

    // register feature
    if (actor.cache.features?.[this.id] !== undefined) {
      const label = `${this.id}:${this.data.label ?? `(unnamed)`}`
      const parentLabel = !this.parent ? `` : ` @ (${this.parent.id}:${this.parent.data.name ?? `(unnamed parent)`})`
      logger.error(`integrate`, `Feature`, `${label}${parentLabel}`, `already exists in cache`, this, [
        `color: #826835;`,
        `color: rgba(130, 104, 53, 60%); font-style: italic;`,
        `color: black; font-style: regular; font-weight: bold`,
        `color: rgba(130, 104, 53, 60%); font-style: italic;`,
        ``,
      ])
    }

    actor.setFeature(this.id, this)

    return this
  }
}
