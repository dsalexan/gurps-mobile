/* eslint-disable @typescript-eslint/ban-types */

export class EffectModifierPopout extends Application {
  /** @override */
  static override get defaultOptions(): any
  constructor(token: any, callback: any, options?: {})
  _token: any
  _callback: any
  /** @override */
  override getData(options: any): any
  get targets(): {
    name: any
    targetmodifiers: any
  }[]
  convertModifiers(list: any): any
  get selectedToken(): any
  getToken(): any
  setToken(value: any): Promise<void>
  /** @override */
  override activateListeners(html: any): void
  /** @override */
  override close(options: any): Promise<void>
  closeApp(options: any): Promise<void>
}
