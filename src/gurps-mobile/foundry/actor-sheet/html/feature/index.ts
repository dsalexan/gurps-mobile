/* eslint-disable no-debugger */
import { v4 as uuidv4 } from "uuid"

import { easeOutCubic } from "../../../../../december/utils/easings"
import LOGGER from "../../../../logger"
import { GurpsMobileActor } from "../../../actor/actor"
import Feature from "../../../actor/feature"
import GenericFeature from "../../../actor/feature/generic"
import { FeatureState, setMoveDefault } from "../../../../core/feature/utils"
import { isNilOrEmpty } from "../../../../../december/utils/lodash"

export interface IHTMLFeature {
  listen(): void
  //
  click(event: any): void
  //
  mark(value: string): void
  label(value: string): void
  value(value: string): void
  //
  updateHidden(value: boolean): void
  updatePinned(value: boolean): void
  updateExpanded(dataId: string, value: boolean): void
  updateRoller(value: boolean): void
  //
  updateMove(): void
}

/**
 *
 */
export default function HTMLFeature(node: JQuery<HTMLElement>, feature: GenericFeature, actor: GurpsMobileActor): IHTMLFeature {
  const htmlElements = node.toArray().map(element => HTMLFeatureElement(element, feature, actor))

  return {
    listen(...args: any[]) {
      // @ts-ignore
      htmlElements.map(html => html.listen(...args))
    },
    //
    click(...args: any[]) {
      // @ts-ignore
      htmlElements.map(html => html.listen(...args))
    },
    //
    mark(...args: any[]) {
      // @ts-ignore
      htmlElements.map(html => html.mark(...args))
    },
    label(...args: any[]) {
      // @ts-ignore
      htmlElements.map(html => html.label(...args))
    },
    value(...args: any[]) {
      // @ts-ignore
      htmlElements.map(html => html.value(...args))
    },
    //
    updateHidden(...args: any[]) {
      // @ts-ignore
      htmlElements.map(html => html.updateHidden(...args))
    },
    updatePinned(...args: any[]) {
      // @ts-ignore
      htmlElements.map(html => html.updatePinned(...args))
    },
    updateExpanded(...args: any[]) {
      // @ts-ignore
      htmlElements.map(html => html.updateExpanded(...args))
    },
    updateRoller(...args: any[]) {
      // @ts-ignore
      htmlElements.map(html => html.updateRoller(...args))
    },
    //
    updateMove(...args: any[]) {
      // @ts-ignore
      htmlElements.map(html => html.updateMove(...args))
    },
  }
}

/**
 *
 */
