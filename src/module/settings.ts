import { MODULE_ID } from "./config"

export enum settings {
  // In config
  SHOW_MOBILE_TOGGLE = `showMobileToggle`,
  // Not in config
  MOBILE_MODE = `mobileMode`,
}

interface Callbacks {
  [setting: string]: (value: any) => void
}

export function registerSettings(callbacks: Callbacks = {}): void {
  if (!(`settings` in game)) return

  // game.settings.register(MODULE_ID, settings.SHOW_MOBILE_TOGGLE, {
  //   config: true,
  //   name: `${MODULE_ID}.SettingsShowToggle`,
  //   hint: `${MODULE_ID}.SettingsShowToggleHint`,
  //   type: Boolean,
  //   default: false,
  //   scope: `world`,
  //   onChange: callbacks[settings.SHOW_MOBILE_TOGGLE] || undefined,
  // })

  // game.settings.register(MODULE_ID, settings.MOBILE_MODE, {
  //   config: false,
  //   scope: `client`,
  //   type: Boolean,
  //   default: false,
  //   onChange: callbacks[settings.MOBILE_MODE] || undefined,
  // })
}

// GETTER/SETTER
export function getSetting(setting: settings): any {
  if (!(`settings` in game)) return
  return game.settings.get(MODULE_ID, setting as string)
}

export function setSetting(setting: settings, value: unknown): Promise<any> {
  if (!(`settings` in game)) return new Promise(() => undefined)
  return game.settings.set(MODULE_ID, setting as string, value)
}

export default settings
