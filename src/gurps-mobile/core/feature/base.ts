import { cloneDeep, flatten, get, has, isArray, isEmpty, isFunction, isNil, isObjectLike, isString, omit, pickBy, sortBy, uniq } from "lodash"
import { FEATURE, Type } from "./type"
import { isNilOrEmpty, push } from "../../../december/utils/lodash"
import { Utils } from "."

import OrderedDict from "js-ordered-dict"
import LOGGER from "../../logger"
import { GurpsMobileActor } from "../../foundry/actor"
import CompilationTemplate, { CompilationContext, GURPSSources, ManualTemplateProperty } from "./compilation/template"
import ManualCompilationTemplate from "./compilation/manual"
import WeaponFeature from "./variants/weapon"
import FeatureFactory from "./factory"

import { MigratableObject, MigrationDataObject, buildMigratableObject, completeMigrationValueDefinitions } from "./compilation/migration"
import { GCA as _GCA } from "../gca/types"
import BaseContextTemplate, { ContextSpecs } from "../../foundry/actor-sheet/context/context"
import { IRollDefinition } from "../../../gurps-extension/utils/roll"
import { IComponentDefinition } from "../../../gurps-extension/utils/component"

// export interface SkillDefault {
//   _raw: string
//   type: `skill` | `attribute` | `unknown`
//   skill: number[]
//   modifier: number
//   text: string
// }

export interface IFeature {
  key: string | number
  path: string | null
  parent?: BaseFeature | null
  children: BaseFeature[]
  group?: string
  links: string[]

  type: Type
  id: string
  name: string
  label: string
  specialization?: string
  specializationRequired?: boolean
  tl?: number
  tlRange?: string
  tlRequired?: boolean
  container: boolean

  categories: string[]
  notes: string[]
  meta: string
  reference: string[]
  tags: string[]
  conditional: string[]
  components: IComponentDefinition[]
}

export type ManualSourceProperty<TValue> = (sources: Record<string, object>, context: Record<string, any>) => TValue
// export type ManualSourceProperty<TValue, TSources extends Record<string, object>> = (sources: TSources, context: Record<string, any>) => TValue
// export type ManualSourceProperty<TValue, TSources extends Record<string, object>, TContext extends Record<string, any>> = (sources: TSources, context: TContext) => TValue

export interface FeatureTemplate<TManualSource extends Record<string, any>> {
  factory?: FeatureFactory
  context?: {
    manager?: never
    templates?: typeof BaseContextTemplate | (typeof BaseContextTemplate)[]
    specs?: Partial<ContextSpecs>
  }
  manual?: TManualSource
  key?: () => number | number[]
  weapons?: FeatureTemplate<never>
}

export type ToggableValue<T> = `__TOGGLE__` | T

/**
 * GCS Feature -> Foundry (GURPS 4th Aid) -> GURPS Mobile -> Handlebars-Ready Object -> HTML
 *
 *  GCS Feature -> Foundry (GURPS 4th Aid)
 *    Done when importing from GCS into Foundry
 *
 *  Foundry (GURPS 4th Aid) -> GURPS Mobile
 *    Done when instantiating GeneciFeature, here
 *    Also requires, somewhen, a "integration" with sheetData object
 *
 *  GURPS Mobile -> Handlebars-Ready Object
 *    Done before rendering, parses a feature into a simpler object
 *
 *  Handlebars-Ready Object -> HTML
 *    Done inside handlebars, feature.hbs
 */
export default class BaseFeature implements IFeature {
  __compilation: {
    factory: FeatureFactory
    sources: Partial<GURPSSources> & Record<string, object>
    templates: Record<number, (typeof CompilationTemplate)[]>
  }
  __prefix: string

  _context: { templates: (typeof BaseContextTemplate)[]; specs: Partial<ContextSpecs> }
  _node: number
  _key: {
    tree: (string | number)[]
    value: number
  }
  _actor: GurpsMobileActor

  key: string | number
  path: string | null
  parent?: BaseFeature | null
  children: BaseFeature[]
  group?: string
  links: string[]

  type: Type
  id: string
  name: string
  label: string
  specialization?: string
  specializationRequired?: boolean
  tl?: number
  tlRequired?: boolean
  tlRange?: string
  container: boolean

