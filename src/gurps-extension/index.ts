import { set, get } from "local-storage"
import GURPSIcons from "./icons.mjs"

import Logger from "december/utils/logger"

import ExtendManeuvers from "./maneuvers"

const MODULE_ID = `gurps-extension`

const LOGGER = Logger.get(MODULE_ID)

/**
 * A abstract class wrapping all Mobile hook callbacks, methods and helpers
 */
export default class GurpsExtension {
  static HOST_MODULE_ID: string

  // #region DOM

  static onLoad(hostModuleID: string) {
    if (hostModuleID === undefined) throw new Error(`[${MODULE_ID}] GurpsExtension needs a host module to attach itself (HOST_MODULE_ID is empty)`)
    GurpsExtension.HOST_MODULE_ID = hostModuleID
  }

  // #endregion

  // #region FOUNDRY

  static onInit() {
    // here is executed AFTER onGurpsInit, so it wouldnt be much of a initialization
    //    since "gurps" run before "gurps-mobile", which is just interestings
  }

  static onReady() {
    const LastAcessedActorId = get<string>(`GURPS.LastAccessedActor`)
    GURPS.LastAccessedActor = game.actors?.find(actor => actor.id === LastAcessedActorId) || null
    if (GURPS.LastAccessedActor) Hooks.call(`gurps:set-last-accessed-actor`, GURPS.LastAccessedActor)
  }

  // #endregion

  // #region GURPS

  static onGurpsInit() {
    GurpsExtension.extend()
  }

  // #endregion

  // #region METHODS

  static remap() {
    if (GURPS.__remaped_functions === undefined) {
      const fns = {} as Record<string, (...args: any[]) => any>

      fns[`SetLastActor`] = GURPS.SetLastActor
      GURPS.SetLastActor = function (actor: Actor, tokenDocument: Token) {
        // console.trace(`SETTING LAST ACTOR RENDER???`, actor, tokenDocument)
        fns[`SetLastActor`](actor, tokenDocument)
        Hooks.call(`gurps:set-last-actor`, actor, tokenDocument)

        GURPS.LastAccessedActor = actor
        set(`GURPS.LastAccessedActor`, actor.id)
        Hooks.call(`gurps:set-last-accessed-actor`, actor, tokenDocument)
      }

      GURPS.__remaped_functions = fns
    } else {
      throw new Error(`GURPS already had its functions remaped`)
    }
  }

  static extend() {
    LOGGER.info(`Extending GURPS module...`)

    GURPS.ICONS = GURPSIcons as Record<string, string>
    GURPS._cache = {}

    if (GurpsExtension.HOST_MODULE_ID === undefined) throw new Error(`[${MODULE_ID}] GurpsExtension needs a host module to attach itself (HOST_MODULE_ID is empty)`)
    else ExtendManeuvers(GurpsExtension.HOST_MODULE_ID)

    GurpsExtension.remap()
  }

  // #endregion
}
