import { GCS } from "../types/gcs"
import Feature, { IFeatureData } from "../../gurps-mobile/foundry/actor/feature"
import { GenericSource } from "../../gurps-mobile/foundry/actor/feature/pipelines"
import GenericFeature from "../../gurps-mobile/foundry/actor/feature/generic"
import { cloneDeep, isArray, isNil } from "lodash"

export interface IBaseComponent<TFeature extends GenericFeature = GenericFeature> {
  feature: TFeature
  type: string
  //
}

export interface IComponentComparator<TKey extends string> {
  key: TKey
  compare: string
  qualifier: string
}

export interface ISkillBonusComponent<TFeature extends GenericFeature = GenericFeature> extends IBaseComponent<TFeature> {
  type: `skill_bonus`
  per_level?: boolean
  amount: number
  selection_type: `skills_with_name`
  selection_filter: IComponentComparator<`name` | `specialization`>[][] // first level is OR, second level is AND
  // name: IComponentComparator
  // specialization: IComponentComparator
}

export interface IReactionBonusComponent<TFeature extends GenericFeature = GenericFeature> extends IBaseComponent<TFeature> {
  type: `reaction_bonus`
  amount: number
  situation: string
}

export interface IDRBonusComponent<TFeature extends GenericFeature = GenericFeature> extends IBaseComponent<TFeature> {
  type: `dr_bonus`
  amount: number
  location: string[]
}

export interface IAttributeBonusComponent<TFeature extends GenericFeature = GenericFeature> extends IBaseComponent<TFeature> {
  type: `attribute_bonus`
  amount: number
  attribute: (`st` | `dx` | `iq` | `ht` | `dodge` | `block` | `parry` | `will` | `per` | `fp` | `hp`)[]
}

export interface IWeaponBonusComponent<TFeature extends GenericFeature = GenericFeature> extends IBaseComponent<TFeature> {
  type: `weapon_bonus`
  per_level?: boolean
  amount: number
  selection_type: `weapons_with_name`
  selection_filter: IComponentComparator<`name` | `specialization`>[][] // first level is OR, second level is AND
  // name: IComponentComparator
  // specialization: IComponentComparator
}

export interface IConditionalModifierComponent<TFeature extends GenericFeature = GenericFeature> extends IBaseComponent<TFeature> {
  type: `conditional_modifier`
  amount: number
  situation: string
  target: string | undefined
}

export interface ICostReductionComponent<TFeature extends GenericFeature = GenericFeature> extends IBaseComponent<TFeature> {
  type: `cost_reduction`
  attribute: string
  percentage: number
}

export type IComponentDefinition =
  | ISkillBonusComponent
  | IReactionBonusComponent
  | IDRBonusComponent
  | IAttributeBonusComponent
  | IWeaponBonusComponent
  | IConditionalModifierComponent
  | ICostReductionComponent

export function parseComponentDefinition(raw: GCS.Feature) {
  if (raw.type === `conditional_modifier`) {
    const [situation, target] = raw.situation?.split(`|`) ?? []

    const component = cloneDeep(raw) as IConditionalModifierComponent
    component.situation = situation
    component.target = target

    return component
  }

  return raw as IComponentDefinition
}

export function compareComponent(component: ISkillBonusComponent | IComponentDefinition, feature: GenericFeature) {
  if (component.type === `skill_bonus`) {
    if (component.selection_type === `skills_with_name`) {
      const filters = component.selection_filter

      for (const filter of filters) {
        for (const condition of filter) {
          const { key, compare, qualifier } = condition // ex.: key is qualifier

          const value = feature.data[key]

          // ERROR: untested, probably ok
          if (isNil(value)) debugger

          let passed = false
          if ([`is`, `starts_with`, `ends_with`].includes(compare)) {
            const suffix = compare === `is` || compare === `ends_with` ? `$` : ``
            const prefix = compare === `is` || compare === `starts_with` ? `^` : ``

            passed = !!value!.match(new RegExp(`${prefix}${qualifier}${suffix}`, `i`))
          } else {
            // ERROR: Unimplemented compare (in selection_filter)
            debugger
          }

          if (!passed) return false
        }

        return true
      }
    } else {
      // ERROR: Unimplemented selection_type
      debugger
    }
  } else {
    // ERROR: Unimplemented compoent type
    debugger
  }

  return false
}

export function updateComponentSchema(oldComponent: IComponentDefinition, newComponent: IComponentDefinition) {
  // BE CAREFUL TO ONLY READ FROM  OLD COMPONENT
  // BE CAREFUL TO ONLY MODIFY     NEW COMPONENT

  if (oldComponent.type === `skill_bonus` || oldComponent.type === `weapon_bonus`) {
    const component = newComponent as ISkillBonusComponent | IWeaponBonusComponent

    if (component.selection_type === `skills_with_name` || component.selection_type === `weapons_with_name`) {
      component.selection_filter = (component.selection_filter ?? []) as IComponentComparator<`name` | `specialization`>[][]
      const conditions = [] as IComponentComparator<`name` | `specialization`>[]

      // remove from new
      delete component.name
      delete component.specialization

      // inject properties from old into filter
      if (oldComponent.name) {
        conditions.push({
          key: `name`,
          ...oldComponent.name,
        })
      }

      if (oldComponent.specialization) {
        conditions.push({
          key: `specialization`,
          ...oldComponent.specialization,
        })
      }

      // ERROR: Untested (would probably mean that there are other properties for xxx_with_name)
      if (Object.keys(conditions).length === 0) debugger

      component.selection_filter.push(conditions)
    } else {
      // ERROR: Unimplemented selection type
      debugger
    }
  } else if (oldComponent.type === `attribute_bonus` || oldComponent.type === `dr_bonus`) {
    if (oldComponent.type === `attribute_bonus`) {
      const component = newComponent as IAttributeBonusComponent

      if (!isArray(component.attribute)) component.attribute = [component.attribute]

      if (!component.attribute.includes(oldComponent.attribute)) component.attribute.push(oldComponent.attribute)
    }

    if (oldComponent.type === `dr_bonus`) {
      const component = newComponent as IDRBonusComponent

      if (!isArray(component.location)) component.location = [component.location]

      if (!component.location.includes(oldComponent.location)) component.location.push(oldComponent.location)
    }
  } else if ([`reaction_bonus`, `conditional_modifier`, `cost_reduction`].includes(oldComponent.type)) {
    // continue, nothing to update here
  } else {
    // ERROR: Unimplemented component type
    debugger
  }

  // other types dont have mandatory modifications
  return newComponent
}

function parseSkillBonus(raw: GCS.Feature) {
  // if (raw.selection_type === `skills_with_name`) {
  //   const { compare, qualifier } = raw.name

  //   if (compare === `is`) {
  //     const entry = GCA.query(qualifier, undefined, `skill`)
  //     if (entry) raw.skill = entry._index
  //   } else if (compare === `starts_with`) {
  //     // TODO: Really implement this shit
  //     const entry = GCA.query(qualifier, undefined, `skill`)
  //     if (entry) raw.skill = entry._index
  //   } else debugger
  // } else {
  //   // ERROR: Unimplemented
  //   debugger
  // }

  return raw
}
