import { get, has, isArray, isEmpty, isNil, isString, uniq } from "lodash"
import Feature, { FeatureTemplate, IFeatureData } from "."
import { ToggableValue } from "../../../core/feature/base"
import LOGGER from "../../../logger"
import { GenericFeaturePipeline, IGenericFeatureData } from "./pipelines/generic"
import { Utils } from "../../../core/feature"
import { GurpsMobileActor } from "../actor"
import { IWeaponizableFeatureData, WeaponizableFeaturePipeline } from "./pipelines/weaponizable"
import FeatureWeaponsDataContextTemplate from "../../actor-sheet/context/feature/weapons"
import { isNilOrEmpty } from "../../../../december/utils/lodash"
import { GURPS4th } from "../../../../gurps-extension/types/gurps4th"
import { GenericSource } from "./pipelines"
import { ILevel } from "../../../../gurps-extension/utils/level"
import FeatureProxiesDataContextTemplate from "../../actor-sheet/context/feature/proxy"

export default class GenericFeature extends Feature<IGenericFeatureData & IWeaponizableFeatureData, any> {
  constructor(id: string, key: number | number[], parent?: Feature<any, any>, template?: FeatureTemplate) {
    super(id, key, parent, template)
    this.addPipeline(GenericFeaturePipeline)
    this.addPipeline(WeaponizableFeaturePipeline)

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

    // if (this.id === `e0cd7330-a694-442e-9bca-e7ead83585aa`) debugger

    // register feature
    if (actor.cache.features[this.id] !== undefined) {
      const label = `${this.id}:${this.data.name ?? `(unnamed)`}`
      const parentLabel = !this.parent ? `` : ` @ (${this.parent.id}:${this.parent.data.name ?? `(unnamed parent)`})`
      logger.warn(`integrate`, `Feature`, `${label}${parentLabel}`, `already exists in cache`, this, [
        `color: #826835;`,
        `color: rgba(130, 104, 53, 60%); font-style: italic;`,
        `color: black; font-style: regular; font-weight: bold`,
        `color: rgba(130, 104, 53, 60%); font-style: italic;`,
        ``,
      ])
    }
    actor.setFeature(this.id, this)

    // if (this.data.weapons?.map(feature => feature.integrateOn === undefined)) debugger
    // if (this.data.weapons && this.id === `8b8ce453-82c9-4a9b-9fa3-877e3e495bad`) debugger
    if (this.data.weapons) {
      for (const weapon of this.data.weapons) {
        const alreadyCompiled = weapon.__.compilation.compilations > 0

        // LOGGER.info(
        //   `GenericFeature:assign:integrateOn${alreadyCompiled ? ` (:integrate)` : ``}`,
        //   weapon.id,
        //   weapon.data.name,
        //   `@`,
        //   weapon.parent.id,
        //   weapon.parent.data.name,
        //   weapon,
        // )
        weapon.integrateOn(`compile:gcs`, actor)
        if (alreadyCompiled) weapon.integrate(actor)
      }
    }

    // COMPONENTS
    if (this.data.components) {
      for (const component of this.data.components) {
        component.feature = this
        if (!has(actor.cache, `components.${component.type}`)) actor.setCache(`components.${component.type}`, [])
        const modifierArray = get(actor.cache, `components.${component.type}`)
        if (isArray(modifierArray)) modifierArray.push(component)
      }
    }

    // LINK
    //    generic
    const sheetLinks = get(actor.cache.links, `${this.id}`) ?? []
    this.data.links = sheetLinks.map(uuid => actor.cache.features?.[uuid]?.data.name ?? `<Missing link:${uuid}>`)

    //    defenses
    this.data.links.push(...GenericFeature.linkForDefenses(this))
    this.data.links = uniq(this.data.links)

    actor.cacheLink(this.id, ...this.data.links)

    // TECH_LEVEL
    if (this.data.tl?.required && isNilOrEmpty(this.data.tl.level)) {
      // ERROR: Untrained take TL from default, and all shit from GCS should come with tech_level already
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

    const name = this.data.name
    const specializedName = isNil(this.data.specialization) ? this.data.name : this.specializedName
    const merge = true

    return { ...parameters, directive: `continue` as const, name, specializedName, merge }
  }

  // #endregion

  // #region FOUNDRY

  /**
   * Any change made here should not affect the html (this._manager.nodes), it will be done inside _updateHTML or _replaceHTML at actor sheet
   */
  _toggleFlag<T>(key: string | number, value: ToggableValue<T> = `__TOGGLE__`, { id = null, removeFalse = true }: { id?: string | null; removeFalse?: boolean } = {}) {
    // TODO: there should be a reference to actor here?
    const actor = this.actor

    const _id = id ?? this.id

    const _value = value === `__TOGGLE__` ? !actor.getFlag(`gurps`, `${key}.${_id}`) : value

    if (_value) return actor.update({ [`flags.gurps.${key}.${_id}`]: _value })
    else if (removeFalse) return actor.update({ [`flags.gurps.${key}.-=${_id}`]: null })
    else return actor.update({ [`flags.gurps.${key}.${_id}`]: false })
  }

  /**
   * Toogle HIDDEN flag
   */
  hide<T>(listID: string, value: ToggableValue<T> = `__TOGGLE__`) {
    // ERROR: It NEEDS a list ID to update hidden
    // eslint-disable-next-line no-debugger
    if (isNil(listID) || isEmpty(listID) || !isString(listID)) debugger

    const _listID = listID.replaceAll(/\./g, `-`)

    const flag = get(this.actor.flags, `gurps.mobile.features.hidden.${this.id}`) ?? {}
    const current = flag[_listID] as T

    let _value = value as T | boolean
    if (_value === `__TOGGLE__`) _value = !current

    flag[_listID] = _value

    this._toggleFlag(`mobile.features.hidden`, flag)
  }

  /**
   * Toogle PIN flag
   */
  pin(value?: boolean) {
    this._toggleFlag(`mobile.features.pinned`, value)
  }

  /**
   * Toogle EXAPANDED flag
   */
  expand<T>(dataId: string, value: ToggableValue<T> = `__TOGGLE__`) {
    // ERROR: It NEEDS a list ID to update hidden
    // eslint-disable-next-line no-debugger
    if (isNil(dataId) || isEmpty(dataId) || !isString(dataId)) debugger

    const _dataId = dataId.replaceAll(/\./g, `-`)

    const flag = get(this.actor.flags, `gurps.mobile.features.expanded.${this.id}`) ?? {}
    const current = flag[_dataId] as T

    let _value = value as T | boolean
    if (_value === `__TOGGLE__`) _value = !current

    flag[_dataId] = _value

    this._toggleFlag(`mobile.features.expanded`, flag)
  }

  /**
   * Toogle ROLLER flag
   */
  roller<T>(dataId: string, value: ToggableValue<T> = `__TOGGLE__`) {
    // ERROR: It NEEDS a list ID to update hidden
    // eslint-disable-next-line no-debugger
    if (isNil(dataId) || isEmpty(dataId) || !isString(dataId)) debugger

    const _dataId = dataId.replaceAll(/\./g, `-`)

    const flag = get(this.actor.flags, `gurps.mobile.features.roller.${this.id}`) ?? {}
    const current = flag[_dataId] as T

    let _value = value as T | boolean
    if (_value === `__TOGGLE__`) _value = !current

    flag[_dataId] = _value

    this._toggleFlag(`mobile.features.roller`, flag)
  }

  // #endregion

  /**
   * Returns best level for feature
   */
  calcLevel(attribute?: GURPS4th.AttributesAndCharacteristics): ILevel | null {
    const actor = this.actor

    throw new Error(`Unimplemented level calculation for generic feature`)
  }

  static linkForDefenses(feature: GenericFeature) {
    if (feature.type && feature.type.compare(`spell`)) return []

    const links = [] as string[]

    // BLOCK
    if (feature.data.weapons?.length > 0) {
      const canBlock = feature.data.weapons.filter((weapon: Feature<never>) => weapon.block !== false)
      if (canBlock.length > 0) links.push(`defenses.block`)
    }
    if (feature.data.activeDefense?.block?.length) links.push(`defenses.block`)

    // DODGE
    if (feature.data.activeDefense?.dodge?.length) {
      debugger
      links.push(`defenses.dodge`)
    }

    // PARRY
    if (feature.data.weapons?.length > 0) {
      const canParry = feature.data.weapons.filter((weapon: Feature<never>) => weapon.parry !== false)
      if (canParry.length > 0) links.push(`defenses.parry`)
    }
    if (feature.data.activeDefense?.parry?.length) links.push(`defenses.parry`)

    return uniq(links)
  }
}
