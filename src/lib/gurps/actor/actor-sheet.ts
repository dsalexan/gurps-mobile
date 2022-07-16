import { ConfiguredDocumentClass, ToObjectFalseType } from "@league-of-foundry-developers/foundry-vtt-types/src/types/helperTypes"

declare global {
  namespace GurpsActorSheet {
    // interface Data_<Options extends ActorSheet.Options = ActorSheet.Options> extends DocumentSheet.Data<InstanceType<ConfiguredDocumentClass<typeof Actor>>, Options> {
    //   actor: this[`document`]
    //   items: ToObjectFalseType<foundry.data.ActorData>[`items`]
    //   effects: ToObjectFalseType<foundry.data.ActorData>[`effects`]
    // }

    interface Data<Options extends ActorSheet.Options = ActorSheet.Options> extends ActorSheet.Data<Options> {
      olddata: ActorSheet.Data<Options>
      // ranges:
    }
  }
}

export class GurpsActorSheet extends ActorSheet {
  async close(options = {}) {
    await super.close(options)
    GURPS.ClearLastActor(this.actor)
  }

  // getData() {
  //   const sheetData = super.getData() as GurpsActorSheet.Data

  //   return sheetData
  // }
}
