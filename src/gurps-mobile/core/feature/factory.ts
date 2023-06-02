/* eslint-disable no-debugger */
import { before, cloneDeep, findIndex, indexOf, isArray, isNil, isString, last, set, uniq } from "lodash"

import { FeatureCollection } from "./collection"

// import BaseFeature, { FeatureTemplate } from "./base"
import Feature, { FeatureTemplate, IFeatureData } from "../../foundry/actor/feature"
import GenericFeature from "../../foundry/actor/feature/generic"
import AdvantageFeature from "../../foundry/actor/feature/advantage"
import SkillFeature from "../../foundry/actor/feature/skill"
import SpellFeature from "../../foundry/actor/feature/spell"
import EquipmentFeature from "../../foundry/actor/feature/equipment"
import FeatureUsage from "../../foundry/actor/feature/usage"
import { CompilationContext, GenericSource } from "../../foundry/actor/feature/pipelines"
import { IGenericFeatureData } from "../../foundry/actor/feature/pipelines/generic"
import { IAdvantageFeatureData } from "../../foundry/actor/feature/pipelines/advantage"
import { ISkillFeatureData } from "../../foundry/actor/feature/pipelines/skill"
import { ISpellFeatureData } from "../../foundry/actor/feature/pipelines/spell"
import { IEquipmentFeatureData } from "../../foundry/actor/feature/pipelines/equipment"
import { IFeatureUsageData } from "../../foundry/actor/feature/pipelines/usage/usage"
import LOGGER from "../../logger"
import { EventEmitter } from "@billjs/event-emitter"
import { Datachanges } from "../../../december/utils"
import { PatternChanges } from "../../../december/utils/datachanges"
import { GurpsMobileActor } from "../../foundry/actor"
import { isNilOrEmpty, isNumeric } from "../../../december/utils/lodash"
import DefenseFeature from "../../foundry/actor/feature/defense"
import { IDefenseFeatureData } from "../../foundry/actor/feature/pipelines/old_defense"
import { idFromGCA, idFromGCS, typeFromGCA, typeFromGCS } from "./utils"
import { asNumber } from "../../../december/utils/string"
import { GCS } from "../../../gurps-extension/types/gcs"
import { GCA as GCATypes } from "../gca/types"
import { TemplateByType } from "../../foundry/actor-sheet/context/manager"

type CompilationInstructions = { feature: GenericFeature; keys: (string | RegExp)[]; baseContext: Partial<CompilationContext>; ignores: string[] }

export type FeatureDataByType = {
  base: IFeatureData
  generic: IGenericFeatureData
  advantage: IAdvantageFeatureData
  skill: ISkillFeatureData
  spell: ISpellFeatureData
  equipment: IEquipmentFeatureData
  usage: IFeatureUsageData
  //
  defense: IDefenseFeatureData
}

export interface DeepGCSOptions {
  actor: GurpsMobileActor
  // datachanges: Datachanges
  path?: string
}

export interface FeatureRecipe {
  type: keyof FeatureDataByType
  id: string
  template: FeatureTemplate
  path: string | undefined
}

export type FactoryLog = `compiling.general` | `compiling.request`

export default class FeatureFactory extends EventEmitter {
  logs: {
    compiling: {
      general: boolean
      request: boolean
    }
  }

  compiling: {
    index: CompilationInstructions[]
    byFeature: Record<string, number>
    delayedByFeature: Record<string, CompilationInstructions[]>
    //
    queue: number[]
    queueSize: number
    compiledEntities: number
    running: boolean
    //
    pool: {
      requests: Parameters<(typeof FeatureFactory)[`prototype`][`requestCompilation`]>[]
      batch: number
    }
  }

  constructor() {
    super()

    this.logs = {
      compiling: {
        general: false,
        request: false,
      },
    }

    this.compiling = {
      index: [],
      byFeature: {},
      delayedByFeature: {},
      //
      queue: [],
      queueSize: 0,
      compiledEntities: 0,
      running: false,
      //
      pool: {
        requests: [],
        batch: 0,
      },
    }
  }

