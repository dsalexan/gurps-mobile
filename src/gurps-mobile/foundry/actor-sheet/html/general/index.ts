import { GurpsMobileActorSheet } from "../.."

import * as modal from "./modal"

import HTMLFeature from "../feature"
import { createAutoComplete } from "./autocomplete"
import { GurpsMobileActor } from "../../../actor/actor"
import type { GCA } from "../../../../core/gca/types"

export function render(sheet: GurpsMobileActorSheet, html: JQuery<HTMLElement>) {
  // Feature Box
  html.find(`.feature-list > .label`).on(`click`, ev => {
    const parent = $(ev.currentTarget).parent()
    parent.toggleClass(`expanded`)

    const listID = parent.data(`list`)
    const isExpanded = parent.hasClass(`expanded`)
    sheet.actor.setLocalStorage(`${listID}.expanded`, isExpanded)
  })

  html.find(`.feature-list > .header > .button.display-hidden`).on(`click`, ev => {
    if ($(ev.currentTarget).hasClass(`disabled`)) return
    const list = $(ev.currentTarget).closest(`.feature-list`)

    list.toggleClass(`display-hidden`)

    const listID = list.data(`list`)
    const isHiddenDisplayed = list.hasClass(`display-hidden`)
    sheet.actor.setLocalStorage(`${listID}.displayHidden`, isHiddenDisplayed)
  })

  html.find(`.feature-list > .header > .button.hide-all`).on(`click`, ev => {
    if ($(ev.currentTarget).hasClass(`disabled`)) return
    const list = $(ev.currentTarget).closest(`.feature-list`)

    const listID = list.data(`list`)
    const features = list.find(`> .children > .feature:not(.hidden)`)
    const ids = features.toArray().map(f => $(f).data(`id`))
    sheet.actor.update(Object.fromEntries(ids.map(id => [`flags.gurps.${`mobile.features.hidden`}.${id}.${listID}`, true])))
  })

  html.find(`.feature-list > .header > .button.show-all`).on(`click`, ev => {
    if ($(ev.currentTarget).hasClass(`disabled`)) return
    const list = $(ev.currentTarget).closest(`.feature-list`)

    const listID = list.data(`list`)
    const features = list.find(`> .children > .collapsed-list > .feature.hidden`)
    const ids = features.toArray().map(f => $(f).data(`id`))
    sheet.actor.update(Object.fromEntries(ids.map(id => [`flags.gurps.${`mobile.features.hidden`}.${id}.${listID}`, false])))
  })

  // Feature
  // GenericFeatureNode.attachEvents(html.find(`.feature`), sheet.actor)
  const features = sheet.actor.cache.features
  for (const id in features) {
    const feature = features[id]

    // ERROR: Cannot read actor of feature, why??
    if (feature.actor === undefined) debugger

    HTMLFeature(html.find(`.feature[data-id="${id}"]`), feature, feature.actor).listen()
  }

  // Wrapper
  // SHOW
  html.find(`.content > .panels > .panel > .header > .button.wrapper`).on(`click`, ev => {
    if ($(ev.currentTarget).hasClass(`disabled`)) return

    const id = $(ev.currentTarget).data(`value`)
    $(ev.currentTarget).toggleClass(`active`)
    html.find(`.wrapper.${id}:not(.button)`).toggleClass(`hidden`)
  })

  // Modals
  // Render all modals
  modal.render(sheet, html)

  // Search Skills
  const id = `#search-skills-auto-complete`
  const autoCompleteJS = createAutoComplete(id, GCA.skills.list, `queryResult`, (entry: { value: GCA.IndexedSkill }) => {
    const actor = GURPS.LastAccessedActor as any as GurpsMobileActor

    const skillTrainingTags = window[`modal-filter_search-skills`] ?? []

    const { name } = entry.value
    const { features } = actor.cache.query.skill[name]

    const trained = skillTrainingTags.includes(`trained`) && features.some(feature => feature.data.training === `trained`)
    const untrained = skillTrainingTags.includes(`untrained`) && features.some(feature => feature.data.training === `untrained`)
    const unknown = skillTrainingTags.includes(`unknown`) && features.every(feature => feature.data.training !== `trained` && feature.data.training !== `untrained`)

    return trained || untrained || unknown
  })

  // Floating Buttons
  // pin
  html.find(`.floating-wrapper > .floating.pin`).on(`click`, event => {
    if (!$(event.currentTarget).hasClass(`active`)) return

    html.find(`.modal.pin`).removeClass(`hidden`)
  })
}
