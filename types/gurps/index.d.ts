// eslint-disable-next-line quotes
declare module "gurps/module/actor/actor-sheet" {
  import { GurpsMobileActor } from "../../src/gurps-mobile/foundry/actor"

  class GurpsActorSheet extends ActorSheet {
    get actor(): GurpsMobileActor
  }
}