  setLogs(paths: FactoryLog | FactoryLog[] | `all`, value: boolean) {
    const allPaths = [`compiling.general` as const, `compiling.request` as const]

    let paths_: FactoryLog[] = paths !== `all` ? (isArray(paths) ? paths : [paths]) : allPaths

    for (const path of paths_) {
      // ERROR: Path not found
      if (!allPaths.includes(path)) debugger

      set(this.logs, path, value)
    }
  }

  listen() {
    // this.on(`compilation:done`, event => {})
  }

  cls<T extends keyof FeatureDataByType>(type: T) {
    if (type === `base`) return Feature
    else if (type === `generic`) return GenericFeature
    else if (type === `advantage`) return AdvantageFeature
    else if (type === `skill`) return SkillFeature
    else if (type === `spell`) return SpellFeature
    else if (type === `equipment`) return EquipmentFeature
    else if (type === `usage`) return FeatureUsage
    else if (type === `defense`) return DefenseFeature

    throw new Error(`Feature of type "${type}" is not implemented`)
  }

  build<TManualSource extends GenericSource = never, T extends keyof FeatureDataByType = keyof FeatureDataByType>(
    type: T,
    id: string,
    key: string | number | (string | number)[],
    parent?: Feature<any, any>,
    template?: FeatureTemplate,
  ): Feature<FeatureDataByType[T], TManualSource> {
    const cls = this.cls<T>(type)

    const instance = new cls(id, key, parent, template)
    instance.factory = this

    return instance as any
  }

  /**
   * Compile a GCS map and return it as a collection of features
   *
   * @param type
   * @param GCS
   * @param prefix
   * @param parent
   * @param template
   * @returns
   */
  GCS<TManualSource extends GenericSource = never, T extends keyof FeatureDataByType = keyof FeatureDataByType>(
    actor: GurpsMobileActor,
    datachanges: Datachanges,
    type: T,
    GCS: object,
    rootKey: number | number[],
    path: string,
    parent?: Feature<any, any>,
    templateByType?: Record<keyof FeatureDataByType, FeatureTemplate>,
  ) {
    const collection = new FeatureCollection()
    if (!GCS) return collection
    const map = isArray(GCS) ? Object.fromEntries(GCS.map((c, i) => [i, c])) : GCS

    if (!map) debugger // COMMENT
    for (const [key, gcs] of Object.entries(map)) {
      if (isNaN(parseInt(key))) debugger // COMMENT
      if (gcs.id === undefined) debugger // COMMENT

      const featureExists = actor.cache.features?.[gcs.id] !== undefined
      let feature: GenericFeature

      if (!featureExists) {
        const template = templateByType[type]
        if (isNil(template)) debugger

        // effectivelly creates and compiles feature
        feature = this.build(type, gcs.id, [...(isArray(rootKey) ? rootKey : [rootKey]), parseInt(key)], parent, template) as any

        feature.addSource(`gcs`, gcs, { path: `${isNilOrEmpty(path) ? `` : `${path}.`}${key}` })
        collection.add(feature as any)
      } else {
        // feature already exists, just inform update
        debugger
        const changes = datachanges?.listAll(new RegExp(`system\\.move\\.${key}`, `i`))
        feature = actor.cache.features?.[gcs.id] as GenericFeature

        // ERROR: Wtf m8
        if (feature === undefined) debugger

        this.react(feature!, changes, (feature, changes) => {
          debugger
        })
      }

      // just maintain the loop, call GCS for children
      if (!isNil(gcs.children)) {
        const children = isArray(gcs.children) ? Object.fromEntries(gcs.children.map((c, i) => [i, c])) : gcs.children

        // ERROR: Pathless parent
        if (parent && !parent.path) debugger

        const template = templateByType[type]
        if (isNil(template)) debugger

        const childrenCollection = this.GCS(actor, datachanges, type, children, [], `${feature.path!}.children`, feature, template)

        // only adds to collection new features (to be GCA loaded and compiled on main thread)
        if (!featureExists) {
          if (feature.data.children === undefined) feature.data.children = []
          feature.data.children.push(...childrenCollection.items.map(item => item.id))
          collection.add(...childrenCollection.items)
        }
      }
    }

    return collection
  }

