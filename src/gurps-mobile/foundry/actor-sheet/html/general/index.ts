/* eslint-disable jsdoc/require-jsdoc */

import { GurpsMobileActorSheet } from "../.."

import * as modal from "./modal"

import HTMLFeature from "../feature"
import { createAutoComplete } from "./autocomplete"
import { GurpsMobileActor } from "../../../actor/actor"

export function render(sheet: GurpsMobileActorSheet, html: JQuery<HTMLElement>) {
  // Feature Box
  html.find(`.feature-list > .label`).on(`click`, ev => {
    const parent = $(ev.currentTarget).parent()
    parent.toggleClass(`expanded`)

    const listID = parent.data(`list`)
    const isExpanded = parent.hasClass(`expanded`)
    sheet.actor.setLocalStorage(`${listID}.expanded`, isExpanded)

    console.warn(`DONE`)
  })

  html.find(`.feature-list > .header > .button.display-hidden`).on(`click`, ev => {
    if ($(ev.currentTarget).hasClass(`disabled`)) return
    const parent = $(ev.currentTarget).parents(`.feature-list`)
    parent.toggleClass(`display-hidden`)

    const listID = parent.data(`list`)
    const isHiddenDisplayed = parent.hasClass(`display-hidden`)
    sheet.actor.setLocalStorage(`${listID}.displayHidden`, isHiddenDisplayed)
  })

  html.find(`.feature-list > .header > .button.hide-all`).on(`click`, ev => {
    if ($(ev.currentTarget).hasClass(`disabled`)) return
    const parent = $(ev.currentTarget).parents(`.feature-list`)

    const listID = parent.data(`list`)
    const features = parent.find(`.feature:not(.hidden)`)
    const ids = features.toArray().map(f => $(f).data(`id`))
    sheet.actor.update(Object.fromEntries(ids.map(id => [`flags.gurps.${`mobile.features.hidden`}.${id}.${listID}`, true])))
  })

  html.find(`.feature-list > .header > .button.show-all`).on(`click`, ev => {
    if ($(ev.currentTarget).hasClass(`disabled`)) return
    const parent = $(ev.currentTarget).parents(`.feature-list`)

    const listID = parent.data(`list`)
    const features = parent.find(`.feature.hidden`)
    const ids = features.toArray().map(f => $(f).data(`id`))
    sheet.actor.update(Object.fromEntries(ids.map(id => [`flags.gurps.${`mobile.features.hidden`}.${id}.${listID}`, false])))
  })

  // Feature
  // GenericFeatureNode.attachEvents(html.find(`.feature`), sheet.actor)
  const features = sheet.actor.cache.features
  for (const id in features) {
    const feature = features[id]

    HTMLFeature(html.find(`.feature[data-id="${id}"]`), feature).listen()
  }

  // Modals
  // Search Skills
  html.find(`.content.ooc > .panels > .panel[data-value="skill"] > .header > .button[data-value="search-skills"]`).on(`click`, ev => {
    if ($(ev.currentTarget).hasClass(`disabled`)) return

    html.find(`.modal.search-skills`).removeClass(`hidden`)
  })

  modal.render(sheet, html)

  const id = `#search-skills-auto-complete`
  const autoCompleteJS = createAutoComplete(id, GCA.allSkills.list, `queryResult`, (entry: GCA.IndexedSkill) => {
    const actor = GURPS.LastAccessedActor as any as GurpsMobileActor

    const skillTrainingTags = window[`modal-filter_${`search-skills`}`] ?? []

    const { name } = entry.value

    const trained = skillTrainingTags.includes(`trained`) && actor.cache.query.skill[name].training === `trained`
    const untrained = skillTrainingTags.includes(`untrained`) && actor.cache.query.skill[name].training === `untrained`
    const unknown = skillTrainingTags.includes(`unknown`) && actor.cache.query.skill[name].training === `unknown`

    return trained || untrained || unknown
  })

  // Floating Buttons
  // pin
  html.find(`.floating-wrapper > .floating.pin`).on(`click`, event => {
    if (!$(event.currentTarget).hasClass(`active`)) return

    html.find(`.modal.pin`).removeClass(`hidden`)
  })
}
