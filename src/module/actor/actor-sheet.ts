import { GurpsActorSheet } from "../../../types/gurps/module/actor/actor-sheet"

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
}
