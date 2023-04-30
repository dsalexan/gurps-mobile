import { push } from "utils/lodash"
import { cloneDeep, flatten, get, has, isNil, isNull, isString, omit } from "lodash"
import { MANEUVER, Maneuver } from "../../../gurps-extension/types/actor/maneuver"

interface Element {
  type: `button` | `group`
  id: string
}

interface Button extends Element {
  name: string
  active?: boolean
  maneuver?: string
  children?: string[]
}

interface Group extends Element {
  label?: string
  children?: Button[]
  parent?: string
  expanded?: boolean
}

export interface Tray {
  level: number
  expanded: boolean
  children: Group[]
}

/**
 *
 * @param id
 * @param label
 * @param children
 */
function GROUP(id: string, label: string | undefined, children: (string | Button)[]): Group {
  return {
    type: `group`,
    id,
    label,
    children: children.map(child => (isString(child) ? BUTTON(child) : child)),
  }
}

/**
 *
 * @param id
 * @param parent
 * @param children
 */
function SUBGROUP(id: string, parent: string, children: string[]): Group {
  const group = GROUP(id, `SUBGROUP`, children)
  group.parent = parent

  return group
}

/**
 *
 * @param name
 * @param children
 */
function BUTTON(name: string): Button {
  return {
    type: `button`,
    id: name,
    name,
  }
}

const BASE_TRAY = [
  [
    //
    GROUP(`do_nothing`, undefined, [`do_nothing`]),
    GROUP(`basic`, `Basic`, [`ready`, `concentrate`, `wait`, `move`]),
    GROUP(`nonoffensive`, `Non-Offensive`, [`allout_defense`, `evaluate`, `aim`]),
    GROUP(`offensive`, `Offensive`, [`move_and_attack`, `attack`, `feint`, `allout_attack`]),
  ],
  [
    //
    SUBGROUP(`allout_defense`, `allout_defense`, [`aod_double`, `aod_block`, `aod_dodge`, `aod_parry`]),
    SUBGROUP(`allout_attack`, `allout_attack`, [`aoa_double`, `aoa_determined`, `aoa_strong`, `aoa_feint`]),
  ],
]

/**
 *
 * @param allManeuvers
 * @param isActive
 */
export default function createTray(allManeuvers: Record<MANEUVER, Maneuver>, isActive: (type: string, id: string) => boolean) {
  const baseTray = cloneDeep(BASE_TRAY)
  const TRAY = [] as Tray[]

  const activeIndex = {} as Record<string, boolean>
  const parentIndex = {} as Record<string, Button[]>

  // build shit
  for (let level = 0; level < baseTray.length; level++) {
    const groups = baseTray[level]

    let someExpanded = false
    for (const group of groups) {
      if (group.parent !== undefined) {
        push(parentIndex, group.parent, group.children)

        const parentManeuver = allManeuvers[group.parent]
        if (isNil(parentManeuver)) throw new Error(`Maneuver group does not have a valid parent ("${group.parent}")`)

        group.label = parentManeuver._data.label
      }

      let someActive = false
      for (const button of group.children ?? []) {
        button.active = isActive(`button`, button.id)
        button.maneuver = allManeuvers[button.name]
        if (isNil(button.maneuver)) throw new Error(`Maneuver button is not a valid maneuver ("${button.name}")`)

        if (button.active) activeIndex[button.id] = true

        someActive = someActive || button.active
      }

      group.expanded = level === 0 || (group.parent !== undefined ? activeIndex[group.parent] : someActive)
      someExpanded = someExpanded || !!group.expanded
    }

    TRAY[level] = {
      level,
      expanded: someExpanded,
      children: groups,
    }
  }

  // retro add parenting (when a button has children in another level)
  for (let level = 0; level < TRAY.length; level++) {
    const _level = TRAY[level]

    for (const group of _level.children) {
      for (const button of group.children ?? []) {
        if (parentIndex[button.id] && parentIndex[button.id].length > 0) {
          button.children = flatten(parentIndex[button.id]).map(b => b.name)
        }
      }
    }
  }

  return TRAY
}
