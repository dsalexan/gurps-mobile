/* eslint-disable no-debugger */
import { GCS } from "../../../../gurps-extension/types/gcs"
import { Type, Utils } from "../../../core/feature"
import CompilationTemplate from "../../../core/feature/compilation/template"
import FeatureFactory from "../../../core/feature/factory"
import { GCA as _GCA } from "../../../core/gca/types"
import BaseContextTemplate, { ContextSpecs } from "../../actor-sheet/context/context"
import { GurpsMobileActor } from "../actor"
import { cloneDeep, flatten, get, has, intersection, isArray, isEqual, isFunction, isNil, isObjectLike, isRegExp, isString, omit, pick, pickBy, sortBy, uniq } from "lodash"
import { isPrimitive, push } from "../../../../december/utils/lodash"
import ManualCompilationTemplate from "../../../core/feature/compilation/manual"
import { AllSources, CompilationContext, DeepKeyOf, FeatureSources, GenericSource, IDerivation, IDerivationFunction, IDerivationPipeline, IManualPipeline } from "./pipelines"
import { FeatureState, typeFromGCA, typeFromGCS, typeFromManual } from "../../../core/feature/utils"
import LOGGER from "../../../logger"
import { FEATURE } from "../../../core/feature/type"
import { MigratableObject, MigrationDataObject, MigrationRecipe, completeMigrationValueDefinitions, resolveMigrationDataObject } from "../../../core/feature/compilation/migration"
import { EventEmitter } from "@billjs/event-emitter"

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

