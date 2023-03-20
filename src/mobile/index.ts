import { Logger } from "december/utils"
import { I, i18n } from "december/foundry"
import { getSetting, registerSettings } from "december/foundry/settings"

import { SETTINGS, SETTINGS_DEFINITIONS } from "./settings"

const MODULE_ID = `mobile`

export const LOGGER = Logger.get(MODULE_ID)

/**
 *
 */
export function fixHeight() {
  // https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
  document.documentElement.style.setProperty(`--vh`, `${Math.min(window.innerHeight, window.outerHeight) * 0.01}px`)
}

/**
 * A abstract class wrapping all Mobile hook callbacks, methods and helpers
 */
export default class Mobile {
  static active = false
  static HOST_MODULE_ID: string

  static isAllowed() {
    if (Mobile.HOST_MODULE_ID === undefined) throw new Error(`[${MODULE_ID}] Mobile needs a host module to attach settings (HOST_MODULE_ID is empty)`)
    return game.settings.get(Mobile.HOST_MODULE_ID, SETTINGS.ALLOW_MOBILE_MODE)
  }

  static isScreenMobile() {
    const media = window.matchMedia(`only screen and (max-width: 760px)`).matches
    const touch = `ontouchstart` in document.documentElement && navigator.userAgent.match(/Mobi/)
    const agentPlataform = /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent) || /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.platform)

    return !!agentPlataform || (!!media && !!touch)
  }

  // #region DOM

  static onLoad(hostModuleID: string) {
    if (hostModuleID === undefined) throw new Error(`[${MODULE_ID}] Mobile needs a host module to attach settings (HOST_MODULE_ID is empty)`)
    Mobile.HOST_MODULE_ID = hostModuleID

    document.addEventListener(`fullscreenchange`, () => setTimeout(Mobile.onResize, 100))
    window.addEventListener(`resize`, Mobile.onResize)
    window.addEventListener(`scroll`, Mobile.onResize)

    this.onResize()
  }

  static onResize(this: void) {
    if (!Mobile.isScreenMobile()) return
    if (Mobile.active) fixHeight()
  }

  // #endregion

  // #region FOUNDRY

  static onInit() {
    LOGGER.info(`Initializing...`)

    // Assign custom classes and constants here

    // Register custom module settings
    Mobile.registerSettings()

    // Preload Handlebars templates

    // Define custom Entity classes

    // Register custom sheets (if any)
  }

  static onReady() {
    if (!Mobile.isScreenMobile()) return LOGGER.info(`Skipping Mobile wrapping (screen > mobile)`)
    if (!Mobile.isAllowed()) return LOGGER.info(`Mobile wrapping not allowed on settings`)

    LOGGER.info(`Initializing Mobile...`)
    Mobile.enter()
  }

  static onCanvasInit() {
    if (!Mobile.isScreenMobile()) return

    if (Mobile.active) Mobile.enter()
    else Mobile.leave()
  }

  static onRenderSceneNavigation() {
    if (Mobile.active) {
      ui.nav?.collapse()
      LOGGER.info(`Mobile collapsing nav`)
    }
  }

  static onRenderNotifications(app) {
    if (!app.queue.__isProxy) {
      app.queue = new Proxy(app.queue, {
        get: function (target, key) {
          if (key === `__isProxy`) return true

          if (key === `push`) {
            return (...arg) => {
              if (Hooks.call(`queuedNotification`, ...arg)) {
                target.push(...arg)
              }
            }
          }
          return target[key]
        },
      })
    }
  }

  static onQueuedNotification(notification) {
    if (typeof notification.message === `string`) {
      const regex = /\s.+px/g
      const message = notification.message?.replace(regex, ``)

      const lowResolution = i18n(`translations.ERROR.LowResolution`) as string
      const match = lowResolution.replace(regex, ``)

      if (message === match) {
        LOGGER.info(`Mobile suppresing notification`, notification)
        return false
      }
    }
  }

  static onSettingChanged(this: void, active: boolean) {
    if (active) {
      if (Mobile.active) return
      // if (!Mobile.isScreenMobile()) return ui.notifications?.info(I(`ERROR.TryingToEnableMobileModeOnNonMobile`))
    } else {
      if (!Mobile.active) return
    }

    LOGGER.info(`Mobile status changed`, active)

    if (active) Mobile.enter()
    else Mobile.leave()
  }

  // #endregion

  // #region METHODS

  //    #region GENERAL

  static registerSettings() {
    if (Mobile.HOST_MODULE_ID === undefined) throw new Error(`[${MODULE_ID}] Mobile needs a host module to attach settings (HOST_MODULE_ID is empty)`)

    registerSettings(Mobile.HOST_MODULE_ID, [SETTINGS_DEFINITIONS.ALLOW_MOBILE_MODE], {
      [SETTINGS.ALLOW_MOBILE_MODE]: Mobile.onSettingChanged,
    })
  }

  static enter() {
    if (!Mobile.isAllowed()) return
    Mobile.active = true

    document.body.classList.add(`mobile`)

    ui.nav?.collapse()
    fixHeight()

    Mobile.removeCanvas()

    Hooks.call(`mobile-wrapper:enter`)
  }

  static leave() {
    Mobile.active = false

    document.body.classList.remove(`mobile`)

    if (!Mobile.canvasExists()) window.location.reload()

    Hooks.call(`mobile-wrapper:leave`)
  }

  //    #endregion

  //    #region CANVAS

  static removeCanvas() {
    const node = document.getElementById(`board`)
    if (node && node.parentNode) node.parentNode.removeChild(node)
  }

  static canvasExists() {
    return !!document.getElementById(`board`)
  }

  //    #endregion

  // #endregion
}
