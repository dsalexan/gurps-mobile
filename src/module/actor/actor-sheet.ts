import { GurpsActorSheet } from "../../lib/gurps/actor/actor-sheet"

/**
 * Extend the basic GurpsActorSheet with mobile adaptations
 * @extends {GurpsActorSheet}
 */
export class MobileGurpsActorSheet extends GurpsActorSheet {
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

    console.log(`RENDER TEMPLATE HANDLEBAR SHIT`)
  }
}
