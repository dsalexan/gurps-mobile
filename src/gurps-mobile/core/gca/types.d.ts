/* eslint-disable @typescript-eslint/no-unused-vars */

import { GURPS4th } from "../../../gurps-extension/types/gurps4th"

export namespace GCA {
  type Section = `ATTRIBUTES` | `LANGUAGES` | `CULTURES` | `ADVANTAGES` | `PERKS` | `DISADVANTAGES` | `QUIRKS` | `FEATURES` | `SKILLS` | `SPELLS` | `EQUIPMENT` | `TEMPLATES`

  type IndexedSkill = {
    name: string
    skill: number
    ignoreSpecialization: boolean
    specializations: number[]
    _specializations: (string | undefined)[]
  }

  type Entry = {
    _index: number
    name: string
    nameext?: string
    specializationRequired: boolean
    default: Expression[]
    //
    type?: string
    section: Section
    //
    ointment?: `X`
    //
    blockat?: string
    parryat?: string
  }

  export interface TargetProperty {
    type?: `unknown` | `list` | `dynamic`
    value: never
  }

  export interface Expression {
    _raw: string
    math: boolean
    expression: string
    variables?: Record<string, string>
    targets?: Record<string, ExpressionTarget>
    value?: never
    text?: never
  }

  export interface ExpressionTarget {
    _raw: string // value from Expression.variables
    type: `unknown` | `attribute` | `skill` | `me`
    fullName: string
    name: TargetProperty | string
    nameext?: TargetProperty | string
    // attribute?: string
    value?: string | number[] // attribute name (string) | array of entry indexes (number[])
    transform?: string | string[]
  }

  interface SkillDefaultSource {
    skill: number
    source: number
    text: string
  }

  type PreCompiledSectionIndex<T> = Record<
    Section,
    {
      byName: T
      byNameExt: T
      byFullname: T
    }
  >

  type CompletePreCompiledIndex<T> = {
    byName: T
    byNameExt: T
    byFullname: T
    bySection: PreCompiledSectionIndex<T> &
      Record<
        `SKILLS`,
        {
          byName: T
          byNameExt: T
          byFullname: T
          byDefault: Record<string, SkillDefaultSource[]>
          byDefaultAttribute: Record<string, SkillDefaultSource[]>
        }
      >
  }

  type BarebonesPreCompiledIndex<T> = {
    byName: T
    byNameExt: T
    byFullname: T
    bySection: PreCompiledSectionIndex<T>
  }
}
