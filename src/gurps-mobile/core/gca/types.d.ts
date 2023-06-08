/* eslint-disable @typescript-eslint/no-unused-vars */

import { GURPS4th } from "../../../gurps-extension/types/gurps4th"
import SkillFeature from "../../foundry/actor/feature/skill"

export namespace GCA {
  type Section =
    | `ATTRIBUTES`
    | `LANGUAGES`
    | `CULTURES`
    | `ADVANTAGES`
    | `PERKS`
    | `DISADVANTAGES`
    | `QUIRKS`
    | `FEATURES`
    | `SKILLS`
    | `SPELLS`
    | `EQUIPMENT`
    | `TEMPLATES`
    | `MODIFIERS`
    | `any`

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

  export interface BaseDynamicValue {
    type: string
    label?: string
  }

  export interface UnknownDynamicValue extends BaseDynamicValue {
    type: `unknown`
    value?: unknown
  }

  export interface InputDynamicValue extends BaseDynamicValue {
    type: `input`
    schema: { type: string }
  }

  export interface ListDynamicValue extends BaseDynamicValue {
    type: `list`
    options: unknown[]
  }

  export type DynamicValue = UnknownDynamicValue | InputDynamicValue | ListDynamicValue
  export type TargetProperty = DynamicValue

  // export interface TargetProperty {
  //   type?: `unknown` | `list` | `dynamic`
  //   value: never
  // }

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
    type: `unknown` | `attribute` | `skill` | `me` | `flat`
    fullName: string
    name: TargetProperty | string
    nameext?: TargetProperty | string
    // attribute?: string
    value?: string | number[] | number // attribute name (string) | array of entry indexes (number[]) | numeric value (number)
    transform?: string | string[]
  }

  interface SkillDefaultSource {
    skill: number
    source: number
    text: string
  }

  type PreCompiledIndex<T> = {
    byName: T
    byNameExt: T
    byFullname: T
  }

  type PreCompiledDictionaryIndex<T, TKey extends string = string> = Record<TKey, PreCompiledIndex>

  type PreCompiledSectionIndex<T> = PreCompiledDictionaryIndex<T, Section>

  type CompletePreCompiledIndex<T> = PreCompiledIndex<T> & {
    bySection: PreCompiledSectionIndex<T> &
      Record<
        `SKILLS`,
        PreCompiledIndex<T> & {
          byDefault: Record<string, SkillDefaultSource[]>
          byDefaultAttribute: Record<string, SkillDefaultSource[]>
        }
      > &
      Record<
        `MODIFIERS`,
        PreCompiledIndex<T> & {
          allGroups: T
          byGroup: PreCompiledDictionaryIndex<T>
        }
      >
  }

  type BarebonesPreCompiledIndex<T> = PreCompiledIndex<T> & {
    bySection: PreCompiledSectionIndex<T> &
      Record<
        `MODIFIERS`,
        PreCompiledIndex<T> & {
          allGroups: T
          byGroup: PreCompiledDictionaryIndex<T>
        }
      >
  }
}
