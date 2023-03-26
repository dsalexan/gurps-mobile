import { flatten, flattenDeep, get, has, isString, set, isObjectLike, groupBy, sortBy, filter, range, isArray, upperFirst } from "lodash"

import { MODULE_ID } from "config"
import LOGGER from "logger"

import { Datachanges } from "december/utils"
import BaseFeature from "../../core/feature/base"
import FeatureFactory from "../../core/feature/factory"

import SkillFeature from "../../core/feature/variants/skill"
import ContextManager from "../actor-sheet/context/manager"
import MoveFeatureContextTemplate from "../actor-sheet/context/feature/variants/move"
import GenericFeature from "../../core/feature/variants/generic"
import AdvantageFeatureContextTemplate from "../actor-sheet/context/feature/variants/advantage"
import SkillFeatureContextTemplate from "../actor-sheet/context/feature/variants/skill"
import SpellFeatureContextTemplate from "../actor-sheet/context/feature/variants/spell"
import EquipmentFeatureContextTemplate from "../actor-sheet/context/feature/variants/equipment"
import { FEATURE } from "../../core/feature/type"
import DefenseFeatureContextTemplate from "../actor-sheet/context/feature/variants/defense"
import { IComponentDefinition } from "../../../gurps-extension/utils/component"
import { FeatureState } from "../../core/feature/utils"

