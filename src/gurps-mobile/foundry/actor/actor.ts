import { flatten, flattenDeep, get, has, isString, set, isObjectLike, groupBy, sortBy, filter, range, isArray, upperFirst, isRegExp, isNil } from "lodash"

import { MODULE_ID } from "config"
import LOGGER from "logger"

import { Datachanges } from "december/utils"
import BaseFeature from "../../core/feature/base"
import FeatureFactory from "../../core/feature/factory"

import ContextManager from "../actor-sheet/context/manager"
import MoveFeatureContextTemplate from "../actor-sheet/context/feature/variants/move"
import AdvantageFeatureContextTemplate from "../actor-sheet/context/feature/variants/advantage"
import SkillFeatureContextTemplate from "../actor-sheet/context/feature/variants/skill"
import SpellFeatureContextTemplate from "../actor-sheet/context/feature/variants/spell"
import EquipmentFeatureContextTemplate from "../actor-sheet/context/feature/variants/equipment"
import { FEATURE } from "../../core/feature/type"
import DefenseFeatureContextTemplate from "../actor-sheet/context/feature/variants/defense"
import { IComponentDefinition } from "../../../gurps-extension/utils/component"
import { FeatureState } from "../../core/feature/utils"
import { IDerivationFunction, derivation, proxy } from "./feature/pipelines"
import { IGenericFeatureData } from "./feature/pipelines/generic"
import GenericFeature from "./feature/generic"
import SkillFeature from "./feature/skill"

export type ActorCache = {
  links?: Record<string, string[]>
  paths?: Record<string, string>
  _moves?: Record<string, GenericFeature>
  _skill?: Record<`trained` | `untrained` | `unknown`, Record<string, Record<string, SkillFeature>>>
  gca: {
    skill: Record<number, SkillFeature>
  }
  features?: Record<string, GenericFeature>
  components?: Record<string, IComponentDefinition[]>
  //
  contextManager?: ContextManager
  featureFactory?: FeatureFactory
}

export class GurpsMobileActor extends GURPS.GurpsActor {
  skipRenderOnCalculateDerivedValues = false
  _datachanges: Datachanges

  // @ts-ignore
  render(force = false, context = {}, userId: string) {
    for (const app of Object.values(this.apps)) {
      // @ts-ignore
      app.render(force, context, userId)
    }
  }

  // #region CACHE
  get cache(): ActorCache {
    if (this.id === null) return {}
    return get(GURPS._cache, `actors.${this.id}`) as ActorCache
  }

  setCache(path: string | undefined, value: unknown) {
    if (this.id === null) throw new Error(`Cannot set actor cache with a null id`)
    set(GURPS._cache, `actors.${this.id}${path === undefined ? `` : `.${path}`}`, value)
  }

  setFeature(path: string, value: GenericFeature) {
    if (this.id === null) throw new Error(`Cannot set actor cache with a null id`)
    if (this.cache.features === undefined) this.cache.features = {}
    this.cache.features[path] = value
  }

  cacheLink(feature: string, ...links: string[]) {
    for (const link of links) {
      if (!has(this.cache, `links.${link}`)) this.setCache(`links.${link}`, [])
      const cacheLink = get(this.cache, `links.${link}`)
      if (isArray(cacheLink) && !cacheLink.includes(feature)) cacheLink.push(feature)
    }
  }

  getComponents(type: string, filter?: (component: IComponentDefinition) => boolean, states: FeatureState[] | null = [FeatureState.PASSIVE, FeatureState.ACTIVE]) {
    const typeComponents = this.cache.components?.[type] ?? ([] as IComponentDefinition[])
    const components = filter ? typeComponents.filter(component => filter(component)) : typeComponents
    const activeComponents = states === null ? components : components.filter(component => states.some(state => component.feature.data.state & state))

    return activeComponents
  }
  // #endregion

  // #region LOCAL STORAGE
  getLocalStorage<T>(key: string, defaultValue: T) {
    const _key = `${MODULE_ID}.${this.uuid}.${key}`
    const value = window.localStorage.getItem(_key)
    return value === null ? defaultValue : (JSON.parse(value) as T)
  }

