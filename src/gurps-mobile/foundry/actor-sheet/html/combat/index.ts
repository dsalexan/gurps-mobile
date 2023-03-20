import tab from "december/utils/tab"

import * as ManeuverTray from "./maneuverTray"
import { GurpsMobileActorSheet } from "../.."

/**
 *
 */
export function render(sheet: GurpsMobileActorSheet, html: JQuery<HTMLElement>) {
  tab(html, `.combat`, newValue => sheet.actor.setLocalStorage(`combat.selectedTab`, newValue))

  html.find(`.combat > .status-tray > .chevron i.icon`).on(`click`, function (event) {
    html.find(`.combat > .status-tray`).toggleClass(`expanded`)
  })

  ManeuverTray.render(sheet, html)
}

export * as ManeuverTray from "./maneuverTray"
