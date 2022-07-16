import { EffectModifierPopout } from "./effect-modifier-popout"

export class EffectModifierControl {
  static SETTING_SHOW_EFFECTMODIFIERS: string
  static EffectModName: string
  _showPopup: boolean
  token: any
  _ui: EffectModifierPopout
  set showPopup(arg: boolean)
  get showPopup(): boolean
  togglePopup(closeOptions: any): void
  _registerSetting(): void
  _createEffectModifierButton(controls: any): void
  _createActiveEffect(effect: any, _: any, __: any): void
  _updateToken(tokenDocument: any): void
  _targetToken(user: any, token: any, targeted: any): void
  _controlToken(token: any, isControlled: any): void
  close(options: any): Promise<void>
  shouldUseEffectModifierPopup(): any
  toggleEffectModifierPopup(closeOptions: any): void
}
