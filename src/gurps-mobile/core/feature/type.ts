import { intersection, isArray, isString, max, uniq } from "lodash"
import { typeFromGCS } from "./utils"
import type { GCS } from "gurps-extension/types/gcs"

export const TypeIDS = [
  `generic`,
  `generic_advantage`,
  `advantage`,
  `disadvantage`,
  `perk`,
  `quirk`,
  `skill`,
  `spell`,
  `equipment`,
  // usage
  `usage`,
] as const
export type TypeID = (typeof TypeIDS)[number]

export class Type {
  name: string
  values: TypeID[]
  icon: string | null

  constructor(name: string, value: TypeID | TypeID[], icon: string | null) {
    this.name = name
    this.values = isArray(value) ? value : [value]
    this.icon = icon
  }

  get value() {
    return this.values[this.values.length - 1]
  }

  get isGeneric() {
    return this.compare(`generic`)
  }

  toString() {
    return this.name
  }

  derive(raw: GCS.Entry) {
    return typeFromGCS(raw)
  }

  compare(types: Exclude<string, Type> | Type | (Exclude<string, Type> | Type)[], leaf = true) {
    const values = leaf ? [this.value] : this.values
    const aTypes = isArray(types) ? types : [types]

    const _types = aTypes.map(type => {
      if (!isString(type)) return type.value
      return type
    })

    return intersection(_types, values).length > 0
  }

  static uniq(forest: Type[]) {
    // ERROR: algorithm doesnt work for more than two
    if (forest.length > 2) debugger

    const hashs = forest.map(tree => tree.values.join(`/`))
    if (uniq(hashs).length === 1) return [forest[0]]

    const heights = forest.map(tree => tree.values.length)
    const maxHeight = max(heights) as number

    const levels = [] as string[][]
    for (let h = 0; h < maxHeight; h++) {
      levels.push(forest.map(tree => tree.values[h]))
    }

    const equal = levels.map(([a, b]) => a === b)

    // equal trees
    if (!equal[maxHeight - 1] && equal.slice(0, -1).every(b => b)) return [levels[maxHeight[0]] === undefined ? forest[1] : forest[0]]

    debugger

    return forest
  }
}

export const FEATURE = {
  GENERIC: new Type(`Generic`, `generic`, null),
  GENERIC_ADVANTAGE: new Type(`Generic Advantage`, `generic_advantage`, `advantage`),
  ADVANTAGE: new Type(`Advantage`, [`generic_advantage`, `advantage`], `advantage`),
  DISADVANTAGE: new Type(`Disadvantage`, [`generic_advantage`, `disadvantage`], `disadvantage`),
  PERK: new Type(`Perk`, [`generic_advantage`, `advantage`, `perk`], `advantage`),
  QUIRK: new Type(`Quirk`, [`generic_advantage`, `disadvantage`, `quirk`], `disadvantage`),
  SKILL: new Type(`Skill`, `skill`, `skill`),
  SPELL: new Type(`Spell`, [`skill`, `spell`], `spell`),
  EQUIPMENT: new Type(`Equipment`, `equipment`, `equipment`),
  //
  USAGE: new Type(`Usage`, `usage`, `usage`),
} as Record<Uppercase<TypeID>, Type>