export function HTMLFeatureElement(element: HTMLElement, feature: GenericFeature, actor: GurpsMobileActor): IHTMLFeature {
  const html = $(`#MobileGurpsActorSheet-Actor-${actor.id} > section.window-content`)

  const node = $(element)
  const variant = node.find(`.feature-variant:first-of-type`)

  function listen() {
    // click
    $(element).on(`click`, event => click(event))

    // scroll trigger for those without snapping
    $(element)
      .find(`> .children > .feature-data`)
      .on(`touchend`, event => {
        if (!event.currentTarget.classList.contains(`do-swipe-left`)) return
        event.currentTarget.classList.remove(`do-swipe-left`)

        const listID = $(event.currentTarget).closest(`.feature-list`).data(`list`)
        feature.hide(actor, listID)
      })

    $(element)
      .find(`> .children > .feature-data`)
      .on(`mouseup`, event => {
        if (!event.currentTarget.classList.contains(`do-swipe-left`)) return
        event.currentTarget.classList.remove(`do-swipe-left`)

        const listID = $(event.currentTarget).closest(`.feature-list`).data(`list`)
        feature.hide(actor, listID)
      })

    // gradual action opacity + scroll trigger (for those without snapping)
    $(element)
      .find(`> .children > .feature-data`)
      .on(`scroll`, event => {
        let actionWidth = 9 * 9 + 9 * 1 //  .feature > .children > .feature-data.has-swipe [--action-width] mais ou menos isso na verdade
        let targetDistance = actionWidth

        const distance = event.currentTarget.scrollLeft

        // 0 -> 0%
        // X -> 100%
        // d / X
        let f = distance / targetDistance

        // alternative factor for when there is a LEFT action
        if (!event.currentTarget.classList.contains(`no-left`)) {
          // 0 -> 100%
          // X -> 0%
          // X -> 0 %
          // X * 2 -> 100%;
          // |d - X| / X
          f = Math.abs(distance - targetDistance) / targetDistance

          if (distance === 0) event.currentTarget.classList.add(`do-swipe-left`)
          else event.currentTarget.classList.remove(`do-swipe-left`)

          if (distance === 2 * targetDistance) event.currentTarget.classList.add(`do-swipe-right`)
          else event.currentTarget.classList.remove(`do-swipe-right`)
        } else {
          if (distance === 1 * targetDistance) event.currentTarget.classList.add(`do-swipe-right`)
          else event.currentTarget.classList.remove(`do-swipe-right`)
        }

        $(event.currentTarget)
          .find(`> .action`)
          .css(`opacity`, Math.min(easeOutCubic(f), 1))
      })

    // gradual variant chevron shit
    $(element)
      .find(`> .children > .feature-data > .children`)
      .on(`scroll`, event => {
        const distance = event.currentTarget.scrollLeft
        const width = event.currentTarget.getBoundingClientRect().width

        const e = 1

        if (distance <= e || distance >= width - e) {
          $(event.currentTarget).parent().removeClass(`scrolling`)

          // const index = Math.floor(distance / width)
          // const previous = $(event.currentTarget).find(`> .feature-variant.active`)
          // const active = $(event.currentTarget).find(`> .feature-variant:nth-of-type(${index})`)
          // console.log(`scrolled to`, index, previous, `->`, active)
        } else $(event.currentTarget).parent().addClass(`scrolling`)
      })

    // expand/collapse feature variant
    $(element)
      .find(`> .children > .feature-data > .children > .feature-variant > .wrapper > .content > .expand`)
      .on(`click`, event => {
        const target = $(event.currentTarget)
        const data = target.closest(`.feature-data`)
        const dataId = data.data(`id`)

        feature.expand(actor, dataId)
        if (data.hasClass(`expanded`)) data.removeClass(`expanded`)
        else data.addClass(`expanded`)
      })

    // roll scroll
    $(element)
      .find(`> .children > .feature-data > .children > .feature-variant > .wrapper > .content > .rolls > .wrapper`)
      .on(`scroll`, event => {
        const target = $(event.currentTarget)
        const rolls = target.closest(`.rolls`)

        const distance = event.currentTarget.scrollLeft
        const width = event.currentTarget.getBoundingClientRect().width

        const child = Math.floor(distance / width)
        const step = parseInt(rolls.find(`> .wrapper > .roll:nth-of-type(${child + 1})`).data(`step`))

        const current = parseInt(rolls.data(`selected`))
        if (current !== step) {
          rolls.data(`selected`, step)

          // update chevrons
          if (child === 0) rolls.addClass(`at-first`)
          else rolls.removeClass(`at-first`)

          if (child === rolls.find(`> .wrapper > .roll`).length - 1) rolls.addClass(`at-last`)
          else rolls.removeClass(`at-last`)

          // update roll elsewhere (value, stats)
          const variant = target.closest(`.feature-variant`)
          variant.find(`.roll-selected`).removeClass(`roll-selected`)
          variant.find(`[data-roll-step="${step}"]`).addClass(`roll-selected`)

          console.log(`gurps-mobile`, `update roll step`, step, variant)
        }

        console.log(`gurps-mobile`, `scrolling`, `#${step}`, distance, `w:`, width, event)
      })

    // swipe clicks
    $(element)
      .find(`.feature-data > .action .target`)
      .on(`click`, event => {
        event.preventDefault()
        const target = $(event.currentTarget)

        if (target.hasClass(`action-hide`)) {
          const listID = $(event.currentTarget).closest(`.feature-list`).data(`list`)
          feature.hide(actor, listID)
          target.closest(`.feature`).addClass(`cancel-post-swipe-click`)
          target.closest(`.feature-data`).scrollLeft(0)
        }

        if (target.hasClass(`action-pin`)) {
          feature.pin(actor)
          target.closest(`.feature`).addClass(`cancel-post-swipe-click`)
          target.closest(`.feature-data`).scrollLeft(0)
        }

        if (target.hasClass(`action-roller`)) {
          const target = $(event.currentTarget)
          const listID = $(event.currentTarget).closest(`.feature-list`).data(`list`)

          feature.roller(actor, listID)
          target.closest(`.feature`).addClass(`cancel-post-swipe-click`)
          target.closest(`.feature-data`).scrollLeft(0)
        }
      })
  }

  // #region Event Handlers

  function click(event: any) {
    const node = $(event.currentTarget)

    console.debug(`gurps-mobile`, `feature`, `click`, node.data(`id`))

    // cancel event if swipe is open
    if (node.hasClass(`cancel-post-swipe-click`)) {
      node.removeClass(`cancel-post-swipe-click`)
      return
    }

    if (node.hasClass(`hidden`)) {
      const listID = $(event.currentTarget).closest(`.feature-list`).data(`list`)
      feature.hide(actor, listID)
      return
    }

    if (node.hasClass(`set-move-default`)) setMoveDefault(feature)
  }

  // #endregion

  // #region Setters

  function mark(value: boolean | string) {
    if (!value) variant.removeClass(`marked`)
    else {
      variant.addClass(`marked`)
      variant.find(`> .mark > div`).html(value === true ? `<Unnamed mark>` : value)
    }
  }

  function label(value: string) {
    variant.find(`.label > .main > span`).html(game.i18n.localize(value))
  }

  function value(_value: string) {
    variant.find(`.value > .display > .value`).html(_value)
  }

  // #endregion

  // #region Core

  function updateHidden(value: boolean) {
    // assign hidden class state
    if (value) node.addClass(`hidden`)
    else node.removeClass(`hidden`)

    const index = node.data(`index`)

    // select future parent based on current hidden state
    let parent: JQuery<HTMLElement>
    if (value) {
      const list = node.parent().parent()

      // ERROR: Should be a feature list
      if (!list.is(`.feature-list`)) debugger

      parent = list.find(`> .children > div.collapsed-list`)
    } else {
      const list = node.parent().parent().parent()

      // ERROR: Should be a feature list
      if (!list.is(`.feature-list`)) debugger

      const wrapper = node.data(`wrapper`)
      if (!isNilOrEmpty(wrapper)) parent = list.find(`> .children > .feature-wrapper[data-id="${wrapper}"] > .children`)
      else parent = list.find(`> .children`)
    }

    if (parent === null || parent.length === 0) return LOGGER.error(`Cannot ${!value ? `hide` : `show`} feature outside a FeatureList or FeatureWrapper`, node)

    // append feature at correct index
    let prepended = false
    for (const sibling of parent.find(`> div[data-index]`).toArray()) {
      if ($(sibling).data(`index`) > index) {
        prepended = true
        $(sibling).before(node)
        break
      }
    }
    if (!prepended) parent.append(node)
  }

  function updatePinned(value: boolean) {
    // update pin container and change class
    if (!value) {
      // change style to unpinned
      node.removeClass(`pinned`)
      node.find(`> .children > .feature-data:first-of-type .action div.target.action-pin > i`).removeClass(`mdi-pin-off`).addClass(`mdi-pin`)

      // remove from pin container
      const pinnedFeature = html.find(`.modal.pin > .wrapper > .children > .feature[data-id="${feature.id}"]`)
      pinnedFeature.remove()

      // if pin container is empty, make it dull
      if (html.find(`.modal.pin  > .wrapper > .children`).children().length === 0) {
        html.find(`.modal.pin`).addClass(`hidden`)
        html.find(`.floating-wrapper > .floating.pin`).removeClass(`active`)
      }
    } else {
      // change node style to pinned
      node.addClass(`pinned`)
      node.find(`> .children > .feature-data:first-of-type .action div.target.action-pin > i`).removeClass(`mdi-pin`).addClass(`mdi-pin-off`)

      // clone node
      const clone = node.filter(`:not(.alternative)`).clone()
      clone.data(`context`, uuidv4())
      clone.data(`index`, feature.key.value ?? -1)
      HTMLFeature(clone, feature, actor).listen()

      // ignore classes in clone
      clone.removeClass(`pinned`).removeClass(`collapsed`).removeClass(`hidden`)

      // remove from action.right collapse
      clone.find(`> .children > .feature-data:first-of-type .action.right div.target.action-collapse`).remove()
      clone.find(`> .children > .feature-data:first-of-type .action.right div.divider`).remove()

      // remove from action.left hide
      clone.find(`> .children > .feature-data:first-of-type .action.right div.target.action-hide`).remove()
      clone.find(`> .children > .feature-data:first-of-type .action.right div.divider`).remove()

      // append feature at correct index
      const parent = html.find(`.modal.pin  > .wrapper > .children`)

      const index = clone.data(`index`)
      let prepended = false
      for (const sibling of parent.find(`> div[data-index]`).toArray()) {
        if ($(sibling).data(`index`) > index) {
          prepended = true
          $(sibling).before(clone)
          break
        }
      }
      if (!prepended) parent.append(clone)

      html.find(`.floating-wrapper > .floating.pin`).addClass(`active`)
    }
  }

  function updateExpanded(dataId: string, value: boolean) {
    const data = node.find(`.feature-data[data-id="${dataId}"]`)

    if (value) data.addClass(`expanded`)
    else data.removeClass(`expanded`)
  }

  function updateRoller(value: boolean) {
    const data = node.find(`.feature-data`)

    // assign roller class state to datas
    if (value) data.addClass(`roller`)
    else data.removeClass(`roller`)
  }

  // #endregion

  // #region Specialized Methods
  //          Methods that should be in a specialized class, but i couldnt be bothered to create one yet

  function updateMove() {
    if (feature.data.state & FeatureState.HIGHLIGHTED) mark(`Ruler`)
    else mark(false)
    value((feature.data.value ?? `?`).toString())
    label(feature.data.name)
  }

  // #endregion

  return {
    listen,
    //
    click,
    //
    mark,
    label,
    value,
    //
    updateHidden,
    updatePinned,
    updateExpanded,
    updateRoller,
    //
    updateMove,
  }
}
