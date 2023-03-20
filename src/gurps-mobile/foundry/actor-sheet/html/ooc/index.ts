/* eslint-disable jsdoc/require-jsdoc */
import interact from "interactjs"

import tab from "december/utils/tab"

import { GurpsMobileActorSheet } from "../.."

export function render(sheet: GurpsMobileActorSheet, html: JQuery<HTMLElement>) {
  const MINIMUM_DY = 50

  function float() {
    if (html.find(`.ooc`).hasClass(`floating`)) return
    sheet.actor.update({ "flags.gurps.mobile.oocClass": `floating`, "flags.gurps.mobile.combatClass": `` })

    html.find(`.ooc`).addClass(`floating`)
    html.find(`.combat`).removeClass(`collapsed`)
  }

  function expand() {
    if (!html.find(`.ooc`).hasClass(`floating`)) return
    sheet.actor.update({ "flags.gurps.mobile.oocClass": ``, "flags.gurps.mobile.combatClass": `collapsed` })

    html.find(`.ooc`).removeClass(`floating`)
    html.find(`.combat`).addClass(`collapsed`)
  }

  // UI
  tab(html, `.ooc`, newValue => sheet.actor.setLocalStorage(`ooc.selectedTab`, newValue))

  html.find(`.ooc > .holder`).on(`click`, () => float())
  html.find(`.ooc`).on(`click`, handler => {
    if ($(handler.target).is(`.holder`)) return
    expand()
  })

  // interact(html.find(`.ooc > .holder`)[0]).draggable({
  //   lockAxis: `y`,
  //   listeners: {
  //     move(event) {
  //       // console.log(`gurps-mobile`, `MOVE DRAG ON OOC`, event.clientY - event.y0, event)
  //       const dy = event.clientY - event.y0
  //       if (dy >= MINIMUM_DY) float()
  //     },
  //     end(event) {
  //       const dy = event.clientY - event.y0
  //       if (dy >= MINIMUM_DY) float()
  //     },
  //   },
  // })

  // interact(html.find(`.ooc > .label`)[0]).draggable({
  //   lockAxis: `y`,
  //   listeners: {
  //     move(event) {
  //       console.log(`gurps-mobile`, `MOVE DRAG ON OOC`, event.clientY - event.y0, event)
  //       const dy = event.clientY - event.y0
  //       if (-dy >= 7) expand()
  //     },
  //     end(event) {
  //       const dy = event.clientY - event.y0
  //       if (-dy >= 7) expand()
  //     },
  //   },
  // })
}
