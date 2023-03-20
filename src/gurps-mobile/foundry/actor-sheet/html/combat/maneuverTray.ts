import { waitForElementVisible } from "december/utils/delay"
import Hold from "december/utils/hold"

import { GurpsMobileActorSheet } from "../.."

/**
 *
 */
export function render(sheet: GurpsMobileActorSheet, html: JQuery<HTMLElement>) {
  // UI
  const maneuversScroll = sheet.ui.combat.maneuvers.scroll
  if (maneuversScroll) $(`.combat > .maneuvers`).scrollLeft(maneuversScroll)

  // BUTTONS
  Hold(html.find(`.combat > .maneuvers .maneuver-button`), { ignore: [`.holding`, `:not(.selectable)`] })

  html.find(`.combat > .maneuvers`).on(`scroll`, event => {
    // reset floating select
    html.find(`.maneuver-select`).addClass(`hidden`)

    html.find(`.combat > .maneuvers .maneuver-button.holding`).removeClass(`holding`) // toggle class
  })

  //    NON-SELECTABLE MANEUVERS
  //      activate
  html.find(`.combat > .maneuvers .maneuver-button`).on(`click`, event => {
    if ($(event.currentTarget).hasClass(`selectable`)) return

    const id = $(event.currentTarget).data(`id`)
    toggleManeuverActive(html, id)
  })
  // html.find(`.combat > .maneuvers .maneuver-button`).on(`touchstart`, event => {
  //   if ($(event.currentTarget).hasClass(`selectable`)) return

  //   $(event.currentTarget).data(`allow-touch-end`, true)
  // })
  // html.find(`.combat > .maneuvers .maneuver-button`).on(`touchstart`, event => {
  //   if ($(event.currentTarget).hasClass(`selectable`)) return
  //   if (!$(event.currentTarget).data(`allow-touch-end`)) return

  //   $(event.currentTarget).data(`allow-touch-end`, false)

  //   const id = $(event.currentTarget).data(`id`)
  //   toggleManeuverActive(html, id)
  // })

  //    SELECTABLE MANEUVERS
  //      hold start, to reset holding in tray and cancel holding in selected maneuver
  html.find(`.combat > .maneuvers .maneuver-button`).on(`holdstart`, event => {
    if (!$(event.currentTarget).hasClass(`selectable`)) return
    if ($(event.currentTarget).hasClass(`holding`)) return

    html.find(`.maneuver-select`).addClass(`hidden`) // reset floating select
    $(event.currentTarget).parents(`.maneuvers`).find(`.maneuver-button.holding`).removeClass(`holding`) // reset holding
  })

  //      hold, to update overlay
  html.find(`.combat > .maneuvers .maneuver-button`).on(`hold`, event => {
    if (!$(event.currentTarget).hasClass(`selectable`)) return
    if ($(event.currentTarget).hasClass(`holding`)) return

    // reset floating select
    const floating = html.find(`.maneuver-select`)
    floating.addClass(`hidden`)

    $(event.currentTarget).toggleClass(`holding`) // toggle class

    const isHolding = $(event.currentTarget).hasClass(`holding`)
    const isSelected = $(event.currentTarget).hasClass(`selected`)

    // ONLY show floating select IF maneuver is not selected
    if (isHolding && !isSelected) {
      const app = $(event.currentTarget).parents(`.app.window-app.sheet`)
      const appTop = app.offset().top
      const appLeft = app.offset().left

      const box = event.currentTarget.getBoundingClientRect()

      floating.removeClass(`hidden`)

      floating.css(`left`, `calc(${box.x}px - ${appLeft}px + ${box.width}px / 2)`)
      floating.css(`top`, `calc(${box.top}px - ${appTop}px + ${box.height}px)`)
    }
  })
  document.addEventListener(`click`, function (event) {
    const maneuverButton = html.find(`.combat > .maneuvers .maneuver-button.holding`)
    if (maneuverButton.length === 0) return

    const inside = $(event.target).closest(maneuverButton).length > 0
    if (!inside) {
      // CLICK OUTSIDE

      // reset floating select
      html.find(`.maneuver-select`).addClass(`hidden`)

      maneuverButton.removeClass(`holding`) // toggle class
    }
  })

  //      click on overlay to open maneuver view
  html.find(`.combat > .maneuvers .maneuver-button > .overlay`).on(`click`, event => {
    if ($(event.currentTarget).parent().data(`hold-skip-click`)) return

    $(event.currentTarget).parent().get(0).style.setProperty(`--hold-value`, 0)
    $(event.currentTarget).parent().removeClass(`holding`)
    html.find(`.maneuver-select`).addClass(`hidden`)

    // const maneuver = $(event.currentTarget).parent().data(`value`)
    // sheet.ui.combat.maneuvers.scroll = $(`.combat > .maneuvers`).scrollLeft()
    // sheet.actor.replaceManeuver(maneuver)

    alert(`// TODO: Open maneuver view`)
  })

  //      click on floating button to select maneuver
  html.find(`.combat > .maneuver-select`).on(`click`, event => {
    const maneuverButton = html.find(`.combat > .maneuvers .maneuver-button.holding`)

    // reset stuff
    maneuverButton.get(0).style.setProperty(`--hold-value`, 0)
    maneuverButton.removeClass(`holding`)
    html.find(`.maneuver-select`).addClass(`hidden`)

    const maneuver = maneuverButton.data(`value`)
    sheet.ui.combat.maneuvers.scroll = $(`.combat > .maneuvers`).scrollLeft()
    sheet.actor.replaceManeuver(maneuver)
  })
}