  setLocalStorage<T>(key: string, value: T) {
    const _key = `${MODULE_ID}.${this.uuid}.${key}`
    window.localStorage.setItem(_key, JSON.stringify(value))
  }

  removeLocalStorage(key: string) {
    const _key = `${MODULE_ID}.${this.uuid}.${key}`
    window.localStorage.removeItem(_key)
  }
  // #endregion

  // #region DATA
  /**
   * Update the DataModel locally by applying an object of changes to its source data.
   * The provided changes are cleaned, validated, and stored to the source data object for this model.
   * The source data is then re-initialized to apply those changes to the prepared data.
   * The method returns an object of differential changes which modified the original data.
   *
   * @param {object} changes          New values which should be applied to the data model
   * @param {object} [options={}]     Options which determine how the new data is merged
   * @returns {object}                An object containing the changed keys and values
   */
  updateSource(changes: object = {}, options: object = {}): object {
    this._datachanges = new Datachanges(changes)

    return super.updateSource(changes, options)
  }

  /** @override */
  _onUpdate(data: object, options: object & { [`data`]: object; [`render`]: boolean }, userId: string) {
    LOGGER.info(`_onUpdate`, this, `->`, data, options, userId)
    options.data = data

    // super._onUpdate(data, options, userId)
    //        (original call that happens here, bellow I added all subsequent calls to avoid having to hack or reimplemented the classes)

    //    (@ abstract.Document)
    //    _onUpdate(data, options, userId)

    // Re-render associated applications
    // @ts-ignore
    if (options.render !== false) this.render(false, { action: `update`, data, userId } as any)

    //    (@ actor)
    //    _onUpdate(data, options, userId)

    // Update Compendium index
    if (this.pack && !this.isEmbedded) this.compendium.indexDocument(this)

    // Get the changed attributes
    const keys = Object.keys(data).filter(k => k !== `_id`)
    const changed = new Set(keys)

    // Additional options only apply to Actors which are not synthetic Tokens
    if (this.isToken) return

    // If the prototype token was changed, expire any cached token images
    if (changed.has(`token`)) this._tokenImages = null

    // Update the active TokenDocument instances which represent this Actor
    const tokens = this.getActiveTokens(false, true)
    // @ts-ignore
    for (const t of tokens) t._onUpdateBaseActor(data, options)

    // If ownership changed for the actor reset token control
    if (changed.has(`permission`) && tokens.length) {
      if (canvas) {
        canvas.tokens?.releaseAll()
        canvas.tokens?.cycleTokens(true, true)
      }
    }
  }

