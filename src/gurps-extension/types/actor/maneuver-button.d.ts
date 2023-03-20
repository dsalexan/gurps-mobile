// eslint-disable-next-line quotes
declare module "gurps/module/actor/maneuver-button" {
  /**
   * This class is used as a namespace for Show Art
   * static methods. It has no constructor.
   *
   * @namespace ManeuverHUDButton
   */
  export = class ManeuverHUDButton {
    static getInnerHtml(effects: ActiveEffect[]): Promise<string>

    /**
     * Retrieves the Actor associated with a given token.
     *
     * @static
     */
    static getTokenActor(token: Token): Actor | undefined

    /**
     * Create the HTML elements for the HUD button
     * including the Font Awesome icon and tooltop.
     *
     * @static
     */
    static createButton(effects: ActiveEffect[]): Promise<Element>

    /**
     * Adds the button to the Token HUD,
     * and attaches event listeners.
     *
     * @static
     */
    static prepTokenHUD(hud: TokenHUD, html: JQuery<HTMLElement>, token: Token): Promise<void>
  }
}
