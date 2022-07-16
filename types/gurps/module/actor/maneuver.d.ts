import type { ActiveEffectDataConstructorData } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/data.mjs/activeEffectData"
import type { EffectChangeDataConstructorData } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/data.mjs/effectChangeData"

export const MANEUVER: `maneuver`
export const DEFENSE_ANY: `any`
export const DEFENSE_NONE: `none`
export const DEFENSE_DODGEBLOCK: `dodge-block`
export const MOVE_NONE: `none`
export const MOVE_ONE: `1`
export const MOVE_STEP: `step`
export const MOVE_ONETHIRD: `×1/3`
export const MOVE_HALF: `half`
export const MOVE_TWOTHIRDS: `×2/3`
export const MOVE_FULL: `full`
export const PROPERTY_MOVEOVERRIDE_MANEUVER: `data.moveoverride.maneuver`
export const PROPERTY_MOVEOVERRIDE_POSTURE: `data.moveoverride.posture`

export type ManeuverID =
  | `do_nothing`
  | `move`
  | `aim`
  | `change_posture`
  | `evaluate`
  | `attack`
  | `feint`
  | `allout_attack`
  | `aoa_determined`
  | `aoa_double`
  | `aoa_feint`
  | `aoa_strong`
  | `aoa_suppress`
  | `move_and_attack`
  | `allout_defense`
  | `aod_dodge`
  | `aod_parry`
  | `aod_block`
  | `aod_double`
  | `ready`
  | `concentrate`
  | `wait`

export default class Maneuvers {
  /**
   * @param {string} id
   * @returns {ManeuverData}
   */
  static get(id: string): ManeuverData
  /**
   * @param {string} text
   * @returns {boolean} true if the text represents a maneuver icon path.
   * @memberof Maneuvers
   */
  static isManeuverIcon(text: string): boolean
  /**
   * Return the sublist that are Maneuver icon paths.
   * @param {string[]} list of icon pathnames
   * @returns {string[]} the pathnames that represent Maneuvers
   * @memberof Maneuvers
   */
  static getManeuverIcons(list: string[]): string[]
  /**
   * @param {string} maneuverText
   * @returns {ManeuverData}
   */
  static getManeuver(maneuverText: string): ManeuverData
  /**
   * @param {string} maneuverText
   * @returns {string|null}
   */
  static getIcon(maneuverText: string): string | null
  static getAll(): Record<ManeuverID, Maneuver>
  static getAllData(): Record<string, ManeuverInnerData>
  /**
   * @param {string} icon
   * @returns {ManeuverData[] | undefined}
   */
  static getByIcon(icon: string): ManeuverData[] | undefined
  /**
   * The ActiveEffect is a Maneuver if its statusId is 'maneuver'.
   * @param {ActiveEffect} activeEffect
   * @returns {boolean}
   */
  static isActiveEffectManeuver(activeEffect: ActiveEffect): boolean
  /**
   * @param {ActiveEffect[] | undefined} effects
   * @return {ActiveEffect[]} just the ActiveEffects that are also Maneuvers
   */
  static getActiveEffectManeuvers(effects: ActiveEffect[] | undefined): ActiveEffect[]
}

export type ManeuverEffect = {
  id: string
  flags: {
    gurps: {
      name: string
      move?: string
      defense?: string
      fullturn?: boolean
      icon: string
      alt?: string | null
    }
  }
}

export type ManeuverData = ActiveEffectDataConstructorData & ManeuverEffect

export type ManeuverInnerData = {
  name: string
  label: string
  move?: string
  defense?: string
  fullturn?: boolean
  icon: string
  alt?: string | null
}

/**
 * The purpose of this class is to help generate data that can be used in an ActiveEffect.
 */
declare class Maneuver {
  static filepath: string
  /**
   * @param {ManeuverInnerData} data
   */
  constructor(data: ManeuverInnerData)
  _data: ManeuverInnerData

  get icon(): string
  get move(): string

  get data(): ManeuverData
  get changes(): EffectChangeDataConstructorData[]
}
export {}
