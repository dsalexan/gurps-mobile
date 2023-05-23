/* eslint-disable no-debugger */
import { isNil } from "lodash"
import { GurpsMobileActor } from "../../gurps-mobile/foundry/actor"
import AdvantageFeature from "../../gurps-mobile/foundry/actor/feature/advantage"
import GenericFeature from "../../gurps-mobile/foundry/actor/feature/generic"
import SkillFeature from "../../gurps-mobile/foundry/actor/feature/skill"

export type IBaseType = `advantage` | `skill` | `attribute` | `constant`

/**
 * The ideia behind "bases" is to make it easing and faster to get the "numerical value" of something (usually a feature)
 */

export interface IBaseBase {
  type: IBaseType
}

export interface IAdvantageBase extends IBaseBase {
  type: `advantage`
  id: string
}

// should a skill base allow for specialization?
export interface ISkillBase extends IBaseBase {
  type: `skill`
  id: string
}

export interface IAttributeBase extends IBaseBase {
  type: `attribute`
  name: string
}

export interface IConstantBase extends IBaseBase {
  type: `constant`
  value: number
}

export type IBase = IAdvantageBase | ISkillBase | IAttributeBase | IConstantBase

export function getBaseValue(base: IBase, actor?: GurpsMobileActor): number | null {
  if (base.type === `constant`) return base.value

  // ERROR: Unimplemented ACTORLESS
  if (!actor) {
    debugger
    return null
  }

  if (base.type === `attribute`) {
    const attribute = actor.getAttribute(base.name)

    // ERROR: Unimplemented attribute
    if (!attribute) debugger
    if (isNil(attribute!.value)) debugger

    return attribute!.value as number
  }

  if ([`advantage`, `skill`].includes(base.type)) {
    const feature = actor.cache.features?.[base.id] as GenericFeature

    // ERROR: Unimplemented missing feature
    if (!feature) debugger

    let level: number | undefined
    if (base.type === `advantage`) {
      const advantage = feature as AdvantageFeature

      level = advantage.data.level
    } else if (base.type === `skill`) {
      const skill = feature as SkillFeature

      level = skill.data.level?.value
    }

    // ERROR: Unimplemented leveless feature
    if (isNil(level)) {
      debugger
      return null
    }

    return level
  }

  // ERROR: Unimplemented
  debugger

  return null
}
