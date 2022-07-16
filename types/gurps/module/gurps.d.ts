export {}

declare global {
  type GURPS = {
    // Hack to remember the last Actor sheet that was accessed... for the Modifier Bucket to work
    LastActor: GurpsActor

    SetLastActor: (actor: GurpsActor, tokenDocument: Token) => void
    ClearLastActor: (actor: GurpsActor) => void

    /* -------------------------------------------- */
    /*  Foundry VTT Initialization                  */
    /* -------------------------------------------- */
    // Hooks.once('init', async function () {
    // rangeObject: typeof GURPSRan
  }
}
