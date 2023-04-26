import LOGGER from "logger"

import GCAManager from "./core/gca"
import { TemplatePreloader } from "./foundry/handlebars"
import GurpsMobileToken from "./foundry/token"

import { ManeuverHUDButton, GurpsMobileActor } from "./foundry/actor"
import { GurpsMobileActorSheet } from "./foundry/actor-sheet"
import FeatureFactory from "./core/feature/factory"

export default class GurpsMobile {
  // #region DOM

  static onLoad() {
    window.FeatureFactory = new FeatureFactory()
    window.GCA = new GCAManager()
    GurpsMobileToken.onLoad()
  }

  // #endregion

  // #region FOUNDRY
  static onInit() {
    LOGGER.info(`Initializing...`)

    // Assign custom classes and constants here

    // Register custom module settings

    // Preload Handlebars templates
    TemplatePreloader.preloadHandlebarsHelpers()

    // Define custom Entity classes
    // @ts-ignore
    CONFIG.Actor.documentClass = GurpsMobileActor

    // Register Sheet Classes
    // @ts-ignore
    Actors.registerSheet(`gurps`, GurpsMobileActorSheet, {
      // Add this sheet last
      label: `Mobile`,
      makeDefault: false,
    })
  }

  // eslint-disable-next-line no-undef
  static onRenderTokenHUD(hud: TokenHUD<ApplicationOptions>, html: JQuery<HTMLElement>, token: Token) {
    ManeuverHUDButton.replaceOriginalGURPSHUD(hud, html, token)
  }
  // #endregion

  // #region 3RD PARTY
  // #endregion

  // #region METHODS
  // #endregion
}
