/* eslint-disable no-debugger */
import { cloneDeep, findIndex, indexOf, isArray, isNil, isString, uniq } from "lodash"

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

type CompilationInstructions = { feature: GenericFeature; keys: (string | RegExp)[]; baseContext: Partial<CompilationContext> }

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

  pooling: {
    index: {
      string: string[]
      regexp: RegExp[]
    }
    keys: Record<string, { features: GenericFeature[] }>
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
  }

  constructor() {
    super()

    this.logs = {
      compiling: true,
    }

    this.pooling = {
      index: {
        string: [],
        regexp: [],
      },
      keys: {},
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
    }
  }

  listen() {
    this.on(`compilation:done`, event => {})
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
    type: T,
    GCS: object,
    rootKey: number | number[],
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

      const feature = this.build(type, gcs.id, [...(isArray(rootKey) ? rootKey : [rootKey]), parseInt(key)], parent, template)
      feature.addSource(`gcs`, gcs)
      collection.add(feature as any)

      if (!isNil(gcs.children)) {
        const children = isArray(gcs.children) ? Object.fromEntries(gcs.children.map((c, i) => [i, c])) : gcs.children

        const childrenCollection = this.GCS(type, children, [], feature, template)
        feature.children.push(...(childrenCollection.items as any[]))
        collection.add(...childrenCollection.items)
      }
    }

    return collection
  }

  requestCompilation(feature: GenericFeature, keys: (string | RegExp)[], baseContext: Partial<CompilationContext>, options: { delayCompile: boolean }) {
    let instructions: CompilationInstructions = { feature, keys, baseContext }

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

      const delayedInstructions = this.compiling.delayedByFeature[feature.id]
      for (const { keys: delayedKeys, baseContext: delayedBaseContext } of delayedInstructions) {
        newKeys.push(...delayedKeys)
        newBaseContext = { ...newBaseContext, ...delayedBaseContext }

        // ERROR: Untested
        if (Object.keys(newBaseContext).length > 0) debugger
      }

      newKeys.push(...instructions.keys)
      newBaseContext = { ...newBaseContext, ...instructions.baseContext }

      instructions.keys = uniq(newKeys)
      instructions.baseContext = newBaseContext

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
            `into instruction id`,
            targetInstructionsId,
            `[${this.compiling.index[targetInstructionsId].keys.map(key => key.toString()).join(`, `)}]`,
            [
              `color: rgba(0, 0, 0, 0.5); font-style: italic;`,
              `color: black; font-weight: bold; font-style: regular;`,
              `color: rgb(210, 78, 76); font-weight: regular; font-style: italic;`,
              `color: black; font-weight: regular; font-style: italic;`,
              `color: darkblue; font-weight: bold; font-style: regular;`,
              `color: rgb(210, 78, 76); font-weight: regular; font-style: italic;`,
            ],
          )

      this.compiling.index[targetInstructionsId].keys = uniq([...this.compiling.index[targetInstructionsId].keys, ...instructions.keys])
      this.compiling.index[targetInstructionsId].baseContext = { ...this.compiling.index[targetInstructionsId].baseContext, ...instructions.baseContext }

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
            instructions.baseContext,
            [
              `color: rgba(0, 0, 0, 0.5); font-style: italic;`,
              `color: rgba(0, 0, 139, 0.35); font-style: italic;`,
              `color: black; font-weight: regular; font-style: regular;`,
              `color: black; font-weight: bold; font-style: regular;`,
              `color: rgb(210, 78, 76); font-weight: regular; font-style: italic;`,
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
            instructions.baseContext,
            [
              `color: rgba(0, 0, 0, 0.5); font-style: italic;`,
              `color: rgba(0, 0, 139, 0.35); font-style: italic;`,
              `color: black; font-weight: bold; font-style: regular;`,
              `color: rgb(210, 78, 76); font-weight: regular; font-style: italic;`,
            ],
          )
    }
  }

  startCompilation() {
    const logger = LOGGER.get(`actor`).get(`compilation`)

    if (this.compiling.queue.length === 0) {
      if (this.logs.compiling)
        logger.info(`start`, `There are no features in queue to compile`, [
          `color: rgba(0, 0, 0, 0.5); font-weight: bold; font-style: italic;`,
          `color: black; font-weight: regular; font-style: regular;`,
        ])
      return
    }

    if (this.logs.compiling)
      logger.info(`start`, `Starting compilation of`, this.compiling.queue.length, `entries.`, [
        `color: rgba(0, 0, 0, 0.5); font-weight: bold; font-style: italic;`,
        `color: black; font-weight: regular; font-style: regular;`,
        `color: darkblue; font-weight: bold; font-style: regular;`,
        `color: black; font-weight: regular; font-style: regular;`,
      ])

    this.compiling.running = true
    this.compiling.compiledEntities = 0
    this.compiling.queueSize = this.compiling.queue.length
    while (this.compiling.queue.length > 0) {
      const id = this.compiling.queue.shift()!
      const { feature, keys, baseContext } = this.compiling.index[id]

      if (this.logs.compiling)
        logger.info(
          `run`,
          id,
          `[${this.compiling.compiledEntities + 1}/${this.compiling.queueSize}]`,
          `${feature.data.name ?? `id:${feature.id}`}`,
          `(${this.compiling.queue.length} entries left in queue)`,
          `[${keys.map(key => key.toString()).join(`, `)}]`,
          baseContext,
          [
            `color: rgba(0, 0, 0, 0.5); font-style: italic;`,
            `color: rgba(0, 0, 139, 0.35); font-style: italic;`,
            `color: black; font-weight: regular; font-style: regular;`,
            `color: black; font-weight: bold; font-style: regular;`,
            `color: black; font-weight: regular; font-style: italic;`,
            `color: rgb(210, 78, 76); font-weight: regular; font-style: italic;`,
          ],
        )

      feature._compile(keys, baseContext)

      this.compiling.compiledEntities++
    }

    this.compiling.index = []
    this.compiling.byFeature = {}
    this.compiling.running = false

    if (this.logs.compiling)
      logger.info(`done`, `Compilation of`, this.compiling.compiledEntities, `out of`, this.compiling.queueSize, `entries finished.`, [
        `color: rgba(0, 0, 0, 0.5); font-weight: bold; font-style: italic;`,
        `color: black; font-weight: regular; font-style: regular;`,
        `color: darkblue; font-weight: bold; font-style: regular;`,
        `color: black; font-weight: regular; font-style: regular;`,
        `color: darkblue; font-weight: bold; font-style: regular;`,
        `color: black; font-weight: regular; font-style: regular;`,
      ])

    this.fire(`compilation:done`)
  }

  pool(feature: GenericFeature, keys: (string | RegExp)[]) {
    const keysIds = [] as string[]
    for (const key of keys) {
      const type = isString(key) ? `string` : `regexp`

      let index = -1
      if (isString(key)) index = this.pooling.index.string.indexOf(key)
      else index = findIndex(this.pooling.index.regexp, r => r.toString() === key.toString())

      if (index === -1) {
        if (isString(key)) this.pooling.index.string.push(key)
        else this.pooling.index.regexp.push(key)

        index = this.pooling.index[type].length - 1
      }

      keysIds.push([type, index].join(`.`))
    }

    // ERROR: No can do babydoll
    if (keysIds.some(id => id.split(`.`)[1] === -1 || isNil(id.split(`.`)[1]))) debugger // COMMENT

    debugger
    for (const id of keysIds) {
      const pool = this.pooling.keys[id] || (this.pooling.keys[id] = { features: [] })
      pool.features.push(feature)
      // debounce(, 100)

      debugger
    }
  }
}
