import LOGGER from "logger"
import { MODULE_ID } from "config"

import { GurpsActorSheet } from "gurps/module/actor/actor-sheet"
import { GurpsMobileActor } from "../actor/actor"

import createManeuverTray, { Tray } from "./maneuverTray"

import { cloneDeep, flatten, flattenDeep, get, groupBy, intersection, isBoolean, isNil, last, max, orderBy, set, sortBy, uniq, unzip } from "lodash"
import { getStatus } from "./status"
import HTMLManager from "./html"
import ContextManager from "./context/manager"
import { Datachanges } from "../../../december/utils"
import HTMLFeature from "./html/feature"
import Feature from "../actor/feature"
import SkillFeature from "../actor/feature/skill"
import GenericFeature from "../actor/feature/generic"
import WeaponFeature from "../actor/feature/usage"
import { push } from "../../../december/utils/lodash"
import { IListContext } from "./context/container/list"
import { IContext } from "./context/context"
import { usage } from "yargs"
import FeatureUsage from "../actor/feature/usage"
import { calculateLevel, nonSkillVariables, allowedSkillVariables, viabilityTest } from "../../../gurps-extension/utils/level"
import { DefenseFeatureContextSpecs } from "./context/feature/defense"
import DefenseFeature from "../actor/feature/defense"
import { someParent } from "../../core/feature/utils"

export interface Options extends ActorSheet.Options {
  noContext: boolean
}

export interface Data extends ActorSheet.Data<Options> {
  // maneuvers
  lastManeuver: string
  maneuvers: Tray[]
  // status?
  status: any[]
  tags: any[]
  // tabs
  combatTab: string
  oocTab: string

  tabs: {
    attacks: any[]
    defenses: any[]
    //
    attributes: any[]
    advantages: any[]
    skills: any[]
    spells: any[]
    equipment: any[]
  }
  pinned: any[]
}

/**
 *
 */
function dontRender(...args: any[]) {
  const logger = LOGGER.get(`actor-sheet`)
  logger.warn(...args)
  return false
}

export class GurpsMobileActorSheet extends GurpsActorSheet {
  // #region STATE
  htmlManager: HTMLManager
  ui = {
    combat: {
      maneuvers: {
        scroll: null,
      },
    },
  }
  features: object = {}
  // #endregion

  constructor(data: any, context: any) {
    super(data, context)

    this.htmlManager = new HTMLManager(this)
  }