  value?: any
  categories: string[]
  notes: string[]
  meta: string
  reference: string[]
  tags: string[]
  conditional: string[]
  rolls?: IRollDefinition[]
  components: IComponentDefinition[]

  get specializedName() {
    return Utils.specializedName(this.name, this.specialization)
  }

  constructor(key: string | number, prefix = `system.`, parent: BaseFeature | null = null, template: FeatureTemplate<any>) {
    // compilation stuff
    this.__compilation = {
      factory: template.factory as any,
      sources: {},
      templates: {},
    }

    this.__prefix = prefix

    // CONTEXT
    this._context = {} as any
    this._context.templates = template.context?.templates ? (isArray(template.context?.templates) ? template.context?.templates : [template.context?.templates]) : []
    this._context.specs = template.context?.specs ?? {}

    // COMPILATION
    if (template.manual) {
      const baseStrategy = pickBy(template.manual, (value, key) => isFunction(value))
      const source = pickBy(template.manual, (value, key) => !isFunction(value))

      if (Object.keys(source).length > 0) this.addSource(`manual`, source)
      if (Object.keys(baseStrategy).length > 0) this.addCompilation(ManualCompilationTemplate.build(baseStrategy), -1)
    }

    // BASE DATA
    this.key = key
    this.path = !isNil(prefix) && !isNil(key) ? `${prefix}${key}` : null
    this.parent = parent
    this.children = []

    const key_tree = Utils.keyTree(
      this,
      get(template, `key`, k => k),
    )
    this._key = { tree: key_tree, value: Utils.keyTreeValue(key_tree) }

    if (this.parent) this.group = Utils.name(this.parent)
  }

  serialize(deep = false) {
    const keys = Object.keys(this).filter(key => !key.match(/^_+/))
    const tuples = keys.map(key => {
      const value = this[key]

      if (key === `parent` && !isNil(value)) {
        if (deep) return [key, value.serialize(deep)]
        return [key, value.name ?? value.id ?? `<unknown>`]
      }

      return [key, value]
    })

    const entries = tuples.filter(([key, value]) => {
      if (isArray(value)) return value.length >= 1
      return !isNil(value) && !isEmpty(value)
    })

    return Object.fromEntries(entries)
  }

  // #region COMPILING
  addSource(name: string, source: object) {
    if (has(this.__compilation.sources, name)) throw new Error(`Source "${name}" is already set`)

    this.__compilation.sources[name] = cloneDeep(source)

    return this
  }

  addCompilation(template: CompilationTemplate, priority: number | null = null) {
    const prio = priority ?? Object.keys(this.__compilation.templates).filter(p => p !== `-1`).length

    push(this.__compilation.templates, prio, template)

    return this
  }

  compile(baseContext = {}): this {
    const prios = sortBy(Object.keys(this.__compilation.templates).map(key => parseInt(key)))
    const sources = Object.keys(this.__compilation.sources)

    const MDOsByTemplate = {} as Record<string, MigrationDataObject>
    const context: CompilationContext = baseContext as any

    // for each template
    for (const prio of prios) {
      for (const template of this.__compilation.templates[prio]) {
        const isManual = template.name === `Manual`
        const MDOsBySource = {} as Record<string, MigrationDataObject>

        //    for each source
        const _sources = isManual ? [`manual`] : sources
        for (const sourceName of _sources) {
          const allSources = isManual || sourceName === `manual`
          const baseSource = allSources ? this.__compilation.sources : this.__compilation.sources[sourceName]
          if (baseSource === undefined) continue

          //      compile each template into a MigratableDataObject
          const source = template.source(sourceName, baseSource, context)
          const sourceMDO = template.compile(sourceName, source, context)

          if (sourceMDO && Object.keys(sourceMDO).length >= 1) {
            // completeMigrationValueDefinitions(MDO, { name: `manual` } as typeof CompilationTemplate, prio, { sources: Object.keys(sources) })
            completeMigrationValueDefinitions(sourceMDO, template, prio, { sources: allSources ? Object.keys(this.__compilation.sources) : [sourceName] })

            MDOsBySource[sourceName] = sourceMDO
          }
        }

        //      merge all MDO from each source into a single MDO
        //        there should be NO conflict here, since I can resolve all preemptively by choosing suitable MigrationModes
        const templateMDO = {} as MigrationDataObject

        const MDOs = Object.values(MDOsBySource)
        const allKeys = uniq(flatten(MDOs.map(mdo => Object.keys(mdo))))

        for (const key of allKeys) {
          const values = flatten(MDOs.map(mdo => mdo[key]).filter(item => !isNil(item)))
          templateMDO[key] = values
        }

        MDOsByTemplate[template.name] = templateMDO
      }
    }

    // migrate for each template (conflict resolution should be dealt with by applying the correct MigrationMode)
    const data = buildMigratableObject() as MigratableObject
    for (const mdo of Object.values(MDOsByTemplate)) data.migrate(mdo, context, this.__compilation.sources)

    // for each template
    const postMDOs = [] as MigrationDataObject[]
    for (const prio of prios) {
      for (const template of this.__compilation.templates[prio]) {
        //    run post treatments
        const mdo = template.post(data, context, this.__compilation.sources, this)
        if (mdo && Object.keys(mdo).length >= 1) postMDOs.push(completeMigrationValueDefinitions(mdo, template, prio, { sources: [`post`] }))
      }
    }

    // migrate for each post MDO
    for (const mdo of postMDOs) data.migrate(mdo, context, this.__compilation.sources)

    // inject values into feature
    for (const key of Object.keys(data)) {
      if (key === `migrate` || key === `migrationsByKey` || key === `migrations`) continue
      if (data[key] === undefined) continue
      this[key] = data[key]
    }

    // ERROR: No name/type is no good
    // eslint-disable-next-line no-debugger
    if (isNilOrEmpty(this.name) || isNilOrEmpty(this.type)) debugger

    return this
  }

