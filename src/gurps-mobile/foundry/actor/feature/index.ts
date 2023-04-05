/* eslint-disable no-debugger */
import { GCS } from "../../../../gurps-extension/types/gcs"
import { Type, Utils } from "../../../core/feature"
import CompilationTemplate from "../../../core/feature/compilation/template"
import FeatureFactory from "../../../core/feature/factory"
import { GCA as _GCA } from "../../../core/gca/types"
import BaseContextTemplate, { ContextSpecs } from "../../actor-sheet/context/context"
import { GurpsMobileActor } from "../actor"
import { cloneDeep, flatten, get, isArray, isFunction, isNil, isObjectLike, isString, omit, pick, pickBy, sortBy, uniq } from "lodash"
import { push } from "../../../../december/utils/lodash"
import ManualCompilationTemplate from "../../../core/feature/compilation/manual"
import { AllSources, CompilationContext, DeepKeyOf, FeatureSources, GenericSource, IDerivation, IDerivationFunction, IDerivationPipeline, IManualPipeline } from "./pipelines"
import { FeatureState, typeFromGCA, typeFromGCS } from "../../../core/feature/utils"
import LOGGER from "../../../logger"
import { FEATURE } from "../../../core/feature/type"
import { MigratableObject, MigrationDataObject, buildMigratableObject, completeMigrationValueDefinitions } from "../../../core/feature/compilation/migration"

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IFeatureData {
  // live shit
  state: FeatureState
}

// export type IManualSourceDerivations<TSource extends Record<string, unknown>, TDestination extends string | number | symbol> = Record<string, IDerivation<TSource, TDestination>>
// export type IManualSourceData = Record<string, any>
// export type IManualSource<TSource extends Record<string, unknown>, TDestination extends string | number | symbol> = IManualSourceDerivations<TSource, TDestination> &
//   IManualSourceData

