import type { ActiveEffectDataConstructorData } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/data.mjs/activeEffectData"
import type { EffectChangeDataConstructorData } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/data.mjs/effectChangeData"

export type ManeuverObject = {
  name: string
  label: string
  move?: string
  defense?: string
  fullturn?: boolean
  icon: string
  alt?: string | null
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

export class Maneuver {
  static filepath: string

  _data: ManeuverObject
  constructor(data: ManeuverObject)

  get icon(): string
  get move(): string
  get data(): ManeuverData
  get changes(): EffectChangeDataConstructorData[]
}

export type MANEUVER =
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

declare global {
  namespace GURPS {
    declare class Maneuvers {
      static _maneuvers: Record<MANEUVER, Maneuver>

      static listen(): void
      static getAll(): Record<MANEUVER, Maneuver>
      /**
       * @param {string} id
       *
       * @returns {ManeuverData}
       */
      static get(id: string): ManeuverData
      /**
       * @param {string} text
       *
       * @returns {boolean} true if the text represents a maneuver icon path.
       * @memberof Maneuvers
       */
      static isManeuverIcon(text: string): boolean
      /**
       * Return the sublist that are Maneuver icon paths.
       *
       * @param {string[]} list of icon pathnames
       *
       * @returns {string[]} the pathnames that represent Maneuvers
       * @memberof Maneuvers
       */
      static getManeuverIcons(list: string[]): string[]
      /**
       * @param {string} maneuverText
       *
       * @returns {ManeuverData}
       */
      static getManeuver(maneuverText: string): ManeuverData
      /**
       * @param {string} maneuverText
       *
       * @returns {string|null}
       */
      static getIcon(maneuverText: string): string | null
      static getAllData(): Record<MANEUVER, ManeuverData>
      /**
       * @param {string} icon
       *
       * @returns {ManeuverData[]|undefined}
       */
      static getByIcon(icon: string): ManeuverData[] | undefined
      /**
       * The ActiveEffect is a Maneuver if its statusId is 'maneuver'.
       *
       * @param {ActiveEffect} activeEffect
       *
       * @returns {boolean}
       */
      static isActiveEffectManeuver(activeEffect: ActiveEffect): boolean
      /**
       * @param {ActiveEffect[]|undefined} effects
       *
       * @returns {ActiveEffect[]} just the ActiveEffects that are also Maneuvers
       */
      static getActiveEffectManeuvers(effects: ActiveEffect[] | undefined): ActiveEffect[]
    }
  }
}
