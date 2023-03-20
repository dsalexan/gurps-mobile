// #region INDIVIDUAL SETTINGS

import type { Setting as FoundrySetting } from "../december/foundry/settings"

const allowMobileMode = {
  key: `allowMobileMode`,
  config: true,
  name: `AllowMobileMode`,
  type: Boolean,
  default: false,
  scope: `world`,
} as FoundrySetting

// #endregion

// #region EXPORTS

export const SETTINGS_DEFINITIONS = {
  ALLOW_MOBILE_MODE: allowMobileMode,
} as const

export const SETTINGS = Object.fromEntries(Object.entries(SETTINGS_DEFINITIONS).map(([key, setting]) => [key, setting.key])) as { [k in keyof typeof SETTINGS_DEFINITIONS]: string }

// #endregion
