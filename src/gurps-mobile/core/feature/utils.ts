import { flatten, get, has, isArray, isEmpty, isNil, isObjectLike, isString, sumBy, uniq, uniqBy } from "lodash"
import type { GCS } from "gurps-extension/types/gcs"

import LOGGER from "logger"
import { isNilOrEmpty, isNumeric } from "december/utils/lodash"

import { FEATURE, Type } from "./type"
// import Feature from "./base"
import { GurpsMobileActor } from "../../foundry/actor"
import type { GCA } from "../gca/types"
import Feature from "../../foundry/actor/feature"
import GenericFeature from "../../foundry/actor/feature/generic"

export interface ModifierValue {
  label: string
  secondary_label?: string
  value: number
}

export const FeatureState = {
  INACTIVE: 0, //     0000
  PASSIVE: 1, //      0001
  ACTIVE: 2, //       0010
  ACTIVATING: 4, //   0100
  HIGHLIGHTED: 8, //  1000
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
  const base_points = get(raw, `base_points`) as number | undefined
  let points = get(raw, `calc.points`, 0) as number
  const points_per_level = get(raw, `points_per_level`, 0)

  if (points === 0 && !isNil(base_points)) points = base_points

  if (type === `trait`) {
    const probablyNaturalAttacks = points === 0 && !points_per_level && !!raw.name?.match(/natural attacks?/gi)

    let genericAdvantage = !points && !probablyNaturalAttacks
    let purposefulGenericAdvantage = false

    if (raw.name.toLowerCase() === `list`) {
      genericAdvantage = true
      purposefulGenericAdvantage = true
      points = 0
    } else if (genericAdvantage) {
      const modifiers = get(raw, `modifiers`, []).filter(modifier => !modifier.disabled)
      const negativeModifiers = modifiers.filter(modifier => modifier.cost < 0)
      const positiveModifiers = modifiers.filter(modifier => modifier.cost >= 0)

      const negativeOverall = sumBy(negativeModifiers, `cost`)
      const positiveOverall = sumBy(positiveModifiers, `cost`)

      // means that there is modifiers that offset cost to 0 (usually things like Native Language or Native Cultural Familiarity)
      if (positiveModifiers.length > 0 && positiveOverall === Math.abs(negativeOverall)) {
        // console.trace(`gurps-mobile`)
        LOGGER.warn(`gcs∙type`, `Advantage derive cost from modifiers`, `"${raw.name ?? raw.description}"`, raw, [
          `color: #826835;`,
          `color: rgba(130, 104, 53, 60%); font-style: italic;`,
          `color: black; font-style: regular; font-weight: bold`,
          ``,
        ])
        points = positiveOverall
        genericAdvantage = false
      } else {
        const children = get(raw, `children`, []) as GCS.Entry[]
        const hasListChild = !isNil(children.find(child => child.name.toLowerCase() === `list`))

        if (hasListChild) {
          LOGGER.warn(`gcs∙type`, `Trait List`, `"${raw.name ?? raw.description}"`, raw, [
            `color: #826835;`,
            `color: rgba(130, 104, 53, 60%); font-style: italic;`,
            `color: black; font-style: regular; font-weight: bold`,
            ``,
          ])
          points = 2 // symbolic value for "advantage not perk"
          genericAdvantage = false
        }
      }

      if (genericAdvantage && !purposefulGenericAdvantage) {
        LOGGER.warn(`gcs∙type`, `Could not precise type for advantage (invalid points)`, raw)
        // debugger
      }
    }

    const singlePointPerLevel = Math.abs(points_per_level) === 1
    const singlePoint = Math.abs(points) === 1
    const negativePoints = points < 0 || points_per_level < 0
    const positivePoints = points > 0 || points_per_level > 0 || probablyNaturalAttacks

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
  else if (type === `equipment`) return FEATURE.EQUIPMENT
  else if (type === `weapon`) return FEATURE.USAGE

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

export function typeFromManual(raw: object): Type | undefined {
  if (has(raw, `type`)) return raw.type

  return undefined
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
  if (name === undefined) return undefined as any
  if (!isString(name) && has(name, `name`)) return specializedName(name.name, name.nameext)
  if (isNilOrEmpty(nameext)) return name
  return `${name} (${nameext})`
}

/**
 * Return keyTree from feature
 *
 * @param feature
 * @param getter
 */

export function keyTree(key: number | number[] | string[], parent?: Feature<any, any>): (string | number)[] {
  let _key = key as number[]
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
export function parseModifier(modifier: number | string, [minus, plus] = [`-`, `+`], zero = ``) {
  if (isNil(modifier) || modifier === `` || isNaN(parseInt(modifier))) return (modifier ?? ``).toString()

  const _modifier = parseInt(modifier)
  if (_modifier === 0) return zero
  if (_modifier < 0) return `${minus}${Math.abs(_modifier).toString()}`
  return `${plus}${_modifier.toString()}`
}
/**
 * (For "MoveFeature") Set feature as default move in actor
 */
export function setMoveDefault(feature: GenericFeature) {
  const actor = feature.actor

  if (feature.path) {
    LOGGER.get(`actor`).info(`[${actor.id}]`, `setMoveDefault`, feature.path.split(`.`)[1])
    actor.setMoveDefault(feature.path.split(`.`)[1])
  } else {
    LOGGER.warn(`setMoveDefault`, `No path found for feature ${feature.data.name ? feature.data.name : `id:${feature.id}`}`)
  }
}