/**
 *
 */
export function updateLastManeuver(html: JQuery<HTMLElement>, value: any) {
  const maneuvers = html.find(`.combat > .maneuvers`)

  maneuvers.find(`.maneuver-button.last`).removeClass(`last`)
  maneuvers.find(`.maneuver-button[data-value="${value}"]`).addClass(`last`)

  maneuvers.find(`.maneuver-button .circles > i.last`).removeClass(`last`)
  maneuvers.find(`.maneuver-button .circles > i[data-value="${value}"]`).addClass(`last`)
}

/**
 *
 */
export function updateManeuver(html: JQuery<HTMLElement>, value: any) {
  const maneuvers = html.find(`.combat > .maneuvers`)

  const current = maneuvers.find(`.maneuver-button.selected`)
  if (current.data(`value`) !== value) {
    current.removeClass(`selected`)
    maneuvers.find(`.maneuver-button[data-value="${value}"]`).addClass(`selected`)

    maneuvers.find(`.maneuver-button.highlighted`).removeClass(`highlighted`)
    maneuvers.find(`.maneuver-button .circles > i[data-value="${value}"]`).parents(`.maneuver-button`).addClass(`highlighted`)

    maneuvers.find(`.maneuver-button .circles > i.selected`).removeClass(`selected`)
    maneuvers.find(`.maneuver-button .circles > i[data-value="${value}"]`).addClass(`selected`)
  }
}

/**
 *
 */
export function toggleManeuverActive(html: JQuery<HTMLElement>, id: string) {
  // reset active
  const currentlyActive = html.find(`.combat > .maneuvers .maneuver-button.active`)
  if (currentlyActive.length && id !== currentlyActive.data(`id`)) toggleManeuverActive(html, currentlyActive.data(`id`))

  const item = html.find(`.combat > .maneuvers .maneuver-button[data-id="${id}"]`)

  // reset holding in tray
  item.parents(`.maneuvers`).find(`.maneuver-button.holding`).removeClass(`holding`)
  html.find(`.maneuver-select`).addClass(`hidden`)

  item.toggleClass(`active`)

  const isActive = item.hasClass(`active`)

  const parentLevel = item.parents(`.maneuver-level`)
  const level = parseInt(parentLevel.data(`level`))

  const nextLevel = parentLevel.siblings(`.maneuver-level[data-level="${level + 1}"]`)
  const children = nextLevel.children(`.maneuver-group[data-parent="${id}"]`)

  if (children.length > 0) {
    if (isActive) {
      nextLevel.addClass(`expanded`)
      children.addClass(`expanded`)

      const parentPadding = item.children(`.maneuver`).css(`padding-right`)
      const parentLeft = item.offset().left
      const parentWidth = item.width() + 3.5 * 2 // TODO: automate border value

      const parentLevelWidth = parentLevel.width()

      children.each((index, _child) => {
        _child.style.marginLeft = `${0}px`
        _child.style.setProperty(`--parent-width`, `calc(${parentWidth}px)`)
        if (item.parent().parent().hasClass(`no-label`)) _child.style.setProperty(`--parent-offset`, `1`)
        waitForElementVisible(_child).then(({ element, box }) => {
          let marginLeft = parentLeft - box.left - box.width / 2 + parentWidth / 2

          const capLeftOffset = marginLeft >= 0 ? 0 : -marginLeft
          const capRightOffset = marginLeft + box.width <= parentLevelWidth ? 0 : parentLevelWidth - (marginLeft + box.width)

          let anchor = `center`
          if (capRightOffset !== 0) {
            anchor = `right`
          } else if (capLeftOffset !== 0) {
            anchor = `left`
          }

          element.classList.remove(`anchor-center`)
          element.classList.remove(`anchor-left`)
          element.classList.remove(`anchor-right`)
          element.classList.add(`anchor-${anchor}`)

          element.style.marginLeft = `calc(${capLeftOffset}px + ${marginLeft}px + ${capRightOffset}px)`
          // element.style.setProperty(`--anchor-padding`, `calc((${parentWidth}px - ${parentPadding}) / 2)`)
        })
      })
    } else {
      nextLevel.removeClass(`expanded`)
      children.removeClass(`expanded`)
    }
  }
}
