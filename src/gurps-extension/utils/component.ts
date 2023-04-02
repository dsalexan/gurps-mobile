import { GCS } from "../types/gcs"
import GenericFeature from "../../gurps-mobile/core/feature/variants/generic"
import Feature, { IFeatureData } from "../../gurps-mobile/foundry/actor/feature"

export interface IComponentDefinition {
  feature: Feature<IFeatureData, any>
  type: string
  attribute?: string
  amount?: number
  //
}

export interface ISkillBonusComponent extends IComponentDefinition {
  type: `skill_bonus`
  selection_type: string
  name: {
    compare: string
    qualifier: string
  }
}

export function parseComponentDefinition(raw: GCS.Feature) {
  return raw as IComponentDefinition
}

export function compareComponent(component: ISkillBonusComponent, feature: GenericFeature) {
  if (component.type === `skill_bonus`) {
    if (component.selection_type === `skills_with_name`) {
      const { compare, qualifier } = component.name

      if ([`is`, `starts_with`].includes(compare)) {
        const prefix = compare === `is` || compare === `starts_with` ? `^` : ``
        const suffix = compare === `is` ? `$` : ``

        return !!feature.name.match(new RegExp(`${prefix}${qualifier}${suffix}`, `i`))
      } else debugger
    } else debugger
  }

  return false
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