export default class Feature<TData extends IFeatureData = IFeatureData, TManualSource extends GenericSource = GenericSource> extends EventEmitter {
  // manager data
  actor: GurpsMobileActor // fill at integrate
  factory: FeatureFactory // fill externally, after construction
  // meta data
  __: {
    //
    compilation: {
      compilations: number
      previousSources: FeatureSources<TManualSource>
      previousData: any
      //
      migrations: Record<string, unknown>
      poolables: string[]
      //
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
    super()

    // META DATA
    this.__ = {
      compilation: {
        compilations: 0,
        // previous
        previousSources: {} as any,
        previousData: {} as any,
        //
        migrations: {} as Record<string, unknown>,
        poolables: [],
        // pipelines
        pipelineOrder: [],
        pipelines: {} as any,
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

    this.listen()
  }

  listen() {
    this.on(`update`, event => {
      const { keys, delayCompile, ignoreCompile } = event.data as { keys: (string | RegExp)[]; delayCompile?: boolean; ignoreCompile: string[] }

      // ERROR: Unimplemented
      if (!isNil(ignoreCompile) && !isArray(ignoreCompile)) debugger

      let ignores = [...(ignoreCompile ?? [])]

      const poolables = flatten(
        keys.map(key => {
          if (isString(key) && this.__.compilation.poolables.includes(key)) return [key]
          else if (isRegExp(key)) return this.__.compilation.poolables.filter(poolable => key.test(poolable))

          return []
        }),
      )

      if (poolables.length > 0) {
        // this.factory.pool(this, poolables)
        this.factory.poolCompilationRequest(
          this,
          poolables.map(poolable => `${poolable}:pool`),
          {},
        )

        ignores.push(...poolables.map(poolable => `${poolable}:pool`))
      }

      const nonIgnoredKeys = keys.filter(key => !isString(key) || !ignores?.includes(key))
      if (nonIgnoredKeys.length > 0) {
        this.compile(nonIgnoredKeys, {}, ignores, { delayCompile })
      }
    })

    this.on(`compile`, event => {
      const { changes, feature } = event.data as { changes: (string | RegExp)[]; feature: Feature<any> }

      // check if one of the changes is a regular expression born form addSource
      if (changes) {
        for (const change of changes) {
          const match = change.toString().match(/\/\^(\w+)\.\*\//)

          if (match) {
            feature.fire(`compile:source`, { source: match[1], ...event.data })
            feature.fire(`compile:${match[1]}`, { source: match[1], ...event.data })
          }
        }
      }
    })
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

  addSource(name: string, source: Record<string, unknown>, options: { delayCompile: boolean; integrate?: GurpsMobileActor } = { delayCompile: false }) {
    this.sources[name] = cloneDeep(source)

    // if (!ignoreCompile) this.compile([new RegExp(`^${name}.*`)])
    this.fire(`update`, { keys: [new RegExp(`^${name}.*`)], delayCompile: options.delayCompile })

    return this
  }

  addPipeline<TPipelineData extends IFeatureData>(pipeline: IDerivationPipeline<TPipelineData, TManualSource>) {
    let name = pipeline.name ?? `ManualPipeline`

    this.__.compilation.pipelineOrder.push(name)
    // @ts-ignore
    this.__.compilation.pipelines[name] = pipeline

    for (let index = 0; index < pipeline.length; index++) {
      const derivation = pipeline[index]
      derivation.pipeline = pipeline as any

      for (const _destination of derivation.destinations) {
        const destination = _destination as any as keyof TData
        if (this.__.compilation.derivationsByDestination[destination] === undefined) this.__.compilation.derivationsByDestination[destination] = []
        this.__.compilation.derivationsByDestination[destination].push([name, index])
      }

      for (let target of derivation.targets) {
        // add to poolables if needed
        const poolable = target.substring(target.length - 5) === `:pool`
        if (poolable) this.__.compilation.poolables.push(target.substring(0, target.length - 5))

        // index derivation by target
        if (this.__.compilation.derivationsByTarget[target] === undefined) this.__.compilation.derivationsByTarget[target] = []
        this.__.compilation.derivationsByTarget[target].push([name, index])
      }
    }

    return this
  }

  preCompile(changes: (string | RegExp)[] | null) {
    const sources = [`gcs`, `gca`, `manual`]

    for (const sourceName of sources) {
      const source = this.sources[sourceName]
      if (isNil(source)) continue

      if (isNil(this.type) || this.type.isGeneric) {
        if (sourceName === `gcs`) this.type = typeFromGCS(source as any)
        else if (sourceName === `gca`) this.type = typeFromGCA(source as any)
        else if (sourceName === `manual`) {
          const type = typeFromManual(source as any)
          if (type) this.type = type
        }
      }
    }
  }

  prepareCompile(changes: (string | RegExp)[] | null, baseContext = {}, ignores: string[] = []) {
    const allTargets = Object.keys(this.__.compilation.derivationsByTarget)

    let targets: string[] = []
    if (changes === null) targets = allTargets
    else
      targets = flatten(
        changes.map(pattern => {
          if (isString(pattern)) {
            if (allTargets.includes(pattern)) return [pattern]
            else return []
          }

          return allTargets.filter(target => target.match(pattern))
        }),
      )

    // remove those in ignores
    targets = targets.filter(target => !ignores.includes(target))

    return targets
  }

  _compile(targets: string[], changes: (string | RegExp)[] | null, baseContext = {}) {
    // COMPILE type
    //    type compilation is fixed here
    this.preCompile(changes)

    const context: CompilationContext = { id: this.id, type: this.type, parent: this.parent, ...baseContext } as any

    if (targets.length === 0) return false
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

      result = derivation.derive.call(context, this.sources, this.__.compilation.previousSources, {
        previousSources: this.__.compilation.previousSources,
        sources: this.sources,
        object: this,
      })

      // ERROR
      if (!isObjectLike(result)) debugger

      if (result && Object.keys(result).length >= 1) {
        completeMigrationValueDefinitions(result, { type: `derivation`, on: derivation.targets, derivation })

        if (Object.keys(result).length >= 1) {
          MDOs.push(result)
        }
      }
    }

    // primitive fast deep clone
    // this.__.compilation.previousData = Object.keys(this.data).map(key => {
    //   const value = this.data[key]
    //   if (isPrimitive(value)) return [key, value]
    //   return this.data[key]
    // })

    // migrate for each template (conflict resolution should be dealt with by applying the correct MigrationMode)
    const migratableObject = {
      data: this.data,
      migrations: [],
      migrationsByKey: this.__.compilation.migrations,
    } as MigratableObject

    const mutableData = {} as TData
    const recipes = [] as MigrationRecipe<unknown>[]
    for (const mdo of MDOs) {
      const mdoRecipes = resolveMigrationDataObject(mutableData, migratableObject, mdo, context, this)
      recipes.push(...mdoRecipes)
    }

    // for each pipeline, do post
    const getData = function (key: string) {
      return has(mutableData, key) ? mutableData[key] : migratableObject.data[key]
    }
    const hasData = function (key: string) {
      return has(mutableData, key) || has(migratableObject.data, key)
    }
    const postMDOs = [] as MigrationDataObject[]
    for (const name of this.__.compilation.pipelineOrder) {
      const pipeline = this.__.compilation.pipelines[name]
      if (!pipeline.post) continue

      const mdo = pipeline.post.call(context, { mutable: mutableData, immutable: migratableObject.data, get: getData, has: hasData })
      if (mdo && Object.keys(mdo).length >= 1) {
        const completeMDO = completeMigrationValueDefinitions(mdo, { type: `post`, pipeline })

        if (Object.keys(completeMDO ?? {}).length > 0) postMDOs.push(completeMDO)
      }
    }

    // migrate for each post MDO
    const postRecipes = [] as MigrationRecipe<unknown>[]
    for (const mdo of postMDOs) {
      const mdoRecipes = resolveMigrationDataObject(mutableData, migratableObject, mdo, context, this)
      postRecipes.push(...mdoRecipes)
    }

    // #endregion

    // timer(`EXECUTE`) // COMMENT
    // timer = LOGGER.time(`APPLY`) // COMMENT

    // #region APPLY results into feature data substructure (NEVER apply into source, value there is readyonly from here)

    // fill migratableObject migrations index
    const allRecipes = [...recipes, ...postRecipes]
    for (const recipe of allRecipes) {
      const key = recipe.key
      migratableObject.migrations.push(...recipe.migrations)

      if (migratableObject.migrationsByKey[key] === undefined) migratableObject.migrationsByKey[key] = []
      migratableObject.migrationsByKey[key].push(...recipe.migrations)
    }

    // pass mutated data to this.data
    for (const key of Object.keys(mutableData)) {
      if (mutableData[key] === undefined) continue

      // this.fire(`before-compile.${key}`, { key, value: data.data[key], migration: data.migrationsByKey[key] })
      const value = mutableData[key]
      const migration = migratableObject.migrationsByKey[key]

      this.data[key] = value
      this.__.compilation.migrations[key] = migration

      // this.fire(`after-compile`, { key, value, migration })
    }

    // #endregion

    // timer(`APPLY`) // COMMENT
    // timer = LOGGER.time(`FIRE`) // COMMENT

    // FIRE subscription events for feature+keys that have changed
    const mutatingRecipes = allRecipes.filter(recipe => ![`pass`, `ignore`, `same`].includes(recipe.action))
    const destinations = uniq(mutatingRecipes.map(recipe => recipe.key))

    const overlap = intersection(destinations, targets)
    if (overlap.length > 0) {
      // TODO: By now, i'm just removing overlaps, but this is not the best solution
      //       The best solution would be to implement a stack overflow "refusal" in the return of derivation, to indicate a moment do stop a cycle of changes

      // @ts-ignore
      if (intersection(document.__STACK_OVERFLOW_FEATURE_PROTECTION?.[this.id] ?? [], overlap).length > 0) {
        LOGGER.warn(`Feature "${this.id}" has a possible stack overflow (a derivation is changing its targets)`, {
          // @ts-ignore
          previousOverlap: document.__STACK_OVERFLOW_FEATURE_PROTECTION[this.id],
          overlap,
          targets,
          destinations,
        })
        debugger
      }

      // @ts-ignore
      if (document.__STACK_OVERFLOW_FEATURE_PROTECTION === undefined) document.__STACK_OVERFLOW_FEATURE_PROTECTION = {}
      // @ts-ignore
      document.__STACK_OVERFLOW_FEATURE_PROTECTION[this.id] = overlap
    }

    this.fire(`update`, { feature: this, changes, keys: destinations, ignoreCompile: overlap })
    this.fire(`compile`, { feature: this, changes, keys: destinations, ignoreCompile: overlap })
    if (this.__fire_loadFromGCA && changes?.some(key => (isString(key) ? key.startsWith(`gca.`) : key.test(`gca.`)))) {
      this.__fire_loadFromGCA = false
      this.fire(`loadFromGCA`, { source: `gca`, feature: this, entry: this.sources.gca })
    }

    // timer(`FIRE`) // COMMENT

    // ERROR: Can NEVER be
    if (this.type === undefined) debugger

    this.__.compilation.compilations++
    return true
  }

  compile(changes: (string | RegExp)[] | null, baseContext = {}, ignores: string[] = [], { delayCompile }: { delayCompile?: boolean } = {}) {
    if (changes === null) debugger

    // only request keys if they are targets of derivations
    const targets = Object.keys(this.__.compilation.derivationsByTarget)
    const targetChanges = changes!.filter(key => {
      if (isString(key)) return targets.includes(key)
      else return targets.some(target => key.test(target))
    })

    const DEBUG_targetChanges = flatten(
      changes!.map(key => {
        if (isString(key)) return targets.includes(key) ? key : []
        else return targets.filter(target => key.test(target))
      }),
    )

    // if (targetChanges.length === 0) return

    // but still send regexp as key if they came this way
    this.factory.requestCompilation(this, changes, baseContext, ignores, { ignores, delayCompile })
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
    this.__fire_loadFromGCA = false

    // load GCA into feature from cache (if available)
    if (cache) {
      entry = GCA.getCache(this.id)
      if (entry !== undefined) {
        this.fire(`loadFromGCA`, { source: `gca`, feature: this, entry: null })
        return this
      }
    }

    // prepare GCA query (with name, specializedName, type, etc...)
    const parameters = this.prepareQueryGCA()
    if (parameters.directive === `skip`) {
      this.fire(`loadFromGCA`, { source: `gca`, feature: this, entry: null })
      return this
    }

    // execute query
    entry = GCA.query(parameters as any)

    // update cache for this id
    GCA.setCache(this.id, entry)

    // if there is some result, add as source (this will trigger a compilation)
    if (!isNil(entry)) {
      this.__fire_loadFromGCA = true
      this.addSource(`gca`, entry)
    } else {
      this.fire(`loadFromGCA`, { source: `gca`, feature: this, entry: null })
    }

    return this
  }

  loadFromGCAOn(eventName: string, cache = false) {
    this.on(eventName, event => event.data.feature.loadFromGCA(cache))
    return this
  }

  /**
   * Integrates feature into sheetData before rendering
   * A GenericFeature, by default, has no required integrations2
   */
  integrate(actor: GurpsMobileActor) {
    if (actor.id === null) throw new Error(`Actor is missing an id`)
    this.actor = actor

    this._integrate(actor)

    // this.compile(new RegExp(`^${this.id}\\.`), { actor }))
    this.fire(`update`, { keys: [new RegExp(`^actor.*`)] })

    return this
  }

  _integrate(actor: GurpsMobileActor) {
    // overridable shit
  }

  integrateOn(eventName: string, actor: GurpsMobileActor) {
    this.on(eventName, event => {
      // LOGGER.info(
      //   `integrateOn`,
      //   actor,
      //   event.data.feature.id,
      //   event.data.feature.data.name,
      //   `@`,
      //   event.data.feature.parent?.id,
      //   event.data.feature.parent?.data?.name,
      //   event.data.feature,
      // )
      event.data.feature.integrate(actor)
    })
    return this
  }

  // #endregion
}
