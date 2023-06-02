import { GCS } from "../types/gcs"
import Feature, { IFeatureData } from "../../gurps-mobile/foundry/actor/feature"
import { GenericSource } from "../../gurps-mobile/foundry/actor/feature/pipelines"
import GenericFeature from "../../gurps-mobile/foundry/actor/feature/generic"
import { cloneDeep, intersection, isArray, isNil } from "lodash"
import { GurpsMobileActor } from "../../gurps-mobile/foundry/actor"
import { FeatureState } from "../../gurps-mobile/core/feature/utils"
import LOGGER from "../../gurps-mobile/logger"

export interface IBaseComponent {
  feature: string
  type: string
  id: string
  //
}

export interface IComponentComparator<TKey extends string> {
  key: TKey
  compare: string
  qualifier: string
}

export interface ISkillBonusComponent extends IBaseComponent {
  type: `skill_bonus`
  per_level?: boolean
  amount: number
  selection_type: `skills_with_name`
  selection_filter: IComponentComparator<`name` | `specialization`>[][] // first level is OR, second level is AND
  // name: IComponentComparator
  // specialization: IComponentComparator
}

export interface IReactionBonusComponent extends IBaseComponent {
  type: `reaction_bonus`
  amount: number
  situation: string
}

export interface IDRBonusComponent extends IBaseComponent {
  type: `dr_bonus`
  amount: number
  location: string[]
}

export interface IAttributeBonusComponent extends IBaseComponent {
  type: `attribute_bonus`
  amount: number
  attribute: (`st` | `dx` | `iq` | `ht` | `dodge` | `block` | `parry` | `will` | `per` | `fp` | `hp`)[]
}

export interface IWeaponBonusComponent extends IBaseComponent {
  type: `weapon_bonus`
  per_level?: boolean
  amount: number
  selection_type: `weapons_with_name`
  selection_filter: IComponentComparator<`name` | `specialization`>[][] // first level is OR, second level is AND
  // name: IComponentComparator
  // specialization: IComponentComparator
}

export interface IConditionalModifierComponent extends IBaseComponent {
  type: `conditional_modifier`
  amount: number
  situation: string
  target: string | undefined
}

export interface ICostReductionComponent extends IBaseComponent {
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

export function parseComponentDefinition(raw: GCS.Feature, feature: string, index: number) {
  let component: IComponentDefinition

  if (raw.type === `conditional_modifier`) {
    const [situation, target] = raw.situation?.split(`|`) ?? []

    component = raw as IConditionalModifierComponent
    component.situation = situation
    component.target = target
  } else {
    component = raw as IComponentDefinition
  }

  component.feature = feature
  component.id = `${feature}-${index}`

  return component
}

export function compareComponent(component: ISkillBonusComponent | IComponentDefinition, feature: GenericFeature) {
  if (component.type === `skill_bonus`) {
    if (component.selection_type === `skills_with_name`) {
      const filters = component.selection_filter

      for (const filter of filters) {
        let satisfiesAllConditions = true

        // if satisfies all conditions of at least one filter
        for (const condition of filter) {
          const { key, compare, qualifier } = condition // ex.: key is qualifier

          const value = feature.data[key]

          let passed = false
          if ([`is`, `starts_with`, `ends_with`].includes(compare)) {
            const suffix = compare === `is` || compare === `ends_with` ? `$` : ``
            const prefix = compare === `is` || compare === `starts_with` ? `^` : ``

            passed = !!value?.match(new RegExp(`${prefix}${qualifier}${suffix}`, `i`))
          } else {
            // ERROR: Unimplemented compare (in selection_filter)
            debugger
          }

          satisfiesAllConditions = satisfiesAllConditions && passed
        }

        if (satisfiesAllConditions) return true
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

export function buildComponent(type: string | undefined, name: string, bonus: number, feature: string, index: number): IComponentDefinition | null {
  let component = {} as IComponentDefinition

  component.feature = feature
  component.id = `${feature}-${index}`

  if (type === undefined || type === `ST`) {
    const attributeComponent = component as IAttributeBonusComponent

    attributeComponent.type = `attribute_bonus`
    attributeComponent.attribute = [name.toLowerCase()] as any
    attributeComponent.amount = bonus

    // ERROR: Unimplemented attributes
    if (!attributeComponent.attribute.every(attribute => [`dodge`, `block`, `parry`].includes(attribute))) {
      LOGGER.error(`buildComponent`, `attribute`, `Unimplemented attribute`, attributeComponent.attribute, type, name, bonus)

      component = null as any
    }
  } else if ([`GR`].includes(type)) {
    LOGGER.error(`buildComponent`, `attribute`, `Unimplemented type "${type}"`, type, name, bonus)

    component = null as any
  } else {
    // ERROR: Unimplemented
    debugger
  }

  if (component) {
    if (isNil(component.feature)) debugger
    if (isNil(component.type)) debugger
    if (isNil(component.id)) debugger
  }

  return component
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
