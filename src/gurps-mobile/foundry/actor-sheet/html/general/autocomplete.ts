import autoComplete from "@tarekraafat/autocomplete.js"
import { isArray, isNil } from "lodash"
import ContextManager from "../../context/manager"
import HTMLFeature from "../feature"
import { GurpsMobileActor } from "../../../actor/actor"
import type { GCA } from "../../../../core/gca/types"
import LOGGER from "../../../../logger"

export function createAutoComplete(id: string, source: GCA.IndexedSkill[], contextTemplate: keyof ContextManager, filter?: (entry: { value: GCA.IndexedSkill }) => boolean) {
  const autoCompleteJS = new autoComplete({
    selector: `${id} > input.input`,
    placeHolder: `Skill name`,
    threshold: 4,
    searchEngine: `loose`,
    wrapper: false,
    data: {
      src: source,
      cache: true,
      keys: [`name`],
      filter: list => {
        if (!filter) return list
        return list.filter(entry => filter(entry))
      },
    },
    resultsList: {
      class: `result`,
      destination: `${id} > input.input`,
      maxResults: 200,
      element: (list, data) => {
        if (!data.results.length) {
          // Create "No Results" message element
          const message = document.createElement(`div`)
          // Add class to the created element
          message.setAttribute(`class`, `no_result`)
          // Add message text content
          message.innerHTML = `<span>Found no results for "${data.query}"</span>`
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
        const actor = GURPS.LastAccessedActor as any as GurpsMobileActor
        if (!actor) return

        const indexedSkill = GCA.skills.index[name]
        const queriableIndex = actor.cache.query.skill[name]

        if (!queriableIndex || !queriableIndex.context || !indexedSkill || !indexedSkill.proxy) {
          if (!queriableIndex.context)
            LOGGER.get(`actor`).warn(actor.id, `Incomplete queriable skill (missing context)`, `"${name}"`, queriableIndex, [
              `color: #826835;`,
              `color: rgba(130, 104, 53, 60%); font-style: italic;`,
              `color: black; font-style: regular; font-weight: bold`,
              ``,
            ])

          if (!indexedSkill.proxy)
            LOGGER.get(`actor`).warn(`gca`, `Incomplete indexed GCS skill (missing proxy)`, `"${name}"`, queriableIndex, [
              `color: #826835;`,
              `color: rgba(130, 104, 53, 60%); font-style: italic;`,
              `color: black; font-style: regular; font-weight: bold`,
              ``,
            ])

          item.innerHTML = `<div style="padding: 9px; background-color: #ff757559; border-radius: 4.5px; color: #460000; border: 1px solid #ee8e8e;">${name}</div>`
          return
        }

        const { context } = queriableIndex
        const { proxy } = indexedSkill

        const html = Handlebars.partials[`gurps/feature`](context)
        const node = $(html)

        item.innerHTML = ``
        item.appendChild(node[0])

        HTMLFeature(node, proxy, actor).listen()
      },
    },
  })

  return autoCompleteJS
}

export function createSearchSkillsAutoComplete() {
  const id = `#search-skills-auto-complete`

  const autoCompleteJS = createAutoComplete(id, GCA.skills.list, `queryResult`)

  return autoCompleteJS
}
