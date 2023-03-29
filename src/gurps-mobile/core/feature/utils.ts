import { flatten, get, isArray, isEmpty, isNil, isObjectLike, isString, uniq, uniqBy } from "lodash"
import type { GCS } from "gurps-extension/types/gcs"

import LOGGER from "logger"
import { isNilOrEmpty, isNumeric } from "december/utils/lodash"

import { FEATURE, Type } from "./type"
// import Feature from "./base"
import { GurpsMobileActor } from "../../foundry/actor"
import type { GCA } from "../gca/types"
import Feature from "../../foundry/actor/feature"

export interface ModifierValue {
  label: string
  secondary_label?: string
  value: number
}

export const FeatureState = {
  INACTIVE: 0, //   000
  PASSIVE: 1, //    001
  ACTIVE: 2, //     010
  ACTIVATING: 4, // 100
} as const

export type FeatureState = (typeof FeatureState)[keyof typeof FeatureState]

export function stateToString(state: FeatureState) {
  if (state === FeatureState.INACTIVE) return `Inactive`
  else if (state === FeatureState.PASSIVE) return `Passive`
  else if (state === FeatureState.ACTIVE) return `Active`
  else if (state === FeatureState.ACTIVATING) return `Activating`
}

/**
 * Return type from GCS data
 *
 * @param raw
 * @param base
 */
export function typeFromGCS(raw: GCS.Entry, base?: Type): Type {
  const type = get(raw, `type`, ``).replace(/_container$/, ``)
  const points = get(raw, `calc.points`, 0)
  const points_per_level = get(raw, `points_per_level`, 0)

  if (type === `trait`) {
    const probablyNaturalAttacks = points === 0 && !points_per_level && !!raw.name?.match(/natural attacks?/gi)

    const genericAdvantage = !points && !probablyNaturalAttacks
    const singlePointPerLevel = Math.abs(points_per_level) === 1
    const singlePoint = Math.abs(points) === 1
    const negativePoints = points < 0 || points_per_level < 0
    const positivePoints = points > 0 || points_per_level > 0 || probablyNaturalAttacks

    if (genericAdvantage) LOGGER.warn(`Could not precise type for advantage (invalid points)`, raw)

    if (negativePoints) {
      if (!isNil(points_per_level) && singlePointPerLevel) return FEATURE.QUIRK
      else if (isNil(points_per_level) && singlePoint) return FEATURE.QUIRK
      return FEATURE.DISADVANTAGE
    } else if (positivePoints) {
      if (!isNil(points_per_level) && singlePointPerLevel) return FEATURE.PERK
      else if (isNil(points_per_level) && singlePoint) return FEATURE.PERK
      return FEATURE.ADVANTAGE
    } else return FEATURE.GENERIC_ADVANTAGE
  } else if (type === `skill`) return FEATURE.SKILL
  else if (type === `spell`) return FEATURE.SPELL

  return FEATURE.GENERIC
}

/**
 * Return type from GCA data
 *
 * @param raw
 */
export function typeFromGCA(raw: GCA.Entry): Type {
  if (isNil(raw)) return FEATURE.GENERIC
  else if ([`ADVANTAGES`, `LANGUAGES`, `CULTURES`].includes(raw.section)) return FEATURE.ADVANTAGE
  else if (raw.section === `PERKS`) return FEATURE.PERK
  else if (raw.section === `QUIRKS`) return FEATURE.QUIRK
  else if (raw.section === `DISADVANTAGES`) return FEATURE.DISADVANTAGE
  else if (raw.section === `SKILLS`) return FEATURE.SKILL
  else if (raw.section === `SPELLS`) return FEATURE.SPELL
  else if (raw.section === `EQUIPMENT`) return FEATURE.EQUIPMENT

  // FEATURES
  // TEMPLATES

  LOGGER.info(`deriveFeatureTypeFromSection`, raw.section)
  // eslint-disable-next-line no-debugger
  debugger

  return FEATURE.GENERIC
}

/**
 * Return name form Feature
 *
 * @param advantage
 * @param recursive
 */
export function name(advantage: Feature, recursive = false): string | undefined {
  if (advantage) {
    const notes = advantage.notes
    const _name = isEmpty(notes) || isNil(notes) ? advantage.name : `${advantage.name} (${notes})`

    return recursive && advantage.parent ? `${name(advantage.parent, recursive)} > ${_name}` : _name
  }

  return undefined
}

/**
 * Return specialized name from name and nameext
 *
 * @param name
 * @param nameext
 */
export function specializedName(name: string | GCA.Entry, nameext?: string): string {
  if (!isString(name)) return specializedName(name.name, name.nameext)
  if (isNilOrEmpty(nameext)) return name
  return `${name} (${nameext})`
}

/**
 * Return keyTree from feature
 *
 * @param feature
 * @param getter
 */

export function keyTree(key: string | number | number[] | string[], parent: Feature<any, any> | null): (string | number)[] {
  let _key = key as number[] | string[]
  if (!isArray(key)) _key = [key] as any

  if (!parent) return [..._key]
  return [...parent.key.tree, ..._key]
}

/**
 * Return numeric key from tree
 *
 * @param key_tree
 */
export function keyTreeValue(key_tree: (string | number)[]): number {
  let value = 0
  let i = 0
  for (const key of key_tree) {
    const _key = parseFloat(key as string) / 10 ** i
    value += _key

    i += 1
  }

  return isNaN(value) ? -1 : value
}

/**
 * Parse weight string into a absolute value (using unit referenced in string)
 */
export function parseWeight(_weight: string | null): number | null {
  if (isNil(_weight)) return null

  const [, _value, _unit] =
    _weight
      .toString()
      .toLowerCase()
      .match(/ *([\d.,]+) *([^\d]+) *?/) ?? []

  const unit = _unit ? (_unit[_unit.length - 1] === `s` ? _unit.substring(0, _unit.length - 1) : _unit) : `??`
  const base = {
    kg: 1,
    lb: 0.5, // 0.453592
  }[unit]
  if (base === undefined) console.warn(`gcs`, `Unknown weight unit`, _unit, _weight)

  const value = parseFloat(_value) * (base ?? 1)

  return value
}

/**
 * Parse modifier object to string
 */
export function parseModifier(modifier: never, [minus, plus] = [`-`, `+`], zero = ``) {
  if (isNil(modifier) || modifier === `` || isNaN(parseInt(modifier))) return (modifier ?? ``).toString()

  const _modifier = parseInt(modifier)
  if (_modifier === 0) return zero
  if (_modifier < 0) return `${minus}${Math.abs(_modifier).toString()}`
  return `${plus}${_modifier.toString()}`
}
