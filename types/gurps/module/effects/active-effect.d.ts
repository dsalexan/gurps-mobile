import type { EffectChangeData } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/data.mjs/effectChangeData"
import type { ActiveEffectData, CombatData } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/module.mjs"

export default class GurpsActiveEffect extends ActiveEffect {
  static init(): void
  /**
   * Before adding the ActiveEffect to the Actor/Item -- might be used to augment the data used to create, for example.
   * @param {ActiveEffect} _effect
   * @param {ActiveEffectData} data
   * @param {*} _options
   * @param {*} _userId
   */
  static _preCreate(_effect: ActiveEffect, data: ActiveEffectData, _options: any, _userId: any): void
  /**
   * After creation of the ActiveEffect.
   * @param {ActiveEffect} effect
   * @param {ActiveEffectData} _data
   * @param {*} _userId
   */
  static _create(effect: ActiveEffect, _data: ActiveEffectData, _userId: any): Promise<void>
  /**
   * On Actor.applyEffect: Applies only to changes that have mode: CONST.ACTIVE_EFFECT_MODES.CUSTOM.
   * @param {Actor|Item} actor
   * @param {ChangeData} change - the change to apply
   * @param {*} _options
   * @param {*} _user
   */
  static _apply(actor: Actor | Item, change: EffectChangeData, _options: any, _user: any): Promise<void>
  /**
   * When updating an ActiveEffect.
   * @param {ActiveEffect} _effect
   * @param {ActiveEffectData} _data to use to update the effect.
   * @param {*} _options
   * @param {*} _userId
   */
  static _update(_effect: ActiveEffect, _data: ActiveEffectData, _options: any, _userId: any): void
  /**
   * When deleting an ActiveEffect.
   * @param {ActiveEffect} _effect
   * @param {ActiveEffectData} _data
   * @param {*} _userId
   */
  static _delete(_effect: ActiveEffect, _data: ActiveEffectData, _userId: any): void
  /**
   * Called whenever updating a Combat.
   * @param {Combat} combat
   * @param {CombatData} _data
   * @param {*} _options
   * @param {*} _userId
   */
  static _updateCombat(combat: Combat, _data: CombatData, _options: any, _userId: any): Promise<void>
  /**
   * @param {ActiveEffect} effect
   */
  static getName(effect: ActiveEffect): string
  static clearEffectsOnSelectedToken(): Promise<void>
  /**
   * @param {ActiveEffectData} data
   * @param {any} context
   */
  constructor(data: ActiveEffectData, context: any)
  context: any
  chatmessages: any[]
  set endCondition(arg: any)
  get endCondition(): any
  get terminateActions(): any
  chat(actor: Actor, value: any): void
  isExpired(): Promise<boolean>
}