  // #region FOUNDRY OVERRIDES

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: [`mobile`, `gurps-mobile`, `sheet`, `actor`],
      resizable: false,
      width: `100vw`,
      height: `100vh`,
      // tabs: [{ navSelector: `.gurps-sheet-tabs`, contentSelector: `.sheet-body`, initial: `description` }],
      // scrollY: [`.gurpsactorsheet #advantages #reactions #melee #ranged #skills #spells #equipmentcarried #equipmentother #notes`],
      // dragDrop: [{ dragSelector: `.item-list .item`, dropSelector: null }],
    })
  }

  /** @override */
  get template() {
    return `modules/${MODULE_ID}/templates/sheets/mobile-actor-sheet.hbs`
  }

  get actor(): GurpsMobileActor {
    return (this as any).object as GurpsMobileActor
  }

  /** @override */
  _forceRender() {
    return
  }

  // #endregion

  // #region RENDER

  // TODO: ideally there should not be a renderInner, since I dont want to render the entire sheet (only some partials)
  /**
   * Customize how inner HTML is replaced when the application is refreshed
   *
   * @param {jQuery} element      The original HTML processed as a jQuery object
   * @param {jQuery} html         New updated HTML as a jQuery object
   * @private
   */
  _replaceHTML(element, html) {
    console.log(`gurps-mobile`, `MobileGurpsActorSheet._replaceHTML`, element, html, `.`, this.popOut)
    // return super._replaceHTML(element, html)
    if (!element.length) return

    // For pop-out windows update the inner content and the window title
    if (this.popOut) {
      // element.find(`.window-content`).html(html)
      // element.find(`.window-title`).text(this.title)
    }

    // For regular applications, replace the whole thing
    else {
      // element.replaceWith(html)
      // this._element = html
    }
  }

  async skipRender(...promises) {
    return await new Promise<void>(resolve => {
      this.actor.ignoreRender = true
      this.actor.skipRenderOnCalculateDerivedValues = true

      Promise.all(promises).then(() => {
        console.log(`Render-skipping promises runned`, this.actor.ignoreRender)
        Hooks.once(`postRenderMobileGurpsActorSheet`, (...args) => {
          // console.log(`unflag IGNORE RENDER`)
          this.actor.ignoreRender = false
          resolve()
        })
      })
    })
  }

  activateListeners(html: JQuery<HTMLElement>) {
    this.htmlManager.activateListeners(html)
  }

  async _render(force = false, context: any = {}) {
    const logger = LOGGER.get(`actor-sheet`)

    const origin = context?.userId
    // @ts-ignore
    const html = this.element.find(`.window-content`).children(0)

    const ignorableRenderContexts = [`createActiveEffect`, `updateActiveEffect`, `deleteActiveEffect`]

    // state
    const sheetWasReimported = this.actor.forceRenderAfterSheetImport
    if (sheetWasReimported) force = true

    const unknownOrigin = origin === undefined
    const internalOrigin = origin === game.userId
    const externalOrigin = origin !== game.userId && !unknownOrigin

    const action = context?.action ?? (context?.renderContext !== undefined ? `context` : `unknown`)
    const datachanges = new Datachanges(context?.data)

    // ignores
    const ignoreUnknownEmpty = action === `unknown`
    const ignoreUpdate = action === `update`
    const ignoreRenderContext = ignorableRenderContexts.includes(context?.renderContext)

    // CONSOLE.LOG
    const logs = [
      [`unknownOrigin`, unknownOrigin || undefined],
      [`internalOrigin`, internalOrigin || undefined],
      [`externalOrigin`, externalOrigin || undefined], //
      [`action`, action],
      [`data changes`, Object.keys(datachanges).length || undefined],
    ].filter(([label, value]) => value !== undefined)

    if (force) logger.warn(`[${this.actor.id}]`, `_render${force ? ` (${sheetWasReimported ? `re-import` : `force`})` : ``}`, [`font-weight: bold;`])
    logger
      .group(true)
      .info(`[${this.actor.id}]`, `_render${force ? ` (${sheetWasReimported ? `re-import` : `force`})` : ``}`, `user:${context?.userId ?? `unknown`}`, [
        `font-weight: regular;`,
        ``,
        `color: rgba(197, 25, 22, ${context?.userId ? `1` : `0.5`}); font-style: italic;`,
      ])
    logger.info(`    `, `context:`, context, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `state:`, (this as any)._state, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `element:`, (this as any).element, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `_element:`, (this as any)._element, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `datachanges:`, datachanges, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `re-import:`, sheetWasReimported, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])

    logger.info(` `)
    logger.info(`Relevant parameters`)
    for (const [label, value] of logs) {
      logger.info(`    `, `${label}:`, value, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    }

    let shouldRender = true

    if (!force) {
      if (ignoreUnknownEmpty) shouldRender = dontRender(`(skipping)`, `unknown/empty context ignored`, [`font-weight: bold;`, `font-weight: regular;`])
      if (ignoreUpdate) shouldRender = dontRender(`(skipping)`, `update action ignored`, [`font-weight: bold;`, `font-weight: regular;`])
      if (ignoreRenderContext) shouldRender = dontRender(`(skipping)`, `render context ignored`, context?.renderContext, [`font-weight: bold;`, `font-weight: regular;`])
    }
    logger.group()

    if (shouldRender) {
      logger.info(`[${this.actor.id}]`, `super._render...`, [`background-color: rgb(0,191,255, 0.3); font-weight: bold; padding: 3px 0;`])
      await super._render(force, context)
    } else {
      await this._updateHtml({ ...context, datachanges })
    }

    this.actor.forceRenderAfterSheetImport = false
    // if (!(this.object?.ignoreRender || this.ignoreRender))
    // Hooks.call(`postRenderMobileGurpsActorSheet`)
  }

  async _updateHtml({ datachanges, ...context }: { datachanges: Datachanges; [key: string]: any }) {
    const logger = LOGGER.get(`actor-sheet`)

    const options = {}
    foundry.utils.mergeObject(options, (this as any).options, { insertKeys: false })
    foundry.utils.mergeObject(options, context, { insertKeys: false })

    const element = (this as any).element as JQuery<HTMLElement>
    const html = element.find(`.window-content`).children(0 as any)

    // compile conditionals
    const do_lastManeuver = datachanges.has(`flags.gurps.mobile.lastManeuver`)
    const do_maneuver = context?.renderContext === `updateActiveEffect`

    const do_pin = datachanges.has(`flags.gurps.mobile.features.pinned`)
    const do_hidden = datachanges.has(`flags.gurps.mobile.features.hidden`)
    const do_expanded = datachanges.has(`flags.gurps.mobile.features.expanded`)
    const do_roller = datachanges.has(`flags.gurps.mobile.features.roller`)

    const do_moves = datachanges?.has(/system\.move\.\d+$/i)

    const conditionals = { do_lastManeuver, do_maneuver, do_hidden, do_pin, do_expanded, do_roller, do_moves }
    const _conditionals = Object.entries(conditionals)
      .filter(([_, value]) => value)
      .map(([key]) => key.replace(`do_`, ``))
    const some = Object.values(conditionals).some(p => !!p)
    const all = Object.values(conditionals).every(p => !!p) // rgb(60, 179, 113)

    const timer = logger.time(`_updateHtml`) // COMMENT
    logger
      .group(true)
      .info(`[${this.actor.id}]`, `_updateHtml${all ? `` : some ? ` (partials: ${_conditionals.join(`, `)})` : ` (skip)`}`, [
        `background-color: rgb(${all ? `255, 224, 60, 0.45` : some ? `60,179,113, 0.3` : `0, 0, 0, 0.085`}); font-weight: bold; padding: 3px 0;`,
      ])
    logger.info(`    `, `datachanges:`, datachanges.data, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `context:`, context, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `conditionals:`, conditionals, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(` `)

    if (some) {
      // MANEUVERS
      if (do_lastManeuver) this.htmlManager.Combat.ManeuverTray.updateLastManeuver(html, context.datachanges.data[`flags.gurps.mobile.lastManeuver`])
      if (do_maneuver) this.htmlManager.Combat.ManeuverTray.updateManeuver(html, this.actor.system.conditions.maneuver)

      // #region FEATURE

      // hide, expanded, roller
      let lists = [] as string[]
      const doubles = [`hidden`, `expanded`, `roller`]
      for (const state of doubles) {
        const do_state = conditionals[`do_${state}`]
        if (do_state) {
          const subtype = { hidden: `list`, expanded: `data`, roller: `list` }[state]!

          const pattern = new RegExp(`flags\\.gurps\\.mobile\\.features\\.${state}\\.[^\\.]+`)
          const features = datachanges.get(pattern)

          const grouped = {} as Record<`true` | `false`, [string, string][]>
          for (const key of features) {
            const change = get(datachanges.changes, key)
            if (!isBoolean(change)) continue

            // secondaryId is listId for hidden and dataId for expanded/roller
            const [id, secondaryId] = key.split(`.`).slice(-2)
            push(grouped, change.toString(), [id, secondaryId])
          }

          for (const value of [`true`, `false`]) {
            if (!grouped[value] || grouped[value].length === 0) continue

            for (const [id, secondaryId] of grouped[value]) {
              /**
               * HOW IT WORKS
               *  (hidden, roller)            SECONDARY -> FEATURE
               *      Feature's parent is determined by secondaryId
               *  (expanded)  FEATURE   -> SECONDARY
               *      Feature's child is determined by secondaryId
               */

              const feature = id.startsWith(`proxy-`) ? GCA.skills.byId?.[id] : this.actor.cache.features?.[id]

              let node: JQuery<HTMLElement>
              if ([`list`].includes(subtype)) {
                const parent = html.find(`.feature-${subtype}[data-${subtype === `list` ? `list` : `id`}="${secondaryId}"]`)

                node = parent.find(`.feature[data-id="${id}"]:not(.ignore-${state})`)
              } else if ([`expanded`, `roller`].includes(state)) {
                const child = html.find(`.feature-${subtype}[data-${subtype === `list` ? `list` : `id`}="${secondaryId}"]`)

                node = child.closest(`.feature[data-id="${id}"]:not(.ignore-${state})`)
              }

              // Unimplemented
              if (!feature) debugger
              if (!node || node.length === 0) debugger

              if (feature) {
                const htmlFeature = HTMLFeature(node!, feature, this.actor)

                if (state === `hidden`) htmlFeature.updateHidden(value === `true`)
                else if (state === `roller`) htmlFeature.updateRoller(value === `true`)
                else if (state === `expanded`) htmlFeature.updateExpanded(secondaryId, value === `true`)

                if (state === `list`) lists.push(secondaryId)
              }
            }
          }
        }

        lists = uniq(lists)
      }

      // update hide/show-all and alikes
      for (const listId of lists) {
        const allFeatures = html.find(`.feature-list[data-list="${listId}"] .feature`).length
        const hiddenFeatures = html.find(`.feature-list[data-list="${listId}"] .feature.hidden`).length

        //    disable display-hidden and show-all if there is no hidden feature
        if (hiddenFeatures === 0) {
          html.find(`.feature-list[data-list="${listId}"] > .header > .button.display-hidden`).addClass(`disabled`)
          html.find(`.feature-list[data-list="${listId}"] > .header > .button.show-all`).addClass(`disabled`)
        } else {
          html.find(`.feature-list[data-list="${listId}"] > .header > .button.display-hidden`).removeClass(`disabled`)
          html.find(`.feature-list[data-list="${listId}"] > .header > .button.show-all`).removeClass(`disabled`)
        }

        // update display-hidden count
        html.find(`.feature-list[data-list="${listId}"] > .header > .button.display-hidden > .label > span`).html(hiddenFeatures.toString())

        //    disable hide-all if there is no visible feature
        if (hiddenFeatures === allFeatures) {
          html.find(`.feature-list[data-list="${listId}"] > .header > .button.hide-all`).addClass(`disabled`)
        } else {
          html.find(`.feature-list[data-list="${listId}"] > .header > .button.hide-all`).removeClass(`disabled`)
        }
      }

      // pin
      if (do_pin) {
        const features = datachanges.get(`flags.gurps.mobile.features.pinned`)

        for (const key of features) {
          const [pinned, id] = datachanges.getState(key)

          const feature = this.actor.cache.features?.[id]
          const node = html.find(`.feature[data-id="${id}"]:not(.ignore-pinned)`)

          if (feature) HTMLFeature(node, feature, this.actor).updatePinned(pinned as boolean)
        }
      }

      // SPEED AND MOVE
      if (do_moves) {
        const moves = datachanges.get(/system\.move\.\d+$/i)
        for (const key of moves) {
          const move = this.actor.system.move[last(key.split(`.`))]
          const id = `move-${move.mode.replace(`GURPS.moveMode`, ``).toLowerCase()}`

          const feature = this.actor.cache.features?.[id]

          // ERROR: No can do
          if (!feature) debugger

          const node = html.find(`.feature[data-id="${id}"]`)

          if (feature) HTMLFeature(node, feature, this.actor).updateMove()
        }
      }
      // #endregion
    }

    timer() // COMMENT
    logger.group()
  }

  // #endregion

  // #region DATA
  getData(options?: Partial<Options> | undefined): any {
    const sheetData = super.getData(options) as any as Data
    const logger = LOGGER.get(`actor-sheet`)

    const timer = logger.time(`getData`) // COMMENT

    const all = !options?.noContext
    const partial = options?.noContext

    let suffix = all ? ` (all)` : partial ? ` (partial)` : ``
    logger
      .group(true)
      .info(`[${this.actor.id}]`, `getData${options?.noContext ? ` (No Context Generation)` : ``}${suffix}`, [
        `background-color: rgb(${all ? `255, 224, 60, 0.45` : partial ? `60,179,113, 0.3` : `0, 0, 0, 0.085`}); font-weight: bold; padding: 3px 0;`,
      ])
    logger.info(`    `, `options:`, options, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])

    this.injectHeadersAndShit(sheetData, options)
    this.injectFeatures(sheetData, options)

    timer() // COMMENT
    logger.group()

    return sheetData
  }

  injectHeadersAndShit(sheetData: Data, options?: Partial<Options>) {
    const logger = LOGGER.get(`actor-sheet`)
    const cache = this.actor.cache

    const timer = logger.time(`Inject Headers and Shit`) // COMMENT

    // COMBAT
    // collapsed
    if (this.actor.getFlag(`gurps`, `mobile.combatClass`) === undefined) set(this.actor, `flags.gurps.mobile.combatClass`, `collapsed`)

    // maneuvers
    sheetData.lastManeuver = this.actor.flags.gurps.mobile.lastManeuver
    const allManeuvers = GURPS.Maneuvers.getAll()
    sheetData.maneuvers = createManeuverTray(allManeuvers, (type: string, id: string) => `${type}.${id}` === `button.allout_defe1nse`)

    // status
    sheetData.status = getStatus((sheetData.data as any).conditions.maneuver)

    sheetData.combatTab = this.actor.getLocalStorage(`combat.selectedTab`, `attack`)
    // TODO: based on selected maneuver
    sheetData.tags = [] // [`defense`, `spell`, `equipment`]

    sheetData.oocTab = this.actor.getLocalStorage(`ooc.selectedTab`, `attribute`)

    timer(`Headers and Shit`, [`font-weight: bold;`]) // COMMENT
  }

  injectFeatures(sheetData: Data, options?: Partial<Options>) {
    if (options?.noContext) return console.info(`Skipping Inject Features (No Context Generation)`, [`font-style: italic;`])

    const logger = LOGGER.get(`actor-sheet`)
    const cache = this.actor.cache

    // Preparing tabs
    sheetData.tabs = {
      defenses: [],
      //
      attributes: [],
      advantages: [],
      skills: [],
      spells: [],
      equipment: [],
    }

    const timer = logger.time(`Inject Features`, [`font-weight: bold;`]) // COMMENT

    const tMakingContainerContextBuilder = logger.time(`Making Container Context Builder`) // COMMENT

    const contextManager = this.actor.cache.contextManager as ContextManager

    tMakingContainerContextBuilder(`    Making Container Context Builder`, [`font-weight: bold;`]) // COMMENT
    const tGroupingFeatures = logger.time(`Grouping Features`) // COMMENT

    const allFeatures = Object.values(cache.features ?? {})
    const groupedFeatures = FeatureGroups.map(({ section, key, specs, transform, map, filter, sort, order, group }) => {
      const transformedFeatures = transform === undefined ? allFeatures : transform(allFeatures)
      const filteredFeatures = filter === undefined ? transformedFeatures : transformedFeatures.filter(f => filter(f as any))
      const features = flatten(map === undefined ? filteredFeatures : filteredFeatures.map(f => map(f as any)))

      // // group by parent
      // const grouped_ = ContextManager.toContextList(
      //   features,
      //   sort === undefined ? f => parseInt(f.key.tree[0] as string) : sort, // send value to sort by
      //   order,
      // )
      // debugger

      // let grouped = {} as ReturnType<typeof ContextManager.groupBy>
      // if (groups === false) {
      //   const sortedFeatures = sort === undefined ? orderBy(features, f => parseInt(f.key.tree[0] as string), order) : orderBy(features, sort, order)
      //   grouped = {
      //     keys: [undefined as any],
      //     groups: { undefined: sortedFeatures },
      //   }
      // } else {
      //   grouped = ContextManager.groupBy(
      //     features,
      //     f => f.group as string,
      //     sort === undefined ? f => parseInt(f.key.tree[0] as string) : sort, // send value to sort by
      //     order,
      //   )
      // }

      const _sort = sort ?? (f => f.key.value)

      return { section, key, specs, sort: { fn: _sort, order }, features: ContextManager.prepareTree(features, _sort, order) }
    })

    tGroupingFeatures(`    Grouping ${allFeatures.length} Features`, [`font-weight: bold;`]) // COMMENT
    const tFeatureContextBuildingAndContainerization = logger.time(`Feature Context Building and Containerization`) // COMMENT

    sheetData.tabs.attributes.push(...this.buildAttributes())
    sheetData.tabs.defenses.push(...this.buildDefenses())

    for (const type of groupedFeatures) {
      if (Object.keys(type.features.byId).length === 0) continue
      const { byId, byDepth, byParent } = type.features

      const tabPrefix = `${type.section}-${type.key}`

      const children = contextManager.featuresToContexts(
        undefined,
        type.features,
        (feature, parent) => {
          return {
            id: `${tabPrefix}-${feature.id}`,
          }
        },
        (feature, parent) => {
          return {
            classes: [`full`],
            list: `${tabPrefix}-${parent?.id ?? `root`}`,
            ...(type.specs ?? {}),
            index: type.sort.fn(feature),
          }
        },
      )

      const root = contextManager.list({
        id: `${tabPrefix}-root`,
        classes: [`root`],
        label: undefined,
        children,
      })

      sheetData.tabs[type.key] = [root]
    }

    tFeatureContextBuildingAndContainerization(`    Feature Context Building and Containerization`, [`font-weight: bold;`]) // COMMENT
    const tPinning = logger.time(`Pinning`) // COMMENT

    // sort pinned by original GCS sheet order
    const pinned = this.actor.getFlag(`gurps`, `mobile.features.pinned`) || {}
    sheetData.pinned = Object.keys(pinned)
      .map(uuid => {
        const feature = cache.features?.[uuid]
        if (!feature) return null

        return contextManager.pinned(feature, {})
      })
      .filter(f => f !== null)
    sheetData.pinned = sortBy(sheetData.pinned, specs => specs.index)

    tPinning(`    Pinning`, [`font-weight: bold;`]) // COMMENT

    timer() // COMMENT
  }

  /**
   * Build attribute features in a dedicated function, since they are highly customizable and not well-defined inside GCS/GCA
   */
  buildAttributes(): any[] {
    const logger = LOGGER.get(`actor-sheet`)
    const cache = this.actor.cache
    const contextManager = this.actor.cache.contextManager

    if (!contextManager) return []
    if (!cache.features) return []
    // hack to not throw a error when i comment basic_speed/moves feature caching in actor
    if (!cache.features[`move-basic_speed`] && !cache.features[`move-ground`]) return []

    const children = [] as any[]
    const listId = `ooc-attributes-speed_and_move`

    if (cache.features[`move-basic_speed`]) {
      const f = cache.features[`move-basic_speed`]
      children.push(
        contextManager.feature(f, {
          classes: [`full`],
          variantClasses: [`no-icon`],
          list: listId,
        }),
      )
    }

    if (cache.features[`move-ground`]) {
      const moves = cache._moves ?? {}

      const wrapper = contextManager.wrapper({
        id: `ooc-attributes-horizontal1`,
        classes: [`full`, `horizontal`],
        index: 1,
        children: Object.values(moves).map((feature: Feature<any>) => {
          return contextManager.feature(feature, {
            classes: [`half`, `set-move-default`],
            variantClasses: [`no-icon`],
            list: listId,
          })
        }),
      })
      children.push(wrapper)
    }

    // build list
    return [contextManager.list({ id: listId, label: `Speed and Move`, children })]
  }

  /**
   * Build defense features in a dedicated function, since they are highly customizable and not well-defined inside GCS/GCA
   */
  buildDefenses(): any[] {
    const logger = LOGGER.get(`actor-sheet`)
    const cache = this.actor.cache
    const contextManager = this.actor.cache.contextManager

    if (!contextManager) return []
    if (!cache.features) return []
    // hack to not throw a error when i comment basic_speed/moves feature caching in actor
    if (!cache.features[`move-basic_speed`] && !cache.features[`move-ground`]) return []

    const specs = {
      usage: true,
      secondary: true,
      usageFilter: (usage: FeatureUsage) => {
        const defense = [`defense`].includes(usage.data.type)

        return defense
      },
    } as Partial<DefenseFeatureContextSpecs>

    const listPrefix = `combat-defenses`
    const lists = [] as IListContext[]

    const defenses = [`block`, `dodge`, `parry`] as const
    for (const defense of defenses) {
      const listId = `${listPrefix}-${defense}`

      const feature = cache.features?.[`activedefense-${defense}`] as DefenseFeature

      const children = feature.data.features.map(id => cache.features?.[id]) as GenericFeature[]
      const indexedChildren = children.map(feature => {
        const defenseUsages = (feature.data.usages ?? [])?.filter(usage => {
          const defense = [`defense`].includes(usage.data.type)

          return defense
        })

        const keys = defenseUsages?.map(usage => usageSort(usage))
        const key = max(keys)

        return [feature, key! + feature.key.value / 10]
      }) as [GenericFeature, number][]

      const orderedChildren = orderBy(indexedChildren, tuple => tuple[1])
      const contexts = [] as IContext[]
      for (const [defenseCapableFeature, index] of orderedChildren) {
        const context = contextManager.feature(defenseCapableFeature, {
          classes: [`full`],
          list: listId,
          ...cloneDeep(specs),
          index,
        })

        contexts.push(context)
      }

      lists.push(
        contextManager.list({
          id: listId,
          classes: [],
          label: defense.capitalize(),
          children: contexts,
        }),
      )
    }

    return lists
  }

  // #endregion

  openDesktopSheet() {
    this.actor.openSheet(`gurps.GurpsActorSheet`)
  }
}

