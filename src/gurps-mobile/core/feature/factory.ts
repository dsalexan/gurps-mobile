/* eslint-disable no-debugger */
import { before, cloneDeep, findIndex, indexOf, isArray, isNil, isString, uniq } from "lodash"

import { FeatureCollection } from "./collection"

// import BaseFeature, { FeatureTemplate } from "./base"
import Feature, { FeatureTemplate, IFeatureData } from "../../foundry/actor/feature"
import GenericFeature from "../../foundry/actor/feature/generic"
import AdvantageFeature from "../../foundry/actor/feature/advantage"
import SkillFeature from "../../foundry/actor/feature/skill"
import SpellFeature from "../../foundry/actor/feature/spell"
import EquipmentFeature from "../../foundry/actor/feature/equipment"
import WeaponFeature from "../../foundry/actor/feature/weapon"
import { CompilationContext, GenericSource } from "../../foundry/actor/feature/pipelines"
import { IGenericFeatureData } from "../../foundry/actor/feature/pipelines/generic"
import { IAdvantageFeatureData } from "../../foundry/actor/feature/pipelines/advantage"
import { ISkillFeatureData } from "../../foundry/actor/feature/pipelines/skill"
import { ISpellFeatureData } from "../../foundry/actor/feature/pipelines/spell"
import { IEquipmentFeatureData } from "../../foundry/actor/feature/pipelines/equipment"
import { IWeaponFeatureData } from "../../foundry/actor/feature/pipelines/weapon"
import LOGGER from "../../logger"
import { EventEmitter } from "@billjs/event-emitter"
import { Datachanges } from "../../../december/utils"
import { PatternChanges } from "../../../december/utils/datachanges"
import { GurpsMobileActor } from "../../foundry/actor"
import { isNilOrEmpty } from "../../../december/utils/lodash"

type CompilationInstructions = { feature: GenericFeature; keys: (string | RegExp)[]; baseContext: Partial<CompilationContext>; ignores: string[] }

export type FeatureDataByType = {
  base: IFeatureData
  generic: IGenericFeatureData
  advantage: IAdvantageFeatureData
  skill: ISkillFeatureData
  spell: ISpellFeatureData
  equipment: IEquipmentFeatureData
  weapon: IWeaponFeatureData
}

export default class FeatureFactory extends EventEmitter {
  logs: {
    compiling: boolean
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
      compiling: false,
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
    else if (type === `weapon`) return WeaponFeature

    throw new Error(`Feature of type "${type}" is not implemented`)
  }

  build<TManualSource extends GenericSource = never, T extends keyof FeatureDataByType = keyof FeatureDataByType>(
    type: T,
    id: string,
    key: number | number[],
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
    template?: FeatureTemplate,
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

        const childrenCollection = this.GCS(actor, datachanges, type, children, [], `${feature.path!}.children`, feature, template)

        // only adds to collection new features (to be GCA loaded and compiled on main thread)
        if (!featureExists) {
          feature.children.push(...(childrenCollection.items as any[]))
          collection.add(...childrenCollection.items)
        }
      }
    }

    return collection
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

      if (this.logs.compiling)
        LOGGER.get(`actor`)
          .get(`compilation`)
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

      if (this.logs.compiling)
        LOGGER.get(`actor`)
          .get(`compilation`)
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
      if (this.logs.compiling)
        LOGGER.get(`actor`)
          .get(`compilation`)
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
      if (this.logs.compiling)
        LOGGER.get(`actor`)
          .get(`compilation`)
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

  startCompilation() {
    const logger = LOGGER.get(`actor`).get(`compilation`)

    if (this.compiling.queue.length === 0) {
      if (this.logs.compiling)
        logger.info(`start`, `There are no features in queue to compile`, [
          `color: rgba(0, 0, 0, 0.5); font-weight: bold; font-style: italic;`,
          `color: black; font-weight: regular; font-style: regular;`,
        ])
    } else {
      if (this.logs.compiling) {
        logger.info(`start`, `Starting compilation of`, this.compiling.queue.length, `entries.`, [
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
          if (this.logs.compiling) {
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
          if (this.logs.compiling)
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

    if (this.compiling.queue.length > 0) {
      if (this.logs.compiling) {
        logger.info(eventName, this.compiling.pool.batch, `Compilation of`, this.compiling.compiledEntities, `out of`, this.compiling.queueSize, `entries finished.`, [
          `color: rgba(82, 124, 64, 0.75); font-weight: bold; font-style: italic;`,
          `color: rgba(0, 0, 139, 0.35); font-style: italic;`,
          `color: black; font-weight: regular; font-style: regular;`,
          `color: darkblue; font-weight: bold; font-style: regular;`,
          `color: black; font-weight: regular; font-style: regular;`,
          `color: darkblue; font-weight: bold; font-style: regular;`,
          `color: black; font-weight: regular; font-style: regular;`,
        ])
      }
    }

    this.fire(`compilation:${eventName}`, { batch: this.compiling.pool.batch })

    if (hasPooledBatch) this.nextCompilationBatch()
  }

  nextCompilationBatch() {
    const hasPooledBatch = this.compiling.pool.requests.length > 0
    if (!hasPooledBatch) return

    const logger = LOGGER.get(`actor`).get(`pooling`)

    const requests = this.compiling.pool.requests

    if (this.logs.compiling)
      logger
        .group(true)
        .info(`pool`, this.compiling.pool.batch + 1, `Pooling`, requests.length, `requests`, [
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

    this.startCompilation()
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