export type FeatureTemplate = {
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

export default class Feature<TData extends IFeatureData = IFeatureData, TManualSource extends GenericSource = GenericSource> {
  // manager data
  actor: GurpsMobileActor // fill at integrate
  factory: FeatureFactory // fill externally, after construction
  // meta data
  __: {
    //
    compilation: {
      previousSources: FeatureSources<TManualSource>
      previousData: any
      pipelineOrder: string[]
      pipelines: Record<string, IDerivationPipeline<TData, TManualSource>>
      // derivations: Record<number, IDerivation<Record<string, unknown>, string>[]>
      derivationsByTarget: Record<string, [string, number][]> // Record<target, [pipelineIndex, derivationIndex][]>>
      derivationsByDestination: Record<keyof TData, [string, number][]> // Record<destination, [pipelineIndex, derivationIndex][]>>
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
  parent?: Feature<any, any>
  children: Feature<IFeatureData, GenericSource>[]
  // TODO: add path, key and prefix to GCS source

  constructor(id: string, key: number | number[], parent?: Feature<any, any>, template: Partial<FeatureTemplate> = {}) {
    // META DATA
    this.__ = {
      compilation: {
        previousSources: {} as any,
        previousData: {} as any,
        pipelineOrder: [],
        pipelines: {} as any,
        // derivations: {},
        derivationsByTarget: {},
        derivationsByDestination: {} as any,
      },
      context: {
        templates: template.context?.templates ? (isArray(template.context?.templates) ? template.context?.templates : [template.context?.templates]) : [],
        specs: {},
      },
    }

    // REACTIVE DATA
    this.sources = {} as FeatureSources<TManualSource>
    this.data = {
      state: FeatureState.PASSIVE,
    } as TData

    const key_tree = Utils.keyTree(key, parent)
    // IMMUTABLE DATA
    this.id = id
    this.key = { tree: key_tree, value: Utils.keyTreeValue(key_tree) }
    this.parent = parent
    this.children = []
  }

  addManualSource(manual: IManualPipeline<TData, TManualSource>) {
    // const baseStrategy = pickBy(manual, (value, key) => isFunction(value))
    /**
     * In a manual source, all functions are counted as "derivations", while non-functions are simple "source-data"
     * That source-data can be updated, thus causing subscribed derivations to fire
     */
    const source = pickBy<unknown>(manual, (value: any, key) => !isFunction(value.derive))
    const derivationMap = pickBy(manual, (value, key) => isFunction(value.derive))
    const derivations: IDerivationPipeline<TData, TManualSource> = Object.values(derivationMap).map(derivation => {
      return derivation
    })
    derivations.name = `ManualPipeline`

    if (Object.keys(source).length > 0) this.addSource(`manual`, cloneDeep(source))
    if (derivations.length > 0) this.addPipeline(derivations)

    return this
  }

  addSource(name: string, source: Record<string, unknown>, ignoreCompile = false) {
    this.sources[name] = cloneDeep(source)

    if (!ignoreCompile) this.compile([new RegExp(`^${name}.*`)])

    return this
  }

  addPipeline<TPipelineData extends IFeatureData>(pipeline: IDerivationPipeline<TPipelineData, TManualSource>) {
    let name = pipeline.name ?? `ManualPipeline`

    this.__.compilation.pipelineOrder.push(name)
    this.__.compilation.pipelines[name] = pipeline

    for (let index = 0; index < pipeline.length; index++) {
      const derivation = pipeline[index]
      // derivation.pipeline = pipeline as any

      for (const _destination of derivation.destinations) {
        const destination = _destination as any as keyof TData
        if (this.__.compilation.derivationsByDestination[destination] === undefined) this.__.compilation.derivationsByDestination[destination] = []
        this.__.compilation.derivationsByDestination[destination].push([name, index])
      }

      for (const target of derivation.targets) {
        if (this.__.compilation.derivationsByTarget[target] === undefined) this.__.compilation.derivationsByTarget[target] = []
        this.__.compilation.derivationsByTarget[target].push([name, index])
      }
    }

    return this
  }

  preCompile(changes: (string | RegExp)[] | null) {
    for (const [name, source] of Object.entries(this.sources)) {
      if (name === `gcs`) this.type = typeFromGCS(source as any)
      else if (name === `gca`) this.type = typeFromGCA(source as any)
    }
  }

  compile(changes: (string | RegExp)[] | null, baseContext = {}) {
    const isFullCompilation = changes === null

    // COMPILE type
    //    type compilation is fixed here
    this.preCompile(changes)

    const context: CompilationContext = baseContext as any
    const allTargets = Object.keys(this.__.compilation.derivationsByTarget)

    let targets: string[] = []
    if (changes === null) targets = allTargets
    else targets = flatten(changes.map(pattern => (isString(pattern) ? [pattern] : allTargets.filter(target => target.match(pattern)))))

    // let timer = LOGGER.time(`LIST`) // COMMENT

    // #region LIST derivations by updated keys

    const derivationsPath = {} as Record<string, string[]> // Record<derivation, targets[]>
    for (const target of targets) {
      const paths = this.__.compilation.derivationsByTarget[target]

      for (const _path of paths) {
        const path = _path.join(`.`)
        if (derivationsPath[path] === undefined) derivationsPath[path] = []
        derivationsPath[path].push(target)
      }
    }

    const derivations = Object.keys(derivationsPath).map(path => {
      const [pipeline, derivation] = path.split(`.`)
      const derivationInstance = this.__.compilation.pipelines[pipeline][parseInt(derivation)]
      if (derivationInstance === undefined) debugger // COMMENT
      return derivationInstance
    })

    // #endregion

    // timer(`LIST`) // COMMENT
    // timer = LOGGER.time(`EXECUTE`) // COMMENT

    // #region EXECUTE derivations and pool results

    const MDOs = [] as MigrationDataObject[]
    for (const derivation of derivations) {
      let result: ReturnType<typeof derivation.derive>

      result = derivation.derive.call(this, this.sources, this.__.compilation.previousSources, {
        previousSources: this.__.compilation.previousSources,
        sources: this.sources,
        object: this,
      })

      // ERROR
      if (!isObjectLike(result)) debugger

      if (result && Object.keys(result).length >= 1) {
        completeMigrationValueDefinitions(result, derivation, {})

        MDOs.push(result)
      }
    }

    // migrate for each template (conflict resolution should be dealt with by applying the correct MigrationMode)
    const data = buildMigratableObject() as MigratableObject
    for (const mdo of MDOs) data.migrate(mdo, context, this.sources)

    // for each pipeline, do post
    const postMDOs = [] as MigrationDataObject[]
    for (const name of this.__.compilation.pipelineOrder) {
      const pipeline = this.__.compilation.pipelines[name]
      if (!pipeline.post) continue

      const mdo = pipeline.post.call(this, data, this, this.sources)
      if (mdo && Object.keys(mdo).length >= 1) postMDOs.push(completeMigrationValueDefinitions(mdo, pipeline as any, { sources: [`post`] }))
    }

    // migrate for each post MDO
    for (const mdo of postMDOs) data.migrate(mdo, context, this.sources)

    // #endregion

    // timer(`EXECUTE`) // COMMENT
    // timer = LOGGER.time(`APPLY`) // COMMENT

    // #region APPLY results into feature data substructure (NEVER apply into source, value there is readyonly from here)

    for (const key of Object.keys(data)) {
      if (key === `migrate` || key === `migrationsByKey` || key === `migrations`) continue
      if (data[key] === undefined) continue
      this.data[key] = data[key]
    }

    // #endregion

    // timer(`APPLY`) // COMMENT
    // timer = LOGGER.time(`FIRE`) // COMMENT

    // #region FIRE subscription events for feature+keys that have changed

    LOGGER.warn(`POOL FIRE SUBSCRIPTION EVENT`, targets)

    // #endregion

    // timer(`FIRE`) // COMMENT
  }

  // #region INTEGRATING

  /**
   * Build GCA query parameters
   */
  prepareQueryGCA(): { directive: `continue` | `skip`; type?: Type[`value`]; name?: string; specializedName?: string; merge?: boolean } {
    if (this.type.compare(FEATURE.GENERIC)) {
      LOGGER.get(`gca`).warn(`Cannot query a generic feature`, this)
      return { directive: `skip` }
    }

    const type = this.type.value

    return { directive: `continue`, type }
  }

  /**
   * Load and compile GCA object (by querying pre-loaded extraction)
   */
  loadFromGCA(cache = false) {
    let entry: _GCA.Entry | null

    // load GCA into feature from cache (if available)
    if (cache) {
      entry = GCA.getCache(this.id)
      if (entry !== undefined) return this
    }

    // prepare GCA query (with name, specializedName, type, etc...)
    const parameters = this.prepareQueryGCA()
    if (parameters.directive === `skip`) return this

    // execute query
    entry = GCA.query(parameters as any)

    // update cache for this id
    GCA.setCache(this.id, entry)

    // if there is some result, add as source (this will trigger a compilation)
    if (!isNil(entry)) this.addSource(`gca`, entry)

    return this
  }

  /**
   * Integrates feature into sheetData before rendering
   * A GenericFeature, by default, has no required integrations2
   */
  integrate(actor: GurpsMobileActor) {
    if (actor.id === null) throw new Error(`Actor is missing an id`)
    this.actor = actor

    return this
  }

  // #endregion
}
