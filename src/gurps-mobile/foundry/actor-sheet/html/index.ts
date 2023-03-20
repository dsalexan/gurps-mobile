import { GurpsMobileActorSheet } from ".."

import * as Header from "./header"
import * as Combat from "./combat"
import * as OutOfCombat from "./ooc"

import * as General from "./general"

export default class HTMLManager {
  sheet: GurpsMobileActorSheet

  get actor() {
    return this.sheet.actor
  }

  get Combat() {
    return Combat
  }

  get OutOfCombat() {
    return OutOfCombat
  }

  constructor(sheet: GurpsMobileActorSheet) {
    this.sheet = sheet
  }

  activateListeners(html: JQuery<HTMLElement>) {
    Header.render(this.sheet, html)
    Combat.render(this.sheet, html)
    OutOfCombat.render(this.sheet, html)

    General.render(this.sheet, html)
  }
}
