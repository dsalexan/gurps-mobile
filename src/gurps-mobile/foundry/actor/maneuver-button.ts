import { MODULE_ID } from "config"
import GURPSManeuverHUDButton from "gurps/module/actor/maneuver-button"

export default class ManeuverHUDButton extends GURPSManeuverHUDButton {
  static existentButton: Element | null

  static async getInnerHtml(effects: ActiveEffect[]) {
    return await renderTemplate(`modules/${MODULE_ID}/templates/maneuver-hud.hbs`, {
      maneuvers: GURPS.Maneuvers.getAllData(),
      effects,
    })
  }

  /**
   * Create the HTML elements for the HUD button
   * including the Font Awesome icon and tooltop.
   *
   * @static
   */
  static async createButton(effects: ActiveEffect[]) {
    if (ManeuverHUDButton.existentButton === null) ManeuverHUDButton.existentButton = await super.createButton(effects)
    else ManeuverHUDButton.existentButton.innerHTML = await ManeuverHUDButton.getInnerHtml(effects)

    return ManeuverHUDButton.existentButton
  }

  /**
   * Removes original GURPS Aid Maneuver HUD
   *
   * @static
   */
  static async replaceOriginalGURPSHUD(hud: TokenHUD, html: JQuery, token: Token) {
    if (!hud.object?.combatant) return

    const parent = html.find(`div.right`)[0]

    // Create a new observer instance:
    const observer = new MutationObserver(function () {
      const button = parent.querySelector(`div.maneuver-open[data-action="maneuver"]`)
      if (button) {
        observer.disconnect()

        ManeuverHUDButton.existentButton = button
        ManeuverHUDButton.prepTokenHUD(hud, html, token).then(() => (ManeuverHUDButton.existentButton = null))
      }
    })

    // Start the observer
    observer.observe(parent, { childList: true })
  }
}