  /**
   * Compile GCS entries into features
   */
  deepGCS(GCS: object, parent: Feature<any> | null, { actor, path }: DeepGCSOptions) {
    const collection = new FeatureCollection()
    if (!GCS) return collection

    if (parent) {
      if (isNil(path)) path = parent.path ?? undefined
      if (isNil(rootKey)) rootKey = parent.key.array
    }

    const entries = isArray(GCS) ? GCS.map((c, i) => [i, c]) : Object.entries(GCS)

    for (const [key, object] of entries) {
      const numericKey = !(isNumeric(key) || typeof key === `number`) ? asNumber(key) : parseInt(key)

      if (isArray(object)) {
        const _collection = this.deepGCS(object, parent, {
          actor,
          datachanges,
          templateByType,
          path: `${isNilOrEmpty(path) ? `` : `${path}.`}${key}`,
          rootKey: [...(rootKey ?? []), numericKey],
        })

        collection.add(..._collection.items)
      } else {
        const doesFeatureExist = actor.cache.features?.[object.id] !== undefined
        let feature: GenericFeature

        if (doesFeatureExist) {
          // feature already exists, just inform update
          debugger
          const changes = datachanges?.listAll(new RegExp(`system\\.move\\.${key}`, `i`))
          feature = actor.cache.features?.[object.id] as GenericFeature

          // ERROR: Wtf m8
          if (feature === undefined) debugger

          this.react(feature!, changes, (feature, changes) => {
            debugger
          })
        }

        const featureType = typeFromGCS(object)
        let type = undefined as any as keyof FeatureDataByType
        if (featureType.compare(`generic_advantage`, false)) type = `advantage`
        else if (featureType.compare(`skill`)) type = `skill`
        else if (featureType.compare(`spell`, false)) type = `spell`
        else if (featureType.compare(`equipment`)) type = `equipment`
        else {
          // ERROR: Unimplemented conversion from feature type
          debugger
        }

        const template = templateByType[type]
        if (!template) debugger

        if (!object.id) debugger

        // effectivelly creates and compiles feature

        // ERROR: Untested for string keys
        if (isString(key) && !isNumeric(key)) debugger

        const localPath = `${isNilOrEmpty(path) ? `` : `${path}.`}${key}`
        const localKey = [...(rootKey ?? []), numericKey]

        feature = this.build(type, object.id, localKey, parent ?? undefined, template) as any
        feature.addSource(`gcs`, object, { path: localPath })
        collection.add(feature)

        // just maintain the loop, call deepGCS for children
        if (!isNil(object.children)) {
          const childrenCollection = this.deepGCS(object.children, feature, { actor, datachanges, templateByType, path: `${localPath}.children`, rootKey: localKey })

          // just push built features to composite
          collection.add(...childrenCollection.items)

          // look at every feature and add it to correct index inside parent
          const ids = object.children.map(child => child.id)
          const children = childrenCollection.items.filter(item => ids.includes(item.id))

          for (const child of children) {
            const destinationIndex = last(child.key.array)!

            if (!feature.data.children) feature.data.children = []

            // ERROR: Feature already has a children at destination index
            if (feature.data.children[destinationIndex] !== undefined) debugger

            feature.data.children[destinationIndex] = child.id
          }
        }
      }
    }

    return collection
  }

