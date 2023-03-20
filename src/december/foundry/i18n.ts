import type { Translations } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/client/apps/i18n"
import { MODULE_ID } from "config"
import { get } from "lodash"

const I = (key: string) => game.i18n.localize(`${MODULE_ID}.${key}`)

export function i18n(key: string) {
  return get(game.i18n, key) as string | Translations
}

export default I