  /** @override */
  prepareDerivedData(dontRun = true) {
    super.prepareDerivedData()

    // if (dontRun) return console.log(`gurps-mobile`, `SKIPPING AUTO RUNNING`)

    const logger = LOGGER.get(`actor`)

    const timer = logger.time(`prepareDerivedData`) // COMMENT

    const actorData = this.system // where "gurps" stores parsed GCS data (as recommended by v9 of foundry)
    const gcs = actorData._import // where my modded version of "gurps" store raw GCS data
    let cached = this.cache as ActorCache

    // COMPILE CONDITIONALS
    //    TODO: for now features are compiled in groups, maybe make it compile individually
    let all = this._datachanges === undefined && Object.keys(cached ?? {}).length === 0
    const do_basicspeed = all || this._datachanges?.has(`system.basicspeed`)
    const do_moves = all || this._datachanges?.has(/system\.move\.\d+$/i)
    //
    const do_ads = all || this._datachanges?.has(/system\.ads$/i)
    const do_skills = all || this._datachanges?.has(/system\.skills$/i)
    const do_spells = all || this._datachanges?.has(/system\.spells$/i)
    const do_carried_equipment = all || this._datachanges?.has(/system\.equipment\.carried$/i)
    const do_other_equipment = all || this._datachanges?.has(/system\.equipment\.other$/i)
    //
    const do_defenses = true //all || this._datachanges.has(//i)

    const partials = {
      do_basicspeed,
      do_moves,
      //
      do_ads,
      do_skills,
      do_spells,
      do_carried_equipment,
      do_other_equipment,
      //

      do_defenses,
    }
    const partial = Object.values(partials).some(p => !!p)
    all = Object.values(partials).every(p => !!p)

    // VERBOSE LOGGIN
    // console.warn(`WHY THE FUCK THIS IS NOT PRINTINT`)
    // console.log(logger)
    // logger.info(`caralho meu`)
    logger
      .group()
      .info(`[${this.id}]`, `prepareDerivedData${all ? `` : partial ? ` (partial)` : ` (skip)`}`, [
        `background-color: rgb(${all ? `255, 224, 60, 0.45` : partial ? `60,179,113, 0.3` : `0, 0, 0, 0.085`}); font-weight: bold; padding: 3px 0;`,
      ])
    logger.info(`    `, `last datachanges:`, this._datachanges?.data, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `dos:`, { all, ...partials }, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `actor:`, this, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `cached:`, cached, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `gcs:`, gcs, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `moves`, this.system.move, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `)

    if (!all) logger.warn(`    `, `partial:`, partials, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])

    // PREPARE CACHE
    //    if there is no cache, make it
    if (cached === undefined) {
      this.setCache(undefined, {})
      cached = this.cache
    }
    cached.links = cached.links || {}
    cached.features = cached.features || {}
    cached.featureFactory = cached.featureFactory || new FeatureFactory()
    cached.contextManager = cached.contextManager || new ContextManager(this)

    // PREPARE DATA
    //    only if there is gcs data inside actor and some new data to prepare
    if (gcs && (all || partial)) {
      this.prepareAttributes(cached.featureFactory, partials)
      this.prepareFeatures(cached.featureFactory, partials)
      this.prepareDefenses(cached.featureFactory, partials)

      // ERROR: Caralho meu
      // const typeless = Object.values(cached.features).filter(feature => feature.type === undefined)
      // if (typeless.length > 0) debugger
    }

    // VERBOSE LOGGIN
    logger.info(` `)
    timer() // COMMENT
    logger.info(` `)

    logger.info(`    `, `features:`, cached.features, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `links:`, cached.links, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])

    logger.group()

    // save cache (is it necessary?)
    this.setCache(undefined, cached)
  }

  prepareAttributes(factory: FeatureFactory, dos: Record<string, boolean>) {
    const logger = LOGGER.get(`actor`)

    const actorData = this.system // where "gurps" stores parsed GCS data (as recommended by v9 of foundry)
    const rawGCS = actorData._import // where my modded version of "gurps" store raw GCS data

    const { do_basicspeed, do_moves } = dos

    const timer = logger.time(`prepareAttributes`) // COMMENT

    // #region Moves

    const timer_move = logger.openGroup().info(`    Moves`, [`color: rgba(0, 0, 0, 0.5); font-weight: regular; font-style: italic;`]).time(`prepareMoves`) // COMMENT

    if (do_basicspeed) {
      /**
       * [target, destination, function, priority]
       *    priority — default to -1 since it is manual
       *    function — must be defined, since being a function is a criteria for the property to be considered a "derivation" and not a piece of data inside a source
       *    target — for ONE target, could be function name
       *           — for MULTIPLE targets ????
       *    destination — for DESTINATION = TARGET, no need to inform
       *                — for ONE destination, <> target ??????
       *                — for MULTIPLE destinations ????
       */
      factory
        .build(`generic`, `move-basic_speed`, [0, 0], undefined, {
          context: { templates: MoveFeatureContextTemplate },
        })
        .addPipeline<IGenericFeatureData>([proxy.gcs(`value`), proxy.manual(`name`), proxy.manual(`label`)])
        .addSource(`manual`, { name: game.i18n.localize(`GURPS.basicspeed`), label: `GURPS.basicspeed` }, { delayCompile: true })
        .addSource(`gcs`, actorData.basicspeed)
        .integrateOn(`compile:gcs`, this)
    }

    if (do_moves) {
      const moves = Object.keys(actorData.move || {})
      for (const key of moves) {
        type MoveType = (typeof actorData.move)[keyof typeof actorData.move]
        const move = actorData.move[key]

        const feature = factory
          .build<MoveType>(`generic`, `move-${move.mode.replace(`GURPS.moveMode`, ``).toLowerCase()}`, [1, parseInt(key)], undefined, {
            context: { templates: MoveFeatureContextTemplate },
          })
          .addPipeline<IGenericFeatureData>([
            derivation.gcs(`mode`, [`name`, `label`], ({ mode }) => ({ name: game.i18n.localize(mode as any), label: mode })),
            derivation.gcs(`basic`, `value`, ({ basic }) => ({ value: basic })),
            // derivation.gcs(`default`, `state`, (manual: MoveType) => ({ state: manual.default ? FeatureState.ACTIVE : FeatureState.INACTIVE })),
          ])
          .addSource(`gcs`, move)
          .integrateOn(`compile:gcs`, this)

        this.setCache(`_moves.${feature.id.replace(`move-`, ``)}`, feature)
      }
    }

    factory.startCompilation()
    timer_move.group()(`    Moves`, [`font-weight: bold;`]) // COMMENT

    // #endregion

    timer(`Prepare attributes`, [`font-weight: bold;`]) // COMMENT
  }

  prepareFeatures(factory: FeatureFactory, dos: Record<string, boolean>) {
    const logger = LOGGER.get(`actor`)

    const actorData = this.system // where "gurps" stores parsed GCS data (as recommended by v9 of foundry)
    const rawGCS = actorData._import // where my modded version of "gurps" store raw GCS data

    const { do_ads, do_skills, do_spells, do_carried_equipment, do_other_equipment } = dos

    console.log(` `)

    const timer = logger.time(`prepareFeatures`) // COMMENT

    if (do_ads) {
      const timer_advantages = logger.openGroup().info(`    Advantages`, [`color: rgba(0, 0, 0, 0.5); font-weight: regular; font-style: italic;`]).time(`prepareAdvantages`) // COMMENT
      factory
        .GCS(`advantage`, rawGCS.traits, [], undefined, {
          context: { templates: AdvantageFeatureContextTemplate },
        })
        .loadFromGCAOn(`compile:gcs`, true)
        .integrateOn(`loadFromGCA`, this)

      factory.startCompilation()
      timer_advantages.group()(`    Advantages`, [`font-weight: bold;`]) // COMMENT
    }

    // if (do_skills) {
    //   const timer_skills = logger.openGroup().info(`    Skills`, [`color: rgba(0, 0, 0, 0.5); font-weight: regular; font-style: italic;`]).time(`prepareSkills`) // COMMENT
    //   factory
    //     .GCS(`skill`, rawGCS.skills, [], undefined, {
    //       context: { templates: SkillFeatureContextTemplate },
    //     })
    //     .loadFromGCAOn(`compile:gcs`, true)
    //     .integrateOn(`loadFromGCA`, this)

    //   factory.startCompilation()
    //   timer_skills.group()(`    Skills`, [`font-weight: bold;`]) // COMMENT

    //   // eslint-disable-next-line prettier/prettier
    //   const timer_untrained = logger.openGroup().info(`      Untrained Skills`, [`color: rgba(0, 0, 0, 0.5); font-weight: regular; font-style: italic;`]).time(`prepareUntrainedSkills`) // COMMENT
    //   // inject "Untrained Skills" (skills with default) and "Other Skills" (skills the character cant roll?)
    //   SkillFeature.untrained(this, factory, { context: { templates: SkillFeatureContextTemplate } })

    //   factory.startCompilation()
    //   timer_untrained.group()(`      Untrained Skills`, [`font-weight: bold;`]) // COMMENT

    //   const timer_other = logger.openGroup().info(`      Other Skills`, [`color: rgba(0, 0, 0, 0.5); font-weight: regular; font-style: italic;`]).time(`prepareAllSkills`) // COMMENT
    //   // inject "All Skills" for special display
    //   const allSkills = SkillFeature.all(this, factory, { context: { templates: SkillFeatureContextTemplate } })
    //   this.setCache(`query.skill`, allSkills)
    //   timer_other.group()(`      Other Skills`, [`font-weight: bold;`]) // COMMENT
    // }

    // if (do_spells) {
    //   const timer_spells = logger.openGroup().info(`    Spells`, [`color: rgba(0, 0, 0, 0.5); font-weight: regular; font-style: italic;`]).time(`prepareSpells`) // COMMENT
    //   factory
    //     .GCS(`spell`, rawGCS.spells, [], undefined, {
    //       context: { templates: SpellFeatureContextTemplate },
    //     })
    //     .loadFromGCAOn(`compile:gcs`, true)
    //     .integrateOn(`loadFromGCA`, this)

    //   factory.startCompilation()
    //   timer_spells.group()(`    Spells`, [`font-weight: bold;`]) // COMMENT
    // }

    // if (do_carried_equipment) {
    //   // eslint-disable-next-line prettier/prettier
    //   const timer_carried_equipment = logger.openGroup().info(`    Carried Equipment`, [`color: rgba(0, 0, 0, 0.5); font-weight: regular; font-style: italic;`]).time(`prepareCarriedEquipment`) // COMMENT
    //   factory
    //     .GCS(`equipment`, rawGCS.equipment, [], undefined, {
    //       context: { templates: EquipmentFeatureContextTemplate },
    //     })
    //     .addSource(`manual`, { carried: true }, { delayCompile: true })
    //     .loadFromGCAOn(`compile:gcs`, true)
    //     .integrateOn(`loadFromGCA`, this)

    //   factory.startCompilation()
    //   timer_carried_equipment.group()(`    Carried Equipment`, [`font-weight: bold;`]) // COMMENT
    // }

    // if (do_other_equipment) {
    //   // eslint-disable-next-line prettier/prettier
    //   const timer_other_equipment = logger.openGroup().info(`    Other Equipment`, [`color: rgba(0, 0, 0, 0.5); font-weight: regular; font-style: italic;`]).time(`prepareOtherEquipment`) // COMMENT
    //   factory
    //     .GCS(`equipment`, rawGCS.other_equipment, [], undefined, {
    //       context: { templates: EquipmentFeatureContextTemplate },
    //     })
    //     .addSource(`manual`, { carried: false }, { delayCompile: true })
    //     .loadFromGCAOn(`compile:gcs`, true)
    //     .integrateOn(`loadFromGCA`, this)

    //   factory.startCompilation()
    //   timer_other_equipment.group()(`    Other Equipment`, [`font-weight: bold;`]) // COMMENT
    // }

    const n = Object.values(this.cache.features ?? {}).length
    logger.info(``)
    timer(`Prepare ${n} feature${n === 1 ? `` : `s`}`, [`font-weight: bold;`]) // COMMENT
  }

  prepareDefenses(factory: FeatureFactory, dos: Record<string, boolean>) {
    const logger = LOGGER.get(`actor`)

    const actorData = this.system // where "gurps" stores parsed GCS data (as recommended by v9 of foundry)
    const rawGCS = actorData._import // where my modded version of "gurps" store raw GCS data

    const { do_defenses } = dos

    const timer = logger.time(`prepareDefenses`) // COMMENT

    if (do_defenses) {
      // eslint-disable-next-line prettier/prettier
      const timer_active_defense = logger.openGroup().info(`    Active Defenses`, [`color: rgba(0, 0, 0, 0.5); font-weight: regular; font-style: italic;`]).time(`prepareActiveDefenses`) // COMMENT
      const activeDefenses = [`block`, `dodge`, `parry`]

      for (let i = 0; i < activeDefenses.length; i++) {
        const activeDefense = activeDefenses[i]

        const feature = factory
          .build(`generic`, `activedefense-${activeDefense}`, [2, 0], undefined, {
            context: { templates: DefenseFeatureContextTemplate },
          })
          .addPipeline<IGenericFeatureData>([proxy.manual(`name`)])
          .addSource(`manual`, { type: FEATURE.GENERIC, name: upperFirst(activeDefense) })
          .integrateOn(`compile:manual`, this)
      }

      factory.startCompilation()

      timer_active_defense.group()(`    Active Defenses`, [`font-weight: bold;`]) // COMMENT
    }

    timer(`Prepare defenses`, [`font-weight: bold;`]) // COMMENT
    // #endregion
  }
}