  // #endregion

  // #region INTEGRATING

  /**
   * Build GCA query commands
   */
  _queryGCA() {
    const name = this.name
    const specializedName = this.specializedName !== this.name ? this.specializedName : undefined
    const type = this.type.value
    const merge = true

    return { name, specializedName, type, merge }
  }

  /**
   * Load and compile GCA object (by querying pre-loaded extraction)
   */
  loadFromGCA(cache = false) {
    if (this.type.compare(FEATURE.GENERIC)) {
      LOGGER.get(`gca`).warn(`Cannot query a generic feature`, this)
      return this
    }

    if (this.name === undefined) {
      LOGGER.get(`gca`).warn(`Cannot query a nameless feature`, this)
      return this
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
    ]
    if (skips.some(pattern => this.name.match(pattern))) return this

    let entry: _GCA.Entry | null

    // load GCA into feature
    if (cache) {
      // eslint-disable-next-line no-undef
      entry = GCA.getCache(this.id)
      if (entry !== undefined) return
    }

    const { name, specializedName, type, merge } = this._queryGCA()
    entry = GCA.query(name, specializedName, type)

    // eslint-disable-next-line no-undef
    GCA.setCache(this.id, entry)

    if (!isNil(entry)) {
      this.addSource(`gca`, entry)
      this.compile()
    }

    return this
  }

  /**
   * Integrates feature into sheetData before rendering
   * A GenericFeature, by default, has no required integrations
   */
  integrate(actor: GurpsMobileActor) {
    if (actor.id === null) throw new Error(`Actor is missing an id`)
    this._actor = actor

    // register feature
    actor.setFeature(this.id, this)
    if (GURPS._cache.actors[actor.id].paths === undefined) GURPS._cache.actors[actor.id].paths = {}
    if (this.path) GURPS._cache.actors[actor.id].paths[this.path] = this.id

    // link
    if (this.links) actor.cacheLink(this.id, ...this.links)

    return this
  }

  // #endregion

  // #region FOUNDRY

  /**
   * Any change made here should not affect the html (this._manager.nodes), it will be done inside _updateHTML or _replaceHTML at actor sheet
   */
  _toggleFlag<T>(key: string | number, value: ToggableValue<T> = `__TOGGLE__`, { id = null, removeFalse = true }: { id?: string | null; removeFalse?: boolean } = {}) {
    // TODO: there should be a reference to actor here?
    const actor = this._actor

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

    const flag = get(this._actor.flags, `gurps.mobile.features.hidden.${this.id}`) ?? {}
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
   * Toogle COLLAPSE flag
   */
  collapse(value?: boolean) {
    this._toggleFlag(`mobile.features.collapsed`, value)
  }

  // #endregion
}
