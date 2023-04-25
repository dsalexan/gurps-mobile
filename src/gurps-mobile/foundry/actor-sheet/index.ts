import LOGGER from "logger"
import { MODULE_ID } from "config"

import { GurpsActorSheet } from "gurps/module/actor/actor-sheet"
import { GurpsMobileActor } from "../actor/actor"

import createManeuverTray, { Tray } from "./maneuverTray"

import { flatten, flattenDeep, get, groupBy, isBoolean, isNil, last, orderBy, set, sortBy, uniq, unzip } from "lodash"
import { getStatus } from "./status"
import HTMLManager from "./html"
import ContextManager from "./context/manager"
import { Datachanges } from "../../../december/utils"
import HTMLFeature from "./html/feature"
import Feature from "../actor/feature"
import SkillFeature from "../actor/feature/skill"

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

    if (force) logger.warn(`[${this.actor.id}]`, `_render${force ? ` (force)` : ``}`, [`font-weight: bold;`])
    logger
      .group(true)
      .info(`[${this.actor.id}]`, `_render${force ? ` (force)` : ``}`, `user:${context?.userId ?? `unknown`}`, [
        `font-weight: regular;`,
        ``,
        `color: rgba(197, 25, 22, ${context?.userId ? `1` : `0.5`}); font-style: italic;`,
      ])
    logger.info(`    `, `context:`, context, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `state:`, (this as any)._state, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `element:`, (this as any).element, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `_element:`, (this as any)._element, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
    logger.info(`    `, `datachanges:`, datachanges, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])

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

    const do_hide = datachanges.has(`flags.gurps.mobile.features.hidden`)
    const do_pin = datachanges.has(`flags.gurps.mobile.features.pinned`)
    const do_collapse = datachanges.has(`flags.gurps.mobile.features.collapsed`)

    const do_moves = datachanges?.has(/system\.move\.\d+$/i)

    const conditionals = { do_lastManeuver, do_maneuver, do_hide, do_pin, do_collapse, do_moves }
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
      // hide
      if (do_hide) {
        const features = datachanges.get(/flags\.gurps\.mobile\.features\.hidden\.[^\.]+/)

        const grouped = { true: [] as [string, string][], false: [] as [string, string][] }
        for (const key of features) {
          const change = get(datachanges.changes, key)
          if (!isBoolean(change)) continue

          const [id, listId] = key.split(`.`).slice(-2)
          grouped[change.toString()].push([id, listId])
        }

        let lists = [] as string[]
        for (const hidden of [`true`, `false`]) {
          if (!grouped[hidden] || grouped[hidden].length === 0) continue

          // const [ids, lists] = unzip(grouped[hidden])
          for (const [id, listId] of grouped[hidden]) {
            const list = html.find(`.feature-list[data-list="${listId}"]`)

            const feature = this.actor.cache.features?.[id]
            const node = list.find(`.feature[data-id="${id}"]:not(.ignore-hidden)`)

            if (feature) {
              HTMLFeature(node, feature).updateHidden(hidden === `true`)
              lists.push(...listId)
            }
          }
        }

        // update hide/show-all and alikes
        lists = uniq(lists)
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
      }

      // pin
      if (do_pin) {
        const features = datachanges.get(`flags.gurps.mobile.features.pinned`)

        for (const key of features) {
          const [pinned, id] = datachanges.getState(key)

          const feature = this.actor.cache.features?.[id]
          const node = html.find(`.feature[data-id="${id}"]:not(.ignore-pinned)`)

          if (feature) HTMLFeature(node, feature).updatePinned(pinned as boolean)
        }
      }

      // collapse
      if (do_collapse) {
        const features = datachanges.get(`flags.gurps.mobile.features.collapsed`)

        for (const key of features) {
          const [collapsed, id] = datachanges.getState(key)

          const feature = this.actor.cache.features?.[id]
          const node = html.find(`.feature[data-id="${id}"]:not(.ignore-collapsed)`)

          if (feature) HTMLFeature(node, feature).updateCollapsed(collapsed as boolean)
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

          if (feature) HTMLFeature(node, feature).updateMove()
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
    sheetData.tags = [`defense`, `spell`, `equipment`]

    sheetData.oocTab = this.actor.getLocalStorage(`ooc.selectedTab`, `attribute`)

    timer(`Headers and Shit`, [`font-weight: bold;`]) // COMMENT
  }

  injectFeatures(sheetData: Data, options?: Partial<Options>) {
    if (options?.noContext) return console.info(`Skipping Inject Features (No Context Generation)`, [`font-style: italic;`])

    const logger = LOGGER.get(`actor-sheet`)
    const cache = this.actor.cache

    // Preparing tabs
    sheetData.tabs = {
      attacks: [],
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
    const groupedFeatures = FeatureGroups.map(({ section, key, specs, transform, map, filter, sort, order, groups }) => {
      const transformedFeatures = transform === undefined ? allFeatures : transform(allFeatures)
      const mappedFeatures = flatten(map === undefined ? transformedFeatures : transformedFeatures.map(f => map(f as any)))
      const features = filter === undefined ? mappedFeatures : mappedFeatures.filter(f => filter(f as any))

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

      return { section, key, specs, features: ContextManager.prepareTree(features, sort === undefined ? f => parseInt(f.key.value as string) : sort, order) }
    })

    tGroupingFeatures(`    Grouping ${allFeatures.length} Features`, [`font-weight: bold;`]) // COMMENT
    const tFeatureContextBuildingAndContainerization = logger.time(`Feature Context Building and Containerization`) // COMMENT

    sheetData.tabs.attributes.push(...this.buildAttributes())
    // sheetData.tabs.defenses.push(...this.buildDefenses())

    for (const type of groupedFeatures) {
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

      // sheetData.tabs[type.key] = flattenDeep(
      //   type.features.keys.map((key, index) => {
      //     const listId = `${type.section}-${type.key}-${key}${index}`

      //     return contextManager.list({
      //       id: listId,
      //       label: key === `undefined` ? undefined : key,
      //       children: type.features.groups[key]
      //         .map(feature => {
      //           const context = contextManager.feature(feature, {
      //             classes: [`full`],
      //             list: listId,
      //             ...(type.specs ?? {}),
      //           })

      //           return context
      //         })
      //         .filter(c => !isNil(c)),
      //     })
      //   }),
      // )
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
            list: listId,
          })
        }),
      })
      children.push(wrapper)
    }

    // build list
    return [contextManager.list({ id: listId, label: `Speed and Move`, children })]
  }

  buildDefenses() {
    const logger = LOGGER.get(`actor-sheet`)
    const cache = this.actor.cache
    const contextManager = this.actor.cache.contextManager

    if (!contextManager) return []
    if (!cache.features) return []

    const listId = `combat-defenses-active`
    const children = [] as any[]

    const activeDefenses = [`block`, `dodge`, `parry`]
    for (const activeDefense of activeDefenses) {
      const id = `activedefense-${activeDefense}`

      const defense = cache.features[id]
      if (!defense) continue

      children.push(
        contextManager.feature(defense, {
          classes: [`full`],
          list: listId,
        }),
      )
    }

    // build list
    return [contextManager.list({ id: listId, label: undefined, children })]
  }
  // #endregion

  openDesktopSheet() {
    this.actor.openSheet(`gurps.GurpsActorSheet`)
  }
}

const FeatureGroups = [
  // combat
  // {
  //   section: `combat`,
  //   key: `attacks`,
  //   map: (f: GenericFeature) => f.weapons ?? [],
  //   sort: (f: WeaponFeature) => f.calcLevel()?.level ?? Infinity,
  //   order: `desc`,
  //   groups: false,
  // },
  // ooc
  {
    section: `occ`,
    key: `advantages`,
    filter: (f: Feature<any, any>) => f.type.compare(`generic_advantage`, false),
  },
  {
    section: `occ`,
    key: `skills`,
    filter: (f: SkillFeature) => {
      if (!f.type.compare(`skill`, true)) return false
      if (f.data.container) return f.children.some(c => c.data.training === `trained`)
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
    filter: (f: Feature<any, any>) => f.type.compare(`spell`, true),
  },
  {
    section: `occ`,
    key: `equipment`,
    filter: (f: Feature<any, any>) => f.type.compare(`equipment`, true),
  },
]
