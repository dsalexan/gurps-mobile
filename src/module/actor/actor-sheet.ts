import { GurpsActorSheet } from "lib/gurps/actor/actor-sheet"

import { MobileSheet } from "app"
import react from "lib/react"
import { ReactComponentSheet } from "lib/react/ReactComponentSheet"

/**
 * Extend the basic GurpsActorSheet with mobile adaptations
 * @extends {GurpsActorSheet}
 */
export class MobileGurpsActorSheet extends GurpsActorSheet implements ReactComponentSheet {
  _reactDOM_rendered = false

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: [`mobile`, `gurps`, `sheet`, `actor`],
      resizable: false,
      width: `100vw`,
      height: `100vh`,
      // tabs: [{ navSelector: `.gurps-sheet-tabs`, contentSelector: `.sheet-body`, initial: `description` }],
      // scrollY: [`.gurpsactorsheet #advantages #reactions #melee #ranged #skills #spells #equipmentcarried #equipmentother #notes`],
      // dragDrop: [{ dragSelector: `.item-list .item`, dropSelector: null }],
    })
  }

  /* -------------------------------------------- */

  /** @override */
  get template() {
    return `modules/gurps-mobile/templates/actor/mobile-actor-sheet.hbs`
  }

  // Hack to keep sheet from flashing during multiple DB updates
  async _render(...args: any[]) {
    await super._render(...args)

    if (!this._reactDOM_rendered) {
      console.log(`RENDER TEMPLATE HANDLEBAR SHIT`)

      react(MobileSheet, { name: `bob` })
      this._reactDOM_rendered = true
    }
  }
}
