import type { Migration } from "../lib/migration"
import type { parseDecimalNumber } from "../lib/parse-decimal-number/parse-decimal-number"
import type { GurpsActor } from "./actor/actor"
import type { EffectModifierControl } from "./actor/effect-modifier-control"
import type Maneuvers from "./actor/maneuver"
import type { ChatProcessorRegistry } from "./chat"
import type GurpsActiveEffect from "./effects/active-effect"
import type { SJGProductMappings } from "./pdf-refs"

export type GURPS = {
  DEBUG: boolean
  BANNER: string
  LEGAL: string

  Migration: Migration

  parseDecimalNumber: typeof parseDecimalNumber

  //addChatHooks()
  ChatProcessors: ChatProcessorRegistry
  // JQueryHelpers()
  // MoustacheWax()
  // Settings.initializeSettings()
  EffectModifierControl: EffectModifierControl

  // Expose Maneuvers to make them easier to use in modules
  Maneuver: Maneuvers

  // Use the target d6 icon for rolltable entries
  RollTable: any & { resultIcon: string }
  time: any & { roundTime: number }

  // Hack to remember the last Actor sheet that was accessed... for the Modifier Bucket to work
  LastActor: GurpsActor
  SJGProductMappings: typeof SJGProductMappings
  // clearActiveEffects = GurpsActiveEffect.clearEffectsOnSelectedToken
  clearActiveEffects: typeof GurpsActiveEffect.clearEffectsOnSelectedToken

  SetLastActor: (actor: GurpsActor, tokenDocument: Token) => void
  ClearLastActor: (actor: GurpsActor) => void
}
