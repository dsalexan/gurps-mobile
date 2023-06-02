import { get, has, isArray, isEmpty, isNil, isString, uniq } from "lodash"
import Feature, { FeatureTemplate, IFeatureData } from "."
import { ToggableValue } from "../../../core/feature/base"
import LOGGER from "../../../logger"
import { GenericFeaturePipeline, IGenericFeatureData, IGenericFeatureFormulas } from "./pipelines/generic"
import { Utils } from "../../../core/feature"
import { GurpsMobileActor } from "../actor"
import { IUsableFeatureData, UsableFeaturePipeline } from "./pipelines/usable"
import FeatureWeaponsDataContextTemplate from "../../actor-sheet/context/feature/usable"
import { isNilOrEmpty } from "../../../../december/utils/lodash"
import { GURPS4th } from "../../../../gurps-extension/types/gurps4th"
import { GenericSource } from "./pipelines"
import { ILevel } from "../../../../gurps-extension/utils/level"
import FeatureProxiesDataContextTemplate from "../../actor-sheet/context/feature/proxy"
import SkillFeature from "./skill"
import FeatureUsage from "./usage"
import { TypeIDS } from "../../../core/feature/type"
import { ParentFeaturePipeline } from "./pipelines/parent"
import FeatureChildrenDataContextTemplate from "../../actor-sheet/context/feature/children"

export default class GenericFeature extends Feature<IGenericFeatureData & IUsableFeatureData, any> {
  constructor(id: string, key: string | number | (string | number)[], parent?: Feature<any, any>, template?: FeatureTemplate) {
    super(id, key, parent, template)
    this.addPipeline(ParentFeaturePipeline)
    this.addPipeline(GenericFeaturePipeline)
    this.addPipeline(UsableFeaturePipeline)

    this.__.context.templates.push(FeatureChildrenDataContextTemplate)
    this.__.context.templates.push(FeatureWeaponsDataContextTemplate)
    this.__.context.templates.push(FeatureProxiesDataContextTemplate)
  }

  get specializedName() {
    return Utils.specializedName(this.data.name, this.data.specialization)
  }

  toString() {
    return `[${this.type.name}] ${this.specializedName ?? `Unnamed Feature`}`
  }

  /**
   * Integrates feature into sheetData before rendering
   * A GenericFeature, by default, has no required integrations2
   */
  _integrate(actor: GurpsMobileActor) {
    super._integrate(actor)

    const logger = LOGGER.get(`actor`)

    // TODO: Some things here should not be on integrate. Mostly information that depends on other features. Maybe make a "post compile" function inside feature object (not pipeline)

    // if (this.id === `e0cd7330-a694-442e-9bca-e7ead83585aa`) debugger

    // register feature
    if (actor.cache.features?.[this.id] !== undefined) {
      const label = `${this.id}:${this.data.name ?? `(unnamed)`}`
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

    if (this.data.usages) {
      for (const usage of this.data.usages) if (!usage.actor) usage.integrate(actor)
    }

    // TECH_LEVEL
    if (this.data.tl?.required && isNilOrEmpty(this.data.tl.level)) {
      // ERROR: Untrained take TL from default, and all shit from GCS should come with tech_level already
      // eslint-disable-next-line no-debugger
      debugger
    }

    return this
  }

  // #region GCA query
  prepareQueryGCA() {
    const parameters = super.prepareQueryGCA()

    if (this.data.name === undefined) {
      LOGGER.get(`gca`).warn(`Cannot query a nameless feature`, this)
      parameters.directive = `skip`
      return parameters
    }

    if (this.data.container) {
      parameters.directive = `skip`
      return parameters
    }

    const skips = [
      /natural attacks?/i,
      /gadgets?/i,
      /primary skills?/i,
      /secondary skills?/i,
      /background skills?/i,
      /cinematic skills?/i,
      /racial skills?/i,
      /techniques?/i,
      /cinematic techniques?/i,
      /quirk i{0,3}v?i{0,3}/i,
    ]
    if (skips.some(pattern => this.data.name.match(pattern))) {
      parameters.directive = `skip`
      return parameters
    }

    let name = this.data.name
    let specializedName = isNil(this.data.specialization) ? this.data.name : this.specializedName
    const merge = true

    if (this.data.basedOn?.length) {
      // ERROR: Unimplemented multiple basedOn
      if (this.data.basedOn?.length > 1) debugger

      const basedOn = this.data.basedOn[0]

      // Unimplemented basedOn type
      if (![...TypeIDS, undefined].includes(basedOn.type as any)) debugger

      name = basedOn.name
      specializedName = basedOn.fullName
      parameters.type = basedOn.type as any

      parameters.fromBasedOn = true
    }

    return { ...parameters, directive: `continue` as const, name, specializedName, merge }
  }

  // loadFromGCA(cache = false) {
  //   super.loadFromGCA(cache)

  //   return this
  // }

  // #endregion

  // #region FOUNDRY

  /**
   * Toogle ROLLER flag
   */
  roller<T>(actor: GurpsMobileActor, listId: string, value: ToggableValue<T> = `__TOGGLE__`) {
    // ERROR: It NEEDS a list ID to update hidden
    // eslint-disable-next-line no-debugger
    if (isNil(listId) || isEmpty(listId) || !isString(listId)) debugger

    const _listId = listId.replaceAll(/\./g, `-`)

    const flag = get(actor.flags, `gurps.mobile.features.roller.${this.id}`) ?? {}
    const current = flag[_listId] as T

    let _value = value as T | boolean
    if (_value === `__TOGGLE__`) _value = !current

    flag[_listId] = _value

    this._toggleFlag(actor, `mobile.features.roller`, flag)
  }

  // #endregion

  /**
   * Returns best level for feature
   */
  calcLevel(attribute?: GURPS4th.AttributesAndCharacteristics): ILevel | null {
    const actor = this.actor

    throw new Error(`Unimplemented level calculation for generic feature`)
  }
}
