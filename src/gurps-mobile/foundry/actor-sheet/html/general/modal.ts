import { uniq } from "lodash"
import { GurpsMobileActorSheet } from "../.."
import { createAutoComplete } from "./autocomplete"

export function render(sheet: GurpsMobileActorSheet, html: JQuery<HTMLElement>) {
  // BUTTONS
  html.find(`.modal > .wrapper > .header > .button.menu`).on(`click`, event => {
    $(event.currentTarget).parents(`.modal`).toggleClass(`menu`)
    $(event.currentTarget).toggleClass(`highlight`)
  })

  html.find(`.modal > .wrapper > .header > .button.close`).on(`click`, event => {
    $(event.currentTarget).parents(`.modal`).addClass(`hidden`)
  })

  html.find(`.modal > .backdrop`).on(`click`, event => {
    $(event.currentTarget).parents(`.modal`).addClass(`hidden`)
  })

  // FILTER
  html.find(`.modal > .wrapper > .section > .button-wrapper > .button, .modal > .wrapper > .section > .button-wrapper > .buttons > .button`).on(`click`, event => {
    $(event.currentTarget).toggleClass(`selected`)

    const isFilter = $(event.currentTarget).parents(`.button-wrapper`).hasClass(`filter`)
    const modal = $(event.currentTarget).parents(`.modal`)

    const selectNone = $(event.currentTarget).parents(`.button-wrapper`).data(`select-none`)
    if ($(event.currentTarget).hasClass(`selected`)) {
      if (isFilter) {
        const modalFilterId = modal.data(`filter`)
        const filter = window[`modal-filter_${modalFilterId}`] ?? []
        window[`modal-filter_${modalFilterId}`] = uniq([...filter, $(event.currentTarget).data(`value`)])
      }

      if (selectNone) $(event.currentTarget).parent().find(`> .button[data-value="${selectNone}"]`).removeClass(`selected`)
    } else {
      if (isFilter) {
        const modalFilterId = modal.data(`filter`)
        const filter = window[`modal-filter_${modalFilterId}`] ?? []
        window[`modal-filter_${modalFilterId}`] = filter.filter(item => item !== $(event.currentTarget).data(`value`))
      }

      if (selectNone) {
        const selectedOnes = $(event.currentTarget).parent().find(` > .button.selected`)
        if (selectedOnes.length === 0) {
          $(event.currentTarget).parent().find(`> .button[data-value="${selectNone}"]`).addClass(`selected`)
        }
      }
    }
  })
}