  buildCollection<TEntry extends GCS.Entry | GCATypes.Entry>(
    source: `gca` | `gcs`,
    entries: TEntry[] | Record<string, TEntry>,
    parent: Feature<any, any> | undefined,
    { actor, path }: DeepGCSOptions,
  ) {
    // ERROR: Unknown source
    if (![`gcs`, `gca`].includes(source)) debugger

    const collection = new FeatureCollection()

    const entries_ = (isArray(entries) ? entries.map((c, i) => [i, c]) : Object.entries(entries)) as [string, TEntry][]

    for (const [key, entry] of entries_) {
      // ERROR: Unimplemented
      if (source === `gcs` && !entry.id) debugger
      if (source === `gca` && !entry._index) debugger
      if (isArray(entry)) debugger

      const recipe = this.prepareEntry(source, path, entry, parent)

      const doesFeatureExist = actor.cache.features?.[recipe.id] !== undefined

      if (doesFeatureExist) {
        // feature already exists, just inform update
        debugger
        const changes = datachanges?.listAll(new RegExp(`system\\.move\\.${key}`, `i`))
        feature = actor.cache.features?.[object.id] as GenericFeature

        // ERROR: Wtf m8
        if (feature === undefined) debugger

        this.react(feature!, changes, (feature, changes) => {
          debugger
        })

        continue
      }

      let feature: Feature<any, any>
      if (source === `gcs`) {
        feature = this.buildFromGCS(recipe, key, entry as GCS.Entry, parent)
      } else {
        // source == 'gca'
        feature = this.buildFromGCA(recipe, key, entry as GCATypes.Entry, parent)
      }

      collection.add(feature as GenericFeature)
    }

    return collection
  }

  prepareEntry(source: `gca` | `gcs`, path: string | undefined, entry: GCS.Entry | GCATypes.Entry, parent: Feature<any, any> | undefined): FeatureRecipe {
    // ERROR: Unknown source
    if (![`gcs`, `gca`].includes(source)) debugger

    let id: string
    let type: ReturnType<typeof typeFromGCS> | ReturnType<typeof typeFromGCA>

    // ERROR: Unimplemented
    if (path === undefined) debugger

    // #region defining immutable prioritary data by source
    if (source === `gcs`) {
      const e = entry as GCS.Entry

      id = idFromGCS(e)
      type = typeFromGCS(e)
    } else if (source === `gca`) {
      const e = entry as GCATypes.Entry

      id = idFromGCA(e, path)
      type = typeFromGCA(e)
    } else {
      throw new Error(`Unknown source`)
    }
    // #endregion

    // define instance type based on entry
    let instance = undefined as any as keyof FeatureDataByType
    if (type.compare(`generic_advantage`, false)) instance = `advantage`
    else if (type.compare(`skill`)) instance = `skill`
    else if (type.compare(`spell`, false)) instance = `spell`
    else if (type.compare(`equipment`)) instance = `equipment`
    else {
      // ERROR: Unimplemented conversion from feature type
      debugger
    }

    const template = TemplateByType[instance]!
    if (!template) debugger

    return {
      type: instance,
      id,
      template,
      path,
    }
  }

  buildFromGCS<TFeature extends Feature<any, any>>(
    recipe: FeatureRecipe,
    key: string | number | (string | number)[],
    entry: GCS.Entry,
    parent: Feature<any, any> | undefined,
  ): TFeature {
    const feature = this.build(recipe.type, recipe.id, key, parent ?? undefined, recipe.template) as TFeature

    const localPath = `${isNilOrEmpty(recipe.path) ? `` : `${recipe.path}.`}${key}`
    feature.addSource(`gcs`, entry, { path: localPath })

    return feature
  }

  buildFromGCA<TFeature extends Feature<any, any>>(
    recipe: FeatureRecipe,
    key: string | number | (string | number)[],
    entry: GCATypes.Entry,
    parent: Feature<any, any> | undefined,
  ): TFeature {
    const feature = this.build(recipe.type, recipe.id, key, parent ?? undefined, recipe.template) as TFeature
    feature.addSource(`gca`, entry)

    return feature
  }

