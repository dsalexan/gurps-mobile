import { observable } from "mobx"
import { GCS } from "../../../../gurps-extension/types/gcs"
import { Type, Utils } from "../../../core/feature"
import CompilationTemplate from "../../../core/feature/compilation/template"
import FeatureFactory from "../../../core/feature/factory"
import { GCA } from "../../../core/gca/types"
import BaseContextTemplate, { ContextSpecs } from "../../actor-sheet/context/context"
import { GurpsMobileActor } from "../actor"
import { cloneDeep, get, isFunction, pickBy } from "lodash"
import { push } from "../../../../december/utils/lodash"
import ManualCompilationTemplate from "../../../core/feature/compilation/manual"

function derive()

export interface IFeatureData {
  name: string
}

export type FeatureSources<TManualSource extends Record<string, any>> = {
  gca: GCA.Entry
  gcs: GCS.Entry
  manual: TManualSource
}

export type FeatureTemplate<TManualSource extends Record<string, any>> = {
  key?: () => number | number[]
}

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
export default class Feature<TData extends IFeatureData, TManualSource extends Record<string, any>> {
  // manager data
  actor: GurpsMobileActor // fill at integrate
  factory: FeatureFactory // fill externally, after construction
  // meta data
  __: {
    //
    compilation: {
      previousSources: FeatureSources<TManualSource>
      templates: Record<number, (typeof CompilationTemplate)[]>
    }
    //
    context: {
      templates: (typeof BaseContextTemplate)[]
      specs: Partial<ContextSpecs>
    }
  }
  // reactive data
  sources: FeatureSources<TManualSource>
  data: TData
  // immutable data
  type: Type // weird case, set lately on GCS setting
  id: string
  key: {
    tree: (string | number)[]
    value: number
  }
  parent: Feature<IFeatureData, TManualSource> | null
  children: Feature<IFeatureData, TManualSource>[]
  // TODO: add path, key and prefix to GCS source

  constructor(id: string, key: string | number, parent: Feature<IFeatureData, TManualSource> | null = null, template: FeatureTemplate<TManualSource> = {}) {
    // META DATA
    this.__ = {
      compilation: {
        previousSources: {} as any,
        templates: {},
      },
      context: {
        templates: [],
        specs: {},
      },
    }

    // REACTIVE DATA
    this.sources = observable<FeatureSources<TManualSource>>({} as FeatureSources<TManualSource>)
    this.data = observable<TData>({} as TData)

    const key_tree = Utils.keyTree(
      this,
      get(template, `key`, k => k),
    )
    // IMMUTABLE DATA
    this.id = id
    this.key = { tree: key_tree, value: Utils.keyTreeValue(key_tree) }
    this.parent = parent
    this.children = []
  }

  addManualSource(manual: TManualSource) {
    const baseStrategy = pickBy(manual, (value, key) => isFunction(value))
    const source = pickBy(manual, (value, key) => !isFunction(value))

    if (Object.keys(source).length > 0) this.sources[`manual`] = cloneDeep(source) as TManualSource
    if (Object.keys(baseStrategy).length > 0) this.addCompilation(ManualCompilationTemplate.build(baseStrategy), -1)
  }

  addCompilation(template: CompilationTemplate, priority: number | null = null) {
    const prio = priority ?? Object.keys(this.__.compilation.templates).filter(p => p !== `-1`).length

    push(this.__.compilation.templates, prio, template)

    return this
  }

  // #region INTEGRATING

  /**
   * Integrates feature into sheetData before rendering
   * A GenericFeature, by default, has no required integrations
   */
  integrate(actor: GurpsMobileActor) {
    if (actor.id === null) throw new Error(`Actor is missing an id`)
    this.actor = actor

    // register feature
    actor.setFeature(this.id, this)
    if (GURPS._cache.actors[actor.id].paths === undefined) GURPS._cache.actors[actor.id].paths = {}
    // TODO: What to do here? Get path after source/add
    // if (this.path) GURPS._cache.actors[actor.id].paths[this.path] = this.id

    // link
    // TODO: Cache link on compile/links
    // if (this.links) actor.cacheLink(this.id, ...this.links)

    return this
  }

  // #endregion
}
