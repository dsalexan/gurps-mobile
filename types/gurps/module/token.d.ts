import type { ActiveEffectDataConstructorData } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/data.mjs/activeEffectData"

declare global {
  class GurpsToken extends Token {
    static ready(): void
    /**
     * @param {GurpsToken} token
     * @param {any} _data
     * @param {any} _options
     * @param {any} _userId
     */
    static _createToken(token: GurpsToken, _data: any, _options: any, _userId: any): Promise<void>
    /**
     * This is a decorator on the standard drawEffects method, that sets the maneuver icons based
     * on level of detail and player visibility.
     * @override
     */
    override drawEffects(): Promise<any>
    /**
     * @override
     * @param {*} effect
     * @param {*} options
     */
    override toggleEffect(effect: string | ActiveEffectDataConstructorData | undefined, options?: Token.EffectToggleOptions | undefined): Promise<boolean>
    setEffectActive(name: any, active: any): Promise<void>
    /**
     * We use this function because maneuvers are special Active Effects: maneuvers don't apply
     * outside of combat, and only one maneuver can be active simultaneously. So we really don't
     * deactivate the old maneuver and then activate the new one -- we simply update the singleton
     * maneuver data to match the new maneuver's data.
     *
     * @param {string} maneuverName
     */
    setManeuver(maneuverName: string): Promise<void>
    /**
     * Assumes that this token is not in combat any more -- if so, updating the manuever will only
     * update the actor's data model, and not add/update the active effect that represents that
     * Maneuver.
     */
    removeManeuver(): Promise<void>
    /**
     * @param {ActiveEffect} effect
     */
    // eslint-disable-next-line @typescript-eslint/ban-types
    _toggleManeuverActiveEffect(effect: any, options?: {}): Promise<void>
    /**
     * Size and display the Token Icon
     *
     * FIXME This is a horrible hack to fix Foundry's scaling of figures in a hex grid. By default, Foundry
     *       scales tokens to fit the width of the grid if the "aspect" of the token is equal to or greater
     *       than 1, where aspect is width/height. For Hex Columns, the width is measured from vertex to vertex;
     *       for Hex Rows, the width is measured flat-side to flat-side. This results in tokens overflowing
     *       a Hex Column, taking up space in adjacent hexes. This "fixes" that for a subset of tokens -- where
     *       the token has an aspect of 1, we scale the token based on the smaller of the two dimensions.
     */
    _refreshIcon(): any
  }
}
