import { uniq } from "lodash"
import { isNilOrEmpty } from "../../december/utils/lodash"
import { GCS } from "../types/gcs"

export interface IModifierCost {
  type: `multiplier` | `percentage` | `points`
  value: number
  affects: undefined | `base_only` | `levels_only`
}

export interface IModifier {
  id: string
  name: string
  notes: string
  level: number
  reference: string[]
  cost: IModifierCost
  tags: string[]
}

export function parseModifier(entry: GCS.Entry, tags: string[] = []): IModifier[] {
  if (entry.type === `modifier_container`) {
    const children = (entry.children ?? []) as GCS.Entry[]
    const parsedChildren = children.map(child => parseModifier(child, [...tags, entry.name]))

    return parsedChildren.flat()
  }

  // ERROR: Unimplemented modifier entry type
  if (entry.type !== `modifier`) debugger

  if (entry.disabled) return []

  const cost = {} as IModifierCost

  cost.value = parseInt(entry.cost)
  cost.type = entry.cost_type ?? `percentage`
  cost.affects = entry.affects

  // ERROR: Unimplemented cost type
  if (![`multiplier`, `points`, `percentage`].includes(cost.type)) debugger
  if (![undefined, `base_only`, `levels_only`].includes(cost.affects)) debugger

  // ERROR: There is some unaccounted key in modifier entry
  const unaccountedKeys = Object.keys(entry).filter(key => ![`id`, `name`, `notes`, `reference`, `cost`, `cost_type`, `affects`, `type`, `levels`].includes(key))
  if (unaccountedKeys.length > 0) debugger

  // ERROR: Unimplemented name
  if (isNilOrEmpty(entry.name)) debugger

  let name = entry.name
  let notes = entry.notes

  if (name.match(/:/i) && isNilOrEmpty(notes)) {
    const byColon = name.replaceAll(/ *: */g, `:`).split(`:`)
    if (byColon.length !== 2) debugger

    name = byColon[0]
    notes = byColon[1]
  } else if (name.match(/:/i)) {
    debugger
  }

  let reference = isNilOrEmpty(entry.reference) ? [] : entry.reference.replaceAll(/ *, */g, `,`).split(`,`)

  const modifier = {
    id: entry.id,
    name,
    notes,
    level: entry.levels,
    reference,
    cost,
    tags: uniq(tags),
  }

  return [modifier]
}
