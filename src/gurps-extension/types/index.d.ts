/* eslint-disable @typescript-eslint/no-unused-vars */

// import type { GurpsActor } from "./actor"
import type { GurpsActor as GURPSActor } from "gurps/module/actor"
import type GURPSToken from "gurps/module/token"
import type { Maneuvers } from "./actor/maneuver"

declare global {
  namespace GURPS {
    let GurpsActor: typeof GURPSActor
    let GurpsToken: typeof GURPSToken

    // Expose Maneuvers to make them easier to use in modules
    let Maneuvers: typeof Maneuvers

    // Hack to remember the last Actor sheet that was accessed... for the Modifier Bucket to work
    let LastActor: GURPSActor | null

    function SetLastActor(actor: GURPSActor, tokenDocument: Token): void
    function ClearLastActor(actor: GURPSActor): void

    let GurpsMobileActorSheet_rendered: boolean
    let GurpsMobileActorSheet_root: unknown | null

    /* -------------------------------------------- */
    /*  Foundry VTT Initialization                  */
    /* -------------------------------------------- */
    // Hooks.once('init', async function () {
    // rangeObject: typeof GURPSRan

    // remembers last acessed actor, but value is not used com modifier bucket
    let LastAccessedActor: GURPSActor | null
  }
}