export type ActorCache = {
  links?: Record<string, string[]>
  paths?: Record<string, string>
  _moves?: Record<string, GenericFeature>
  _skill?: Record<string, SkillFeature[]>
  _trainedSkill?: Record<string, Record<string, SkillFeature>>
  _untrainedSkill?: Record<string, Record<string, SkillFeature>>
  features?: Record<string, BaseFeature>
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

  setFeature(path: string, value: BaseFeature) {
    if (this.id === null) throw new Error(`Cannot set actor cache with a null id`)
    if (this.cache.features === undefined) this.cache.features = {}
    this.cache.features[path] = value
  }

  getCachedSkill(name: string) {
    if (!this.cache._skill) return null

    const result = this.cache._skill[name] ?? {}
    const ids = Object.keys(result)

    if (ids.length === 1) return result[ids[0]]
    else if (ids.length === 0) return null
    else {
      LOGGER.warn(`Cannot decide cached skill for`, name, `in`, ids, `@`, result, this)
      // eslint-disable-next-line no-debugger
      debugger
    }
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
    const activeComponents = states === null ? components : components.filter(component => states.some(state => component.feature.state & state))

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
  prepareDerivedData() {
    super.prepareDerivedData()

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
      .group(true)
      .info(`[${this.id}]`, `prepareDerivedData${all ? `` : partial ? ` (partial)` : ` (skip)`}`, [
        `background-color: rgb(${all ? `255, 224, 60, 0.45` : partial ? `60,179,113, 0.3` : `0, 0, 0, 0.085`}); font-weight: bold; padding: 3px 0;`,
      ])
    logger.info(`    `, `last datachanges:`, this._datachanges?.data, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `dos:`, { all, ...partials }, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `actor:`, this, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `cached:`, cached, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `gcs:`, gcs, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])

    if (!all) logger.warn(`    `, `partial:`, partials, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])

    // PREPARE CACHE
    //    if there is no cache, make it
    if (cached === undefined) {
      this.setCache(undefined, {})
      cached = this.cache
    }
    cached.links = cached.links || {}
    cached.features = cached.features || {}
    cached.paths = cached.paths || {}
    cached.featureFactory = cached.featureFactory || new FeatureFactory()
    cached.contextManager = cached.contextManager || new ContextManager(this)

    // PREPARE DATA
    //    only if there is gcs data inside actor and some new data to prepare
    if (gcs && (all || partial)) {
      this.prepareAttributes(cached.featureFactory, partials)
      this.prepareFeatures(cached.featureFactory, partials)
      this.prepareDefenses(cached.featureFactory, partials)
    }

    // VERBOSE LOGGIN
    logger.info(` `)
    timer() // COMMENT
    logger.info(` `)

    logger.info(`    `, `features:`, cached.features, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `links:`, cached.links, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `paths:`, cached.paths, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])

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

    if (do_basicspeed) {
      factory
        .build(`generic`, `basicspeed`, `system.`, null, {
          context: { templates: MoveFeatureContextTemplate },
          key: () => 0,
          manual: {
            id: () => `move-basic_speed`,
            name: () => `GURPS.basicspeed`,
            value: ({ gcs }) => gcs[`value`],
          },
        })
        .addSource(`gcs`, actorData.basicspeed)
        .compile()
        .integrate(this)
    }

    if (do_moves) {
      const moves = Object.keys(actorData.move || {})
      for (const key of moves) {
        const move = actorData.move[key]

        const feature = factory
          .build(`generic`, `move.${key}`, `system.`, null, {
            context: { templates: MoveFeatureContextTemplate },
            key: () => [1, parseInt(key)],
            manual: {
              id: ({ gcs: move }) => `move-${move.mode.replace(`GURPS.moveMode`, ``).toLowerCase()}`,
              name: ({ gcs: move }) => move[`mode`],
              value: ({ gcs: move }) => move[`basic`],
            },
          })
          .addSource(`gcs`, move)
          .compile()
          .integrate(this)

        this.setCache(`_moves.${feature.id.replace(`move-`, ``)}`, feature)
      }
    }

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

    if (do_ads)
      factory
        .parse(`advantage`, rawGCS.traits, `system._import.traits.`, null, {
          context: { templates: AdvantageFeatureContextTemplate },
        })
        .loadFromGCA(true)
        .integrate(this)

    if (do_skills) {
      factory
        .parse(`skill`, rawGCS.skills, `system._import.skills.`, null, {
          context: { templates: SkillFeatureContextTemplate },
        })
        .loadFromGCA(true)
        .integrate(this)

      // inject "Untrained Skills" (skills with default) and "Other Skills" (skills the character cant roll?)
      SkillFeature.untrained(this, { factory, context: { templates: SkillFeatureContextTemplate } }).map(f => f.integrate(this))

      // inject "All Skills" for special display
      const allSkills = SkillFeature.all(this, { factory, context: { templates: SkillFeatureContextTemplate } })
      this.setCache(`query.skill`, allSkills)
    }

    if (do_spells)
      factory
        .parse(`spell`, rawGCS.spells, `system._import.spells.`, null, {
          context: { templates: SpellFeatureContextTemplate },
        })
        .loadFromGCA(true)
        .integrate(this)

    if (do_carried_equipment)
      factory
        .parse(`equipment`, rawGCS.equipment, `system._import.equipment.`, null, {
          context: { templates: EquipmentFeatureContextTemplate },
          manual: { carried: true },
        })
        .loadFromGCA(true)
        .integrate(this)

    if (do_other_equipment)
      factory
        .parse(`equipment`, rawGCS.other_equipment, `system._import.other_equipment.`, null, {
          context: { templates: EquipmentFeatureContextTemplate },
          manual: { carried: false },
        })
        .loadFromGCA(true)
        .integrate(this)

    const n = Object.values(this.cache.features ?? {}).length
    timer(`Prepare ${n} feature${n === 1 ? `` : `s`}`, [`font-weight: bold;`]) // COMMENT
  }

  prepareDefenses(factory: FeatureFactory, dos: Record<string, boolean>) {
    const logger = LOGGER.get(`actor`)

    const actorData = this.system // where "gurps" stores parsed GCS data (as recommended by v9 of foundry)
    const rawGCS = actorData._import // where my modded version of "gurps" store raw GCS data

    const { do_defenses } = dos

    const timer = logger.time(`prepareDefenses`) // COMMENT

    if (do_defenses) {
      const activeDefenses = [`block`, `dodge`, `parry`]

      for (let i = 0; i < activeDefenses.length; i++) {
        const activeDefense = activeDefenses[i]

        const feature = factory
          .build(`generic`, activeDefense, `system.`, null, {
            context: { templates: DefenseFeatureContextTemplate },
            key: () => [1, i],
            manual: {
              id: () => `activedefense-${activeDefense}`,
              name: () => upperFirst(activeDefense),
              type: () => FEATURE.GENERIC,
            },
          })
          // .addSource(`gcs`, move)
          .compile()
          .integrate(this)
      }
    }

    timer(`Prepare defenses`, [`font-weight: bold;`]) // COMMENT
    // #endregion
  }
}
