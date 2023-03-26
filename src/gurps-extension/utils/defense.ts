/* eslint-disable no-debugger */
import { cloneDeep, isNil, orderBy, sum } from "lodash"
import { parseBonus } from "./bonus"
import { ILevel, calculateLevel } from "./level"
import GenericFeature from "../../gurps-mobile/core/feature/variants/generic"
import { GurpsMobileActor } from "../../gurps-mobile/foundry/actor"

export interface IActiveDefenseLevel {
  bonus: number
  skill: ILevel
}

/**
 * Calculate active defense level for a feature
 */
export function featureActiveDefenseLevel(activeDefense: `block` | `dodge` | `parry` | `all`, feature: GenericFeature, actor: GurpsMobileActor): IActiveDefenseLevel | null {
  if (feature.type.compare(`spell`)) return null

  const components = actor.getComponents(`attribute_bonus`, component => component.attribute === activeDefense)
  const actorBonus = sum(components.map(component => component.amount))

  if (activeDefense === `block` || activeDefense === `parry`) {
    const defensableWeapons = feature.weapons.filter(weapon => weapon[activeDefense] !== false)
    if (defensableWeapons.length === 0) return null // no weapon with defense, return null

    const weapon = defensableWeapons[0]

    const skill = cloneDeep(weapon.level())
    if (skill === null) return null

    const bonus = parseBonus(weapon[activeDefense] as string)

    // ERROR: Unimplemented for bonuses with special directives (U for unready after parry, for example)
    if (Object.keys(bonus).length > 1) debugger

    if (skill?.relative) {
      skill.relative.expression = `(${skill.relative.expression})/2 + 3`
      skill.level = Math.floor(calculateLevel(skill.relative))
    }

    return {
      bonus: actorBonus + bonus.value,
      skill: skill as ILevel,
    }
  } else if (activeDefense === `dodge`) {
    debugger
  } else {
    // ERROR: Unimplemented
    debugger
  }

  return null
}

export function activeDefenseLevel(activeDefense: `block` | `dodge` | `parry` | `all`, actor: GurpsMobileActor, highest: true): IActiveDefenseLevel | null
export function activeDefenseLevel(activeDefense: `block` | `dodge` | `parry` | `all`, actor: GurpsMobileActor, highest: false): IActiveDefenseLevel[] | null
export function activeDefenseLevel(
  activeDefense: `block` | `dodge` | `parry` | `all`,
  actor: GurpsMobileActor,
  highest = false,
): IActiveDefenseLevel | IActiveDefenseLevel[] | null {
  const features = activeDefenseFeatures(activeDefense, actor)

  debugger
  // list all actor skills with activeDefense property
  // list all weapons with activeDefense property (for power defenses)
  // zip skills and weapons, making tuples of appropriate skills and weapons
  // calculate level for each tuple

  let adls = [] as IActiveDefenseLevel[]
  if (activeDefense === `block` || activeDefense === `parry`) {
    adls = features.map(feature => featureActiveDefenseLevel(activeDefense, feature, actor)).filter(level => !isNil(level)) as IActiveDefenseLevel[]
  } else if (activeDefense === `dodge`) {
    debugger
  } else {
    // ERROR: Unimplemented
    debugger
  }

  if (!highest) return adls

  return orderBy(adls, adl => adl.skill.level + adl.bonus, `desc`)
}

export function activeDefenseFeatures(activeDefense: `block` | `dodge` | `parry` | `all`, actor: GurpsMobileActor): GenericFeature[] {
  const defenses = actor.cache.links?.defenses ?? {}
  const links = defenses[activeDefense] ?? []
  const features = links.map(uuid => actor.cache.features?.[uuid])

  return features
}
