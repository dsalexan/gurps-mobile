/* eslint-disable @typescript-eslint/no-unused-vars */

import { GURPS4th } from "../../../gurps-extension/types/gurps4th"
import SkillFeature from "../../foundry/actor/feature/skill"

export namespace GCA {
  type Section = `ATTRIBUTES` | `LANGUAGES` | `CULTURES` | `ADVANTAGES` | `PERKS` | `DISADVANTAGES` | `QUIRKS` | `FEATURES` | `SKILLS` | `SPELLS` | `EQUIPMENT` | `TEMPLATES`

  type IndexedSkill = {
    proxy: SkillFeature
    id: string
    name: string
    skill: number
    ignoreSpecialization: boolean
    specializations: number[]
    _specializations: (string | undefined)[]
  }

  interface Entry extends Record<string, unknown> {
    _index: number
    name: string
    nameext?: string
    specializationRequired: boolean
    default: Expression[]
    cat: string[]
    tl?: string
    page?: string[]
    itemnotes?: string[]
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
