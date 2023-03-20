/* eslint-disable jsdoc/require-jsdoc */
// item.addEventListener("mousedown", pressingDown, false);
// item.addEventListener("mouseup", notPressingDown, false);
// item.addEventListener("mouseleave", notPressingDown, false);

import { isNil, range } from "lodash"

// item.addEventListener("touchstart", pressingDown, false);
// item.addEventListener("touchend", notPressingDown, false);

// // Listening for our custom pressHold event
// item.addEventListener("pressHold", doSomething, false);

export const EVEND_ON_HOLD = new CustomEvent(`hold`)
export const EVEND_ON_HOLD_START = new CustomEvent(`holdstart`)

export interface HoldOptions {
  ignore: string[] | null
  pressHoldDuration: number
  boostrapDuration: number
  scrollThreshold: number
}

export default function Hold(
  html: JQuery<HTMLElement>,
  { ignore, pressHoldDuration = 35, boostrapDuration = 20, scrollThreshold = 20 }: Partial<HoldOptions> = {
    ignore: null,
    pressHoldDuration: 35,
    boostrapDuration: 20,
    scrollThreshold: 20,
  },
) {
  html.each((index, item) => {
    function pressingDown(event: MouseEvent | TouchEvent) {
      if (!$(item).data(`hold-touchstart`, event)) $(item).data(`hold-skip-click`, false)

      if (ignore && ignore.some(_ignore => item.matches(_ignore))) return notPressingDown(event)

      // Start the timer
      requestAnimationFrame(timer)

      event.preventDefault()

      $(item).data(`hold-skip-click`, true)

      $(item).data(`hold-cancel`, false)
      $(item).data(`hold-touchstart`, false)

      item.classList.add(`hold-pressing-down`)
      item.dispatchEvent(EVEND_ON_HOLD_START)
    }

    function notPressingDown(event: MouseEvent | TouchEvent) {
      const timerID = $(item).data(`hold-timer-id`)

      // Stop the timer
      cancelAnimationFrame(timerID)

      $(item).data(`hold-cancel`, true)
      $(item).data(`hold-counter`, 0)

      item.style.setProperty(`--hold-value`, 0)
      item.classList.remove(`hold-pressing-down`)

      const touchstartEvent = $(item).data(`hold-touchstart`)
      if (touchstartEvent) $(item).parents(`.hold-scroll-wrapper`).css(`overflow`, ``)
    }

    /**
     * Runs at 60fps when you are pressing down
     */
    function timer() {
      if ($(item).data(`hold-cancel`)) return

      const touchstartEvent = $(item).data(`hold-touchstart`)
      let counter = $(item).data(`hold-counter`) as number
      let _counter = counter

      if (touchstartEvent) {
        _counter -= boostrapDuration

        if (_counter >= 0 && !item.classList.contains(`hold-pressing-down`)) {
          item.classList.add(`hold-pressing-down`)
          item.dispatchEvent(EVEND_ON_HOLD_START)
        }
      }

      if (_counter < pressHoldDuration) {
        const timerID = requestAnimationFrame(timer)

        $(item).data(`hold-timer-id`, timerID)
        $(item).data(`hold-counter`, ++counter)

        if (_counter >= 0) {
          item.style.setProperty(`--hold-value`, (counter / pressHoldDuration).toString())
        }
      } else {
        if (touchstartEvent) $(item).parents(`.hold-scroll-wrapper`).css(`overflow`, `hidden`)

        item.classList.remove(`hold-pressing-down`)
        item.dispatchEvent(EVEND_ON_HOLD)
      }
    }

    function cancel(event: MouseEvent | TouchEvent) {
      notPressingDown(event)
    }

    $(item).data(`hold-cancel`, cancel)
    $(item).data(`hold-counter`, 0)

    item.addEventListener(`mousedown`, pressingDown, false)
    item.addEventListener(`mouseup`, notPressingDown, false)
    item.addEventListener(`mouseleave`, notPressingDown, false)

    function touchStart(event: TouchEvent) {
      if (!event.currentTarget) return

      $(event.currentTarget).data(`hold-skip-click`, false)

      if (ignore && ignore.some(_ignore => item.matches(_ignore))) return notPressingDown(event)

      const _touches = event.touches
      const touches = range(0, _touches.length)
        .map(index => _touches.item(index))
        .filter(item => !isNil(item))
        .map((item: Touch) => [item.clientX, item.clientY])

      $(item).data(`hold-skip-click`, true)
      $(item).data(`hold-cancel`, false)
      $(item).data(`hold-touch-start`, touches)
      $(item).data(`hold-touchstart`, event)

      // Start the timer
      requestAnimationFrame(timer)
    }

    function touchMove(event: TouchEvent) {
      if (!$(item).data(`hold-counter`)) return

      const start = ($(item).data(`hold-touch-start`) ?? []) as number[][]

      const _touches = event.touches
      const touches = range(0, _touches.length)
        .map(index => _touches.item(index))
        .filter(item => !isNil(item))
        .map((item: Touch) => [item.clientX, item.clientY])

      const deltas = start.map((touch, index) => [touch[0] - touches[index][0], touch[1] - touches[index][1]])
      const offset = deltas.map(delta => Math.sqrt(delta[0] ** 2 + delta[1] ** 2))

      // TODO: Implement for multiple touches?

      if (offset[0] >= scrollThreshold) cancel(event)
    }

    item.addEventListener(`touchstart`, touchStart, false)
    item.addEventListener(`touchmove`, touchMove, false)
    item.addEventListener(`touchend`, notPressingDown, false)
    item.addEventListener(`touchcancel`, notPressingDown, false)
  })
}
