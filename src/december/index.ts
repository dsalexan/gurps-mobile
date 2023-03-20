import { Toolbox } from "./toolbox"

export * as Foundry from "./foundry"
export * as Utils from "./utils"

import { getActor } from "./foundry/actor"
import { isNilOrEmpty } from "./utils/lodash"
import { Logger } from "./utils"
import { TemplatePreloader } from "./foundry/handlebars"

const MODULE_ID = `december`

const LOGGER = Logger.get(MODULE_ID)

export class December {
  static HOST_MODULE_ID: string

  toolbox: Toolbox

  constructor(toolbox: boolean) {
    this.toolbox = (toolbox ? new Toolbox() : null) as Toolbox
  }

  get hasToolbox() {
    return !!this.toolbox
  }

  // #region DOM

  onLoad(hostModuleID: string) {
    if (hostModuleID === undefined) throw new Error(`[${MODULE_ID}] Mobile needs a host module to attach settings (HOST_MODULE_ID is empty)`)
    December.HOST_MODULE_ID = hostModuleID

    if (this.hasToolbox) this.toolbox.onLoad()
  }

  // #endregion

  // #region FOUNDRY

  onInit() {
    LOGGER.info(`Initializing...`)

    // Assign custom classes and constants here

    // Register custom module settings

    // Preload Handlebars templates
    TemplatePreloader.preloadHandlebarsHelpers()
    TemplatePreloader.preloadHandlebarsTemplates()

    if (this.hasToolbox) this.toolbox.onInit()
  }

  onReady() {
    if (this.hasToolbox) this.toolbox.onReady()
  }

  // onRenderActorSheet(_actorSheet: Application, _html: JQuery<HTMLElement>, _data: object) {
  //   // pass
  // }

  // #endregion

  // #region API

  openTab(name: string) {
    const node = $(`#sidebar a.item[data-tab=${name}]`)[0]
    if (node) node.click()
    else throw new Error(`Tab named "${name}" doesn't exists`)
  }

  openActor(actor: string, key = `id`) {
    const actorId = getActor(actor, key)

    if (actorId !== undefined) {
      const node = $(`#actors .directory-item.actor[data-document-id=${actorId}] .document-name`)[0]
      if (node) {
        node.click()
        return
      }
    }

    throw new Error(`Actor with ${key} = "${actor}" doesn't exist`)
  }

  clickHeaderWindow(button: string, selector = ``) {
    const node = $(`${selector}.window-app header a.${button}`)[0]
    if (node) node.click()
    else {
      throw new Error(`Window (.window-app) ${isNilOrEmpty(selector) ? `` : `"${selector}"`}doesn't exist`)
    }
  }

  closeWindow(selector = ``) {
    this.clickHeaderWindow(`close`, selector)
  }

  // #endregion
}