  requestCompilation(
    feature: GenericFeature | Feature<any>,
    keys: (string | RegExp)[],
    baseContext: Partial<CompilationContext>,
    ignores: string[],
    options: { delayCompile?: boolean },
  ) {
    let instructions: CompilationInstructions = { feature: feature as GenericFeature, keys, baseContext, ignores }

    if (options.delayCompile) {
      // merge instructions with next request
      if (!this.compiling.delayedByFeature[feature.id]) this.compiling.delayedByFeature[feature.id] = []
      this.compiling.delayedByFeature[feature.id].push(instructions)

      if (this.logs.compiling.request)
        LOGGER.get(`actor`)
          .get(`factory`)
          .info(`delay`, feature.data.name ?? `id:${feature.id}`, keys.map(key => key.toString()).join(`, `), baseContext, [
            `color: rgba(0, 0, 0, 0.5); font-style: italic;`,
            `color: black; font-weight: bold; font-style: regular;`,
            `color: rgb(210, 78, 76); font-weight: regular; font-style: italic;`,
          ])

      return
    }

    // merge delayed instructions here, if any
    const hasDelayed = !!this.compiling.delayedByFeature[feature.id]
    if (hasDelayed) {
      const newKeys = [] as typeof instructions.keys
      let newBaseContext = {} as typeof instructions.baseContext
      const newIgnores = [] as typeof instructions.ignores

      const delayedInstructions = this.compiling.delayedByFeature[feature.id]
      for (const { keys: delayedKeys, baseContext: delayedBaseContext, ignores: delayedIgnores } of delayedInstructions) {
        newKeys.push(...delayedKeys)
        newBaseContext = { ...newBaseContext, ...delayedBaseContext }
        newIgnores.push(...delayedIgnores)

        // ERROR: Untested
        if (Object.keys(newBaseContext).length > 0) debugger
      }

      newKeys.push(...instructions.keys)
      newBaseContext = { ...newBaseContext, ...instructions.baseContext }
      newIgnores.push(...instructions.ignores)

      instructions.keys = uniq(newKeys)
      instructions.baseContext = newBaseContext
      instructions.ignores = uniq(newIgnores)

      delete this.compiling.delayedByFeature[feature.id]
    }

    // merge future already queued instructions here, if any
    const futureQueuedInstructions = this.compiling.queue.filter(id => this.compiling.index[id].feature.id === feature.id)
    if (futureQueuedInstructions.length > 0) {
      // ERROR: There should not be more than 1 future entry, since ALL entries are merged on request
      if (futureQueuedInstructions.length > 1) debugger

      const targetInstructionsId = futureQueuedInstructions[0]

      if (this.logs.compiling.request)
        LOGGER.get(`actor`)
          .get(`factory`)
          .info(
            `merged`,
            feature.data.name ?? `id:${feature.id}`,
            `[${keys.map(key => key.toString()).join(`, `)}]`,
            `![${ignores.map(key => key.toString()).join(`, `)}]`,
            `into instruction id`,
            targetInstructionsId,
            `[${this.compiling.index[targetInstructionsId].keys.map(key => key.toString()).join(`, `)}]`,
            `![${this.compiling.index[targetInstructionsId].ignores.map(key => key.toString()).join(`, `)}]`,
            [
              `color: rgba(0, 0, 0, 0.5); font-style: italic;`,
              `color: black; font-weight: bold; font-style: regular;`,
              `color: rgb(210, 78, 76); font-weight: regular; font-style: italic;`,
              `color: rgb(210, 78, 76); font-weight: regular; font-style: italic;`,
              `color: black; font-weight: regular; font-style: italic;`,
              `color: darkblue; font-weight: bold; font-style: regular;`,
              `color: rgb(210, 78, 76); font-weight: regular; font-style: italic;`,
              `color: rgb(210, 78, 76); font-weight: regular; font-style: italic;`,
            ],
          )

      this.compiling.index[targetInstructionsId].keys = uniq([...this.compiling.index[targetInstructionsId].keys, ...instructions.keys])
      this.compiling.index[targetInstructionsId].baseContext = { ...this.compiling.index[targetInstructionsId].baseContext, ...instructions.baseContext }
      this.compiling.index[targetInstructionsId].ignores = uniq([...this.compiling.index[targetInstructionsId].ignores, ...instructions.ignores])

      // ERROR: Untested
      if (Object.keys(this.compiling.index[targetInstructionsId].baseContext).length > 0) debugger

      return
    }

    // index compilation instructions
    const id = this.compiling.index.length
    this.compiling.index.push(instructions)
    this.compiling.byFeature[feature.id] = id

    // push id to queue
    this.compiling.queue.push(id)

    // update queue size (if already running)
    const log_extras = [hasDelayed && `delayed`].filter(b => !!b)
    if (this.compiling.running) {
      if (this.logs.compiling.request)
        LOGGER.get(`actor`)
          .get(`factory`)
          .info(
            `request${log_extras.length > 0 ? ` (${log_extras.join(`, `)})` : ``}`,
            id,
            `[ /+1]`,
            feature.data.name ?? `id:${feature.id}`,
            `[${instructions.keys.map(key => key.toString()).join(`, `)}]`,
            `![${instructions.ignores.map(key => key.toString()).join(`, `)}]`,
            instructions.baseContext,
            [
              `color: rgba(0, 0, 0, 0.5); font-style: italic;`,
              `color: rgba(0, 0, 139, 0.35); font-style: italic;`,
              `color: black; font-weight: regular; font-style: regular;`,
              `color: black; font-weight: bold; font-style: regular;`,
              `color: rgb(210, 78, 76); font-weight: regular; font-style: italic;`,
              `color: rgb(0, 0, 0, 0.5); font-weight: regular; font-style: italic;`,
            ],
          )

      this.compiling.queueSize++
    } else {
      if (this.logs.compiling.request)
        LOGGER.get(`actor`)
          .get(`factory`)
          .info(
            `request${log_extras.length > 0 ? ` (${log_extras.join(`, `)})` : ``}`,
            id,
            feature.data.name ?? `id:${feature.id}`,
            `[${instructions.keys.map(key => key.toString()).join(`, `)}]`,
            `![${instructions.ignores.map(key => key.toString()).join(`, `)}]`,
            instructions.baseContext,
            [
              `color: rgba(0, 0, 0, 0.5); font-style: italic;`,
              `color: rgba(0, 0, 139, 0.35); font-style: italic;`,
              `color: black; font-weight: bold; font-style: regular;`,
              `color: rgb(210, 78, 76); font-weight: regular; font-style: italic;`,
              `color: rgb(0, 0, 0, 0.5); font-weight: regular; font-style: italic;`,
            ],
          )
    }
  }

