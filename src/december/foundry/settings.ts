import { isNil } from "lodash-es"

import { MODULE_ID } from "config"

export type SettingCallback = Record<string, (...args: any[]) => void>
export type Setting = Parameters<typeof game.settings.register>[2] & { key: string }

/**
 *
 * @param module_id
 * @param settings
 * @param callbacks
 */
export function registerSettings(module_id: string, settings: Setting[], callbacks: SettingCallback = {}) {
  for (const setting of settings) {
    const name = setting.name

    if (isNil(name)) return console.error(`Setting "${setting.key}" cannot have a empty name`)

    game.settings.register(module_id, setting.key, {
      ...setting,
      name: `${MODULE_ID}.settings.${name}`,
      hint: `${MODULE_ID}.settings.${name}Hint`,
      onChange: callbacks[setting.key] || undefined,
    })
  }
}

// GETTER/SETTER
/**
 *
 * @param module_id
 * @param setting
 */
export function getSetting(module_id: string, setting: string) {
  return game.settings.get(module_id, setting)
}

/**
 *
 * @param module_id
 * @param setting
 * @param value
 */
export function setSetting<T>(module_id: string, setting: string, value: T) {
  return game.settings.set(MODULE_ID, setting, value)
}
