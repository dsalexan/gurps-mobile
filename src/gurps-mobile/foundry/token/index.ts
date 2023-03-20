import { isNil } from "lodash"

export default class GurpsMobileToken extends GURPS.GurpsToken {
  // actor: GurpsMobileActor

  static onLoad() {
    Hooks.once(`init`, function () {
      CONFIG.Token.objectClass = GurpsMobileToken
    })
  }

  /**
   * We use this function because maneuvers are special Active Effects: maneuvers don't apply
   * outside of combat, and only one maneuver can be active simultaneously. So we really don't
   * deactivate the old maneuver and then activate the new one -- we simply update the singleton
   * maneuver data to match the new maneuver's data.
   *
   * @param maneuverName
   */
  async setManeuver(maneuverName: string) {
    if (this.actor !== null) {
      // if not in combat, do nothing
      if (game.combats && game.combats.active) {
        const maneuvers = GURPS.Maneuvers.getActiveEffectManeuvers(this.actor?.temporaryEffects)
        const maneuver = maneuvers[0]
        if (maneuver) {
          // save current maneuver as last maneuver
          this.actor.setFlag(`gurps`, `mobile.lastManeuver`, maneuver.getFlag(`gurps`, `name`))
        }
      }
    }
    return await super.setManeuver(maneuverName)
  }

  /**
   * Refresh the display of status effects, adjusting their position for the token width and height.
   *
   * @override
   */
  _refreshEffects() {
    // super._refreshEffects()
    if (canvas.dimensions === null) throw new Error(`Cannot refresh effects with null dimensions from canvas`)

    let i = 0
    const w = Math.round(canvas.dimensions.size / 2 / 5) * 3.5
    const rows = Math.floor(this.document.height * 5)
    const bg = this.effects.bg.clear().beginFill(0x000000, 0.4).lineStyle(1.0, 0x000000)
    for (const effect of this.effects.children) {
      if (effect === bg) continue

      const texture = effect._texture.baseTexture
      const factor = texture.width / texture.height

      // Overlay effect
      if (effect === this.effects.overlay) {
        if (isNil(factor) || isNaN(factor)) debugger

        const size = Math.min(this.w * 0.6, this.h * 0.6)
        effect.width = size * factor
        effect.height = size
        effect.position.set((this.w - size) / 2, (this.h - size) / 2)
      }

      // Status effect
      else {
        effect.width = w * factor
        effect.height = w
        effect.x = Math.floor(i / rows) * (w * factor)
        effect.y = (i % rows) * w
        bg.drawRoundedRect(effect.x + 1, effect.y + 1, w * factor - 2, w - 2, 2)
        i++
      }
    }
  }
}
