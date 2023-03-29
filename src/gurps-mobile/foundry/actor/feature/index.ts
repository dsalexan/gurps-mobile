import { observable } from "mobx"
import { GCS } from "../../../../gurps-extension/types/gcs"
import { Type, Utils } from "../../../core/feature"
import CompilationTemplate from "../../../core/feature/compilation/template"
import FeatureFactory from "../../../core/feature/factory"
import { GCA } from "../../../core/gca/types"
import BaseContextTemplate, { ContextSpecs } from "../../actor-sheet/context/context"
import { GurpsMobileActor } from "../actor"
import { cloneDeep, get, isArray, isFunction, pickBy } from "lodash"
import { push } from "../../../../december/utils/lodash"
import ManualCompilationTemplate from "../../../core/feature/compilation/manual"
import { IDerivation } from "./derivation"

export interface IFeatureData {
  name: string
}

export type FeatureSources<TManualSource extends Record<string, any>> = {
  gca: GCA.Entry
  gcs: GCS.Entry
  manual: TManualSource
}

export type FeatureTemplate<TManualSource extends Record<string, any>> = {
  context: {
    templates: typeof BaseContextTemplate | (typeof BaseContextTemplate)[]
  }
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
      previousData: TData
      derivations: Record<number, IDerivation<string, string>[]>
      derivationsByTarget: Record<string, Record<number, IDerivation<string, string>[]>>
      derivationsByDestination: Record<string, Record<number, IDerivation<string, string>[]>>
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

  constructor(id: string, key: string | number, parent: Feature<IFeatureData, TManualSource> | null = null, template: Partial<FeatureTemplate<TManualSource>> = {}) {
    // META DATA
    this.__ = {
      compilation: {
        previousSources: {} as any,
        previousData: {} as any,
        derivations: {},
        derivationsByTarget: {},
        derivationsByDestination: {},
      },
      context: {
        templates: template.context?.templates ? (isArray(template.context?.templates) ? template.context?.templates : [template.context?.templates]) : [],
        specs: {},
      },
    }

    // REACTIVE DATA
    this.sources = {} as FeatureSources<TManualSource>
    this.data = {} as TData

    const key_tree = Utils.keyTree(key, parent)
    // IMMUTABLE DATA
    this.id = id
    this.key = { tree: key_tree, value: Utils.keyTreeValue(key_tree) }
    this.parent = parent
    this.children = []
  }

  addManualSource(manual: TManualSource) {
    // const baseStrategy = pickBy(manual, (value, key) => isFunction(value))
    /**
     * In a manual source, all functions are counted as "derivations", while non-functions are simple "source-data"
     * That source-data can be updated, thus causing subscribed derivations to fire
     */
    const source = pickBy(manual, (value, key) => !isFunction(value))
    const derivations = Object.values(pickBy(manual, (value, key) => isFunction(value))).map(functions => {
      // TODO: build derivation using default protocols (check concepts)
    })

    if (Object.keys(source).length > 0) this.sources[`manual`] = cloneDeep(source) as TManualSource
    // if (Object.keys(baseStrategy).length > 0) this.addCompilation(ManualCompilationTemplate.build(baseStrategy), -1)
    if (Object.keys(derivations).length > 0) this.addCompilation(ManualCompilationTemplate.build(baseStrategy), -1)

    return this
  }

  addDerivation(derivation: IDerivation<string, string>, priority: number | null = null) {
    const prio = priority ?? Object.keys(this.__.compilation.derivations).filter(p => p !== `-1`).length

    push(this.__.compilation.derivations, prio, derivation)
    for (const destination of derivation.destinations) push(this.__.compilation.derivationsByDestination[destination], prio, derivation)
    for (const target of derivation.targets) push(this.__.compilation.derivationsByDestination[target], prio, derivation)

    return this
  }

  addCompilation(template: CompilationTemplate, priority: number | null = null) {
    const prio = priority ?? Object.keys(this.__.compilation.templates).filter(p => p !== `-1`).length

    push(this.__.compilation.templates, prio, template)

    return this
  }

  compile(changes: string[]) {
    // LIST derivations by updated keys
    // EXECUTE derivations and pool results
    // APPLY results into feature data substructure (NEVER apply into source, value there is readyonly from here)
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