function usageSort(usage: FeatureUsage) {
  // position above 10, below 11 if there is no level associated
  let level = -10.8

  if (usage.data.use && usage.data.use.rule !== `automatic`) debugger

  if (usage.data.hit) {
    if (usage.data.hit.rule === `automatic`) {
      // pass
    } else if (usage.data.hit.rule === `roll_to_hit` || usage.data.hit.rule === `roll_to_resist`) {
      const levels = usage.data.hit.levels
      level = -1 * levels?.[0]?.value ?? 1000
    }
  }

  return level
}

const FeatureGroups = [
  // combat
  {
    section: `combat`,
    key: `attacks`,
    filter: (f: GenericFeature) =>
      !f.data.placeholder &&
      f.data.usages?.length > 0 &&
      (f.type.compare(`equipment`, false) || f.data.name === `Natural Attacks`) &&
      (f.data.usages ?? []).filter((usage: FeatureUsage) => {
        const attackOrAffliction = [`attack`, `affliction`].includes(usage.data.type)

        const defense = [`defense`].includes(usage.data.type)
        const damage = intersection(usage.data.tags, [`damage`]).length > 0

        return attackOrAffliction || (damage && !defense)
      }).length > 0,
    specs: {
      usage: true,
      secondary: true,
      usageFilter: (usage: FeatureUsage) => {
        const attackOrAffliction = [`attack`, `affliction`].includes(usage.data.type)

        const defense = [`defense`].includes(usage.data.type)
        const damage = intersection(usage.data.tags, [`damage`]).length > 0

        return attackOrAffliction || (damage && !defense)
      },
    },
  },
  {
    section: `combat`,
    key: `traits`,
    filter: (f: GenericFeature) =>
      !f.data.placeholder &&
      f.data.usages?.length > 0 &&
      f.type.compare(`generic_advantage`, false) &&
      f.data.name !== `Natural Attacks` &&
      (f.data.usages ?? []).filter((usage: FeatureUsage) => {
        const defense = [`defense`].includes(usage.data.type)

        return !defense
      }).length > 0,
    specs: {
      usage: true,
      secondary: true,
      usageFilter: (usage: FeatureUsage) => {
        const defense = [`defense`].includes(usage.data.type)

        return !defense
      },
    },
    // sort: (usage: FeatureUsage) => {
    //   let value = usageSort(usage)

    //   return value + usage.key.value / 10
    // },
  },
  {
    section: `combat`,
    key: `spell_usage`,
    filter: (f: GenericFeature) =>
      !f.data.placeholder &&
      f.data.usages?.length > 0 &&
      f.type.compare(`spell`, false) &&
      (f.data.usages ?? []).filter((usage: FeatureUsage) => {
        const defense = [`defense`].includes(usage.data.type)

        return !defense
      }).length > 0,
    specs: {
      usage: true,
      secondary: true,
      usageFilter: (usage: FeatureUsage) => {
        const defense = [`defense`].includes(usage.data.type)

        return !defense
      },
    },
  },
  {
    section: `combat`,
    key: `equipment_usage`,
    filter: (f: GenericFeature) =>
      !f.data.placeholder &&
      f.data.usages?.length > 0 &&
      f.type.compare(`equipment`, false) &&
      (f.data.usages ?? []).filter((usage: FeatureUsage) => {
        const attackOrAffliction = [`attack`, `affliction`].includes(usage.data.type)

        const defense = [`defense`].includes(usage.data.type)
        const damage = intersection(usage.data.tags, [`damage`]).length > 0

        return !attackOrAffliction && !damage && !defense
      }).length > 0,
    specs: {
      usage: true,
      secondary: true,
      usageFilter: (usage: FeatureUsage) => {
        const attackOrAffliction = [`attack`, `affliction`].includes(usage.data.type)

        const defense = [`defense`].includes(usage.data.type)
        const damage = intersection(usage.data.tags, [`damage`]).length > 0

        return !attackOrAffliction && !damage && !defense
      },
    },
  },
  // ooc
  {
    section: `occ`,
    key: `advantages`,
    filter: (f: Feature<any, any>) =>
      !f.data.placeholder && f.type.compare(`generic_advantage`, false) && !f.type.compare(`spell`, false) && !someParent(f, parent => parent.data.metatrait),
  },
  {
    section: `occ`,
    key: `skills`,
    filter: (f: SkillFeature) => {
      if (f.data.placeholder) return false
      if (!f.type.compare(`skill`, true)) return false

      const actor = f.actor
      if (!actor) debugger

      const cache = actor.cache!
      if (!cache || !cache.features) debugger

      if (f.data.container) return f.data.children?.some(id => cache.features![id].data.training === `trained`)
      return f.data.training === `trained`
    },
    sort: (f: SkillFeature) => {
      if (f.data.training === `untrained`) return -1
      if (f.data.training === `unknown`) return -Infinity
      return parseInt(f.key.tree[0].toString())
    },
    // extra: SkillContextBuilder.allSkills(sheetData.actor), // COMPILE OTHER SKILLS (defaulted by attribute alone)
  },
  {
    section: `occ`,
    key: `spells`,
    filter: (f: Feature<any, any>) => !f.data.placeholder && f.type.compare(`spell`, false),
  },
  {
    section: `occ`,
    key: `equipment`,
    filter: (f: Feature<any, any>) => !f.data.placeholder && f.type.compare(`equipment`, true),
  },
]