  /** Pool a compilation instruction to be requested AFTER current batch is done */
  poolCompilationRequest(feature: GenericFeature | Feature<any>, keys: string[], baseContext: Partial<CompilationContext>, ignores?: string[]) {
    let instructions: CompilationInstructions = { feature: feature as GenericFeature, keys, baseContext, ignores: ignores ?? [] }
    this.compiling.pool.requests.push([instructions.feature, instructions.keys, instructions.baseContext, instructions.ignores, {} as any])
  }

  prepareCompilation() {
    this.compiling.pool.requests = []
    this.compiling.pool.batch = 0
  }

  startCompilation(name?: string) {
    const logger = LOGGER.get(`actor`).get(`factory`)

    if (this.compiling.queue.length === 0) {
      if (this.logs.compiling.general)
        logger.info(`start`, `${name ? `[${name}] ` : ``}There are no features in queue to compile`, [
          `color: rgba(0, 0, 0, 0.5); font-weight: bold; font-style: italic;`,
          `color: black; font-weight: regular; font-style: regular;`,
        ])
    } else {
      if (this.logs.compiling.general) {
        logger.info(`start`, `${name ? `[${name}] ` : ``}Starting compilation of`, this.compiling.queue.length, `entries.`, [
          `color: rgba(82, 124, 64, 0.5); font-weight: bold; font-style: italic;`,
          `color: black; font-weight: regular; font-style: regular;`,
          `color: darkblue; font-weight: bold; font-style: regular;`,
          `color: black; font-weight: regular; font-style: regular;`,
        ])
      }

      this.compiling.running = true
      this.compiling.compiledEntities = 0
      this.compiling.queueSize = this.compiling.queue.length
      while (this.compiling.queue.length > 0) {
        const id = this.compiling.queue.shift()!
        const { feature, keys, baseContext, ignores } = this.compiling.index[id]

        const targets = feature.prepareCompile(keys, baseContext, ignores)

        if (targets.length > 0) {
          if (this.logs.compiling.request) {
            logger.info(
              `run`,
              id,
              `[${this.compiling.compiledEntities + 1}/${this.compiling.queueSize}]`,
              `${feature.data.name ?? `id:${feature.id}`}`,
              `(${this.compiling.queue.length} entries left in queue)`,
              `[${targets.map(key => key.toString()).join(`, `)}]`,
              `⇔`,
              `[${keys.map(key => key.toString()).join(`, `)}]`,
              `![${ignores.map(key => key.toString()).join(`, `)}]`,
              baseContext,
              [
                `color: rgba(0, 0, 0, 0.5); font-style: italic;`,
                `color: rgba(0, 0, 139, 0.35); font-style: italic;`,
                `color: black; font-weight: regular; font-style: regular;`,
                `color: black; font-weight: bold; font-style: regular;`,
                `color: black; font-weight: regular; font-style: italic;`,
                `color: rgb(210, 78, 76); font-weight: regular; font-style: italic;`,
                `color: black; font-weight: regular; font-style: regular;`,
                `color: rgb(210, 78, 76); font-weight: regular; font-style: italic;`,
                `color: rgb(0, 0, 0, 0.5); font-weight: regular; font-style: italic;`,
              ],
            )

            // // JUST FOR EXPENSIVE DEBUGGING
            // logger.info(`run`, id, `[${this.compiling.compiledEntities + 1}/${this.compiling.queueSize}]`, cloneDeep(feature.sources), [
            //   `color: rgba(0, 0, 0, 0.0); font-style: italic;`,
            //   `color: rgba(0, 0, 139, 0.0); font-style: italic;`,
            //   `color: rgba(0, 0, 0, 0.0);; font-weight: regular; font-style: regular;`,
            //   `color: black; font-weight: bold; font-style: regular;`,
            // ])
          }

          feature._compile(targets, keys, baseContext)
        } else {
          if (this.logs.compiling.request)
            logger.info(
              `skip`,
              id,
              `[${this.compiling.compiledEntities + 1}/${this.compiling.queueSize}]`,
              `${feature.data.name ?? `id:${feature.id}`}`,
              `(${this.compiling.queue.length} entries left in queue)`,
              `[${keys.map(key => key.toString()).join(`, `)}]`,
              `![${ignores.map(key => key.toString()).join(`, `)}]`,
              baseContext,
              [
                `color: rgba(0, 0, 0, 0.5); font-style: italic;`,
                `color: rgba(0, 0, 139, 0.35); font-style: italic;`,
                `color: black; font-weight: regular; font-style: regular;`,
                `color: black; font-weight: bold; font-style: regular;`,
                `color: black; font-weight: regular; font-style: italic;`,
                `color: rgb(210, 78, 76); font-weight: regular; font-style: italic;`,
                `color: rgb(0, 0, 0, 0.5); font-weight: regular; font-style: italic;`,
              ],
            )
        }

        this.compiling.compiledEntities++
      }

      this.compiling.index = []
      this.compiling.byFeature = {}
      this.compiling.running = false
    }

    const hasPooledBatch = this.compiling.pool.requests.length > 0
    const eventName = hasPooledBatch || this.compiling.pool.batch > 0 ? `batch` : `done`

    if (this.compiling.queueSize > 0) {
      if (this.logs.compiling.general) {
        logger.info(
          eventName,
          this.compiling.pool.batch,
          `${name ? `[${name}] ` : ``}Compilation of`,
          this.compiling.compiledEntities,
          `out of`,
          this.compiling.queueSize,
          `entries finished.`,
          [
            `color: rgba(82, 124, 64, 0.75); font-weight: bold; font-style: italic;`,
            `color: rgba(0, 0, 139, 0.35); font-style: italic;`,
            `color: black; font-weight: regular; font-style: regular;`,
            `color: darkblue; font-weight: bold; font-style: regular;`,
            `color: black; font-weight: regular; font-style: regular;`,
            `color: darkblue; font-weight: bold; font-style: regular;`,
            `color: black; font-weight: regular; font-style: regular;`,
          ],
        )
      }
    }

    this.fire(`compilation:${eventName}`, { batch: this.compiling.pool.batch, name })
    this.fire(`compilation:${eventName}:${name}`, { batch: this.compiling.pool.batch, name })

    if (hasPooledBatch) this.nextCompilationBatch(name)
    else {
      this.fire(`compiled`, { batch: this.compiling.pool.batch, name })
      if (name) this.fire(`compiled:${name}`, { batch: this.compiling.pool.batch, name })
      this.prepareCompilation()
    }
  }

