/* eslint-disable jsdoc/require-jsdoc */
import autoComplete from "@tarekraafat/autocomplete.js"
import { isArray } from "lodash"

import { GurpsMobileActorSheet } from "../.."

import HTMLFeature from "../feature"
import { GurpsMobileActor } from "../../../actor/actor"
import ContextManager from "../../context/manager"

export function render(sheet: GurpsMobileActorSheet, html: JQuery<HTMLElement>) {
  // Feature Box
  html.find(`.feature-list > .label`).on(`click`, ev => {
    const parent = $(ev.currentTarget).parent()
    parent.toggleClass(`expanded`)

    const listID = parent.data(`id`)
    const isExpanded = parent.hasClass(`expanded`)
    sheet.actor.setLocalStorage(`${listID}.expanded`, isExpanded)
  })

  html.find(`.feature-list > .header > .button.display-hidden`).on(`click`, ev => {
    if ($(ev.currentTarget).hasClass(`disabled`)) return
    const parent = $(ev.currentTarget).parents(`.feature-list`)
    parent.toggleClass(`display-hidden`)

    const listID = parent.data(`id`)
    const isHiddenDisplayed = parent.hasClass(`display-hidden`)
    sheet.actor.setLocalStorage(`${listID}.displayHidden`, isHiddenDisplayed)
  })

  html.find(`.feature-list > .header > .button.hide-all`).on(`click`, ev => {
    if ($(ev.currentTarget).hasClass(`disabled`)) return
    const parent = $(ev.currentTarget).parents(`.feature-list`)

    const listID = parent.data(`id`)
    const features = parent.find(`.feature:not(.hidden)`)
    const ids = features.toArray().map(f => $(f).data(`id`))
    sheet.actor.update(Object.fromEntries(ids.map(id => [`flags.gurps.${`mobile.features.hidden`}.${id}.${listID}`, true])))
  })

  html.find(`.feature-list > .header > .button.show-all`).on(`click`, ev => {
    if ($(ev.currentTarget).hasClass(`disabled`)) return
    const parent = $(ev.currentTarget).parents(`.feature-list`)

    const listID = parent.data(`id`)
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

  // All Skills
  html.find(`.content.ooc > .panels > .panel[data-value="skill"] > .header > .button`).on(`click`, ev => {
    if ($(ev.currentTarget).hasClass(`disabled`)) return

    html.find(`.modal.skills`).removeClass(`hidden`)
  })

  const autoCompleteJS = new autoComplete({
    selector: `#skill-auto-complete > input.input`,
    placeHolder: `Skill name`,
    threshold: 4,
    searchEngine: `loose`,
    wrapper: false,
    data: {
      src: GCA.allSkills.list,
      cache: true,
      keys: [`name`],
    },
    resultsList: {
      class: `result`,
      destination: `#skill-auto-complete > input.input`,
      maxResults: 200,
      element: (list, data) => {
        if (!data.results.length) {
          // Create "No Results" message element
          const message = document.createElement(`div`)
          // Add class to the created element
          message.setAttribute(`class`, `no_result`)
          // Add message text content
          message.innerHTML = `<span>Found No Results for "${data.query}"</span>`
          // Append message element to the results list
          list.prepend(message)
        }
      },
      noResults: true,
    },
    resultItem: {
      // highlight: true,
      tag: `li`,
      class: `result-item`,
      element: (item, { key, match, value: { ignoreSpecialization, name, skill, specializations, _specializations } }) => {
        const actor = GURPS.LastAccessedActor

        const _feature = actor.cache.query.skill[name]
        if (!_feature) {
          item.innerHTML = `<div style="padding: 9px; background-color: #ff757559; border-radius: 4.5px; color: #460000; border: 1px solid #ee8e8e;">${name}</div>`
          return
        }

        if (isArray(_feature) && _feature.length !== 1) debugger

        const contextManager = actor.cache.contextManager as ContextManager
        const feature = isArray(_feature) ? _feature[0] : _feature

        const context = contextManager.queryResult(feature, {
          classes: [`full`],
          list: `#skill-auto-complete`,
          // difficulty: false,
          // showDefaults: true,

          //   hidden: actor.getFlag(`gurps`, `mobile.features.hidden.${feature.id}.${`skill-auto-complete`}`) ?? true,

          // feature: IFeature
          // list: string
          // //
          // hidden: (id: string) => boolean
          // pinned: (id: string) => boolean
          // collapsed: (id: string) => boolean
          // //
          // index?: number
          // innerClasses?: string[]
          // actions?: false | { left: FeatureDataVariantActionSpecs; right: FeatureDataVariantActionSpecs }
        })

        const html = Handlebars.partials[`gurps/feature`](context)
        const node = $(html)

        item.innerHTML = ``
        item.appendChild(node[0])

        HTMLFeature(node, feature).listen()
      },
    },
  })

  // Floating Buttons
  // pin
  html.find(`.floating-wrapper > .floating.pin`).on(`click`, event => {
    if (!$(event.currentTarget).hasClass(`active`)) return

    html.find(`.modal.pin`).removeClass(`hidden`)
  })

  // MODAL
  html.find(`.modal > .wrapper > .header > .button.close`).on(`click`, event => {
    $(event.currentTarget).parents(`.modal`).addClass(`hidden`)
  })

  html.find(`.modal > .backdrop`).on(`click`, event => {
    $(event.currentTarget).parents(`.modal`).addClass(`hidden`)
  })
}