  nextCompilationBatch(name?: string) {
    const hasPooledBatch = this.compiling.pool.requests.length > 0
    if (!hasPooledBatch) return

    const logger = LOGGER.get(`actor`).get(`factory`)

    const requests = this.compiling.pool.requests

    if (this.logs.compiling.general)
      logger
        .group(true)
        .info(`pool`, this.compiling.pool.batch + 1, `${name ? `[${name}] ` : ``}Pooling`, requests.length, `requests`, [
          `color: rgba(82, 124, 64, 0.75); font-weight: bold; font-style: italic;`,
          `color: rgba(0, 0, 139, 0.35); font-style: italic;`,
          `color: black; font-weight: regular; font-style: regular;`,
          `color: darkblue; font-weight: bold; font-style: regular;`,
          `color: black; font-weight: regular; font-style: regular;`,
        ])

    for (const request of requests) {
      const [feature, keys, baseContext] = request

      this.requestCompilation(feature, keys, baseContext, [], {} as any)
    }

    logger.group()

    this.compiling.pool.requests = []
    this.compiling.pool.batch++

    this.startCompilation(name)
  }

  react(feature: GenericFeature, changes: PatternChanges, beforeUpdate?: (feature: GenericFeature, changes: PatternChanges) => boolean | null | void) {
    // ERROR: Unimplemented
    if (feature === undefined) debugger
    if (changes === undefined) debugger
    else if (changes.root) {
      // ERROR: Unimplemented
      debugger
    } else if (changes.changes.length > 0) {
      // ERROR: Shoudlgnt b

      const sourceMappedChanges = changes.changes.map(change => `manual.${change}`)

      const shouldContinue = beforeUpdate === undefined ? true : beforeUpdate(feature, changes)

      // cancelable update
      if (shouldContinue === false || shouldContinue === null) return

      // inform update
      feature.fire(`update`, { keys: sourceMappedChanges })
    } else {
      // ERROR: Unimplemented
      debugger
    }
  }
}
