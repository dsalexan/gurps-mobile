import { String, flatten, intersection, isEmpty, isNil, orderBy, uniq } from "lodash"
import { GenericSource, IDerivationPipeline, derivation, proxy } from ".."
import { isNilOrEmpty } from "../../../../../../december/utils/lodash"
import {
  ILevel,
  ILevelDefinition,
  calculateLevel,
  nonSkillVariables,
  allowedSkillVariables,
  parseLevelDefinition,
  viabilityTest,
} from "../../../../../../gurps-extension/utils/level"
import { FALLBACK, MigrationDataObject, MigrationValue, OVERWRITE, PUSH, WRITE } from "../../../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "../generic"
import { IFeatureData } from "../.."
import { IBase } from "../../../../../../gurps-extension/utils/base"
import FeatureUsage from "../../usage"
import LOGGER from "../../../../../logger"
import { GurpsMobileActor } from "../../../actor"
import GenericFeature from "../../generic"

export type ArrayElement<ArrayType extends readonly unknown[]> = ArrayType extends readonly (infer ElementType)[] ? ElementType : never

export type UsageManualSource = GenericSource

// #region USE

export interface IUseBase {
  rule: `automatic` | `roll_to_use` | `trigger`
  /**
   * automatic: no roll to use feature, most things, any weapon (actually a weapon should be "ready", but fuck that), "always on" limitation
   * roll_to_use: roll to use feature, switchable, cast a spell, activate something, skills for everyone
   * trigger: requires a trigger, something to happen to use the feature (active defense is a good example, but it is automatic for now)
   */
  requirements?: {
    minimumStrength?: number
  }

  // below is a more generic approach for USE SUCCESS, for now it is not necessary since failure was not modeled
  // success: IUsageHit
  // failure: never
}

export interface IUseAutomatic extends IUseBase {
  rule: `automatic`
}

export interface IUseRollToUse extends IUseBase {
  rule: `roll_to_use`
  rolls: ILevelDefinition[]
  levels: ILevel[]
}

export interface IUseTrigger extends IUseBase {
  rule: `trigger`
  triggers: never[] // TODO: Implement triggers
}

export type IUse = IUseAutomatic | IUseRollToUse | IUseTrigger

// #endregion

// #region HIT

export interface IHitBase {
  rule: `automatic` | `roll_to_hit` | `roll_to_resist`
  /**
   * roll_to_hit: owner roll to hit a target, most attacks
   * roll_to_resist: target rolls to resist hit, most afflictions
   */
  target: IHitTarget | null
  success: IUsageEffect[]
  failure?: IUsageEffect[]
}

export interface IHitAutomatic extends IHitBase {
  rule: `automatic`
}

export interface IHitRollToHit extends IHitBase {
  rule: `roll_to_hit`
  //
  rolls: ILevelDefinition[]
  levels: ILevel[]
  // any defense modifier (or attack modifier) is injected into roll definition (that standardizes the treatment of variables on printing definitions)
}

export interface IHitRollToResist extends IHitBase {
  rule: `roll_to_resist`
  //
  rolls: ILevelDefinition[]
  levels: ILevel[]
}

export type IHit = IHitAutomatic | IHitRollToHit | IHitRollToResist

// #endregion

// #region EFFECT (DAMAGE)

export interface IUsageEffectBase {
  target: IHitTargetBase | null
  rule: `damage`
}

export interface IUsageEffectDamage extends IUsageEffectBase {
  rule: `damage`
  //
  damage: { type: string; definition: ILevelDefinition }
}

export type IUsageEffect = IUsageEffectDamage

// #endregion

// #region TARGET

export interface IHitTargetBase {
  rule: `self` | `melee` | `ranged`
}

export interface IHitTargetSelf extends IHitTargetBase {
  rule: `self`
}

export interface IHitTargetMelee extends IHitTargetBase {
  rule: `melee`
  //
  reach: string[]
}

export interface IHitTargetRanged extends IHitTargetBase {
  rule: `ranged`
  //
  range: string
  accuracy: number
  rof: string
  recoil: string
}

export type IHitTarget = IHitTargetSelf | IHitTargetMelee | IHitTargetRanged

// #endregion

export const UsageDefenseTags = [`block`, `dodge`, `parry`] as const
export const UsageDamageTags = [`damage`] as const

export type UsageType = `attack` | `affliction` | `defense`

export type IUsageTag = ArrayElement<typeof UsageDefenseTags | typeof UsageDamageTags>

export function getUsageType(usage: IFeatureUsageData) {
  let tags = [] as (`defense` | `unknown`)[]
  let name: string = undefined as any as string
  let icon: string | undefined

  // if (usage.use.rule === `automatic`) {
  //   // pass
  // } else {
  //   debugger
  // }

  // if (usage.hit.rule === `automatic`) {
  //   // pass
  // } else if (usage.hit.rule === `roll_to_hit`) {
  //   debugger
  // } else if (usage.hit.rule === `roll_to_resist`) {
  //   debugger
  // }

  // if (usage.hit.target) {
  //   if (usage.hit.target.rule === `self`) {
  //     debugger
  //   } else if (usage.hit.target.rule === `melee`) {
  //     debugger
  //   } else if (usage.hit.target.rule === `ranged`) {
  //     debugger
  //   } else {
  //     debugger
  //   }
  // } else {
  //   debugger
  // }

  // if (usage.hit.success) {
  //   debugger
  // } else {
  //   debugger
  // }

  // if (usage.hit.failure) {
  //   debugger
  // }

  const defenses = intersection(usage.tags, [`block`, `dodge`, `parry`])
  if (defenses.length > 0) {
    if (defenses.length > 1) debugger

    tags.push(`defense`)
    name = `Active Defense`
  }

  // ERROR: Unimplemented
  if (!name) debugger

  return { tags, name, icon }
}

export interface IFeatureUsageData extends IFeatureData {
  type: UsageType
  label: string
  tags: IUsageTag[] // general purpose tags for easier filtering
  //
  use: IUse
  hit: IHit
}

export const FeatureUsagePipeline: IDerivationPipeline<IFeatureUsageData> = [
  // #region MANUAL
  derivation.manual(`tags`, `tags`, ({ tags }) => {
    if (isNilOrEmpty(tags)) return {}
    return { tags: PUSH(`tags`, tags) }
  }),
  // derivation.manual([`shadow`], [`label`], ({ shadow }, __, { object }) => {
  //   if (shadow !== true) return {}

  //   const parent = object.parent
  //   if (!parent) return {}

  //   debugger
  //   const label = parent.data.name

  //   return { label: FALLBACK(`label`, label) }
  // }),
  // #endregion
  // #region GCS
  //    base
  derivation.gcs(`usage`, `label`, ({ usage }) => {
    if (isNilOrEmpty(usage)) return {}
    return { label: usage }
  }),
  derivation.gcs(`strength`, [`requirements.minimumStrength`], ({ strength }) => {
    if (strength === `-` || strength === ``) return {}

    const value = parseInt(strength)
    if (isNaN(value)) return {}

    return { "requirements.minimumStrength": value }
  }) as any,
  // derivation.gcs(`defaults`, [`rolls`], ({ defaults }) => {
  //   if (defaults) return { rolls: defaults.map(_default => parseLevelDefinition(_default)) }
  //   return {}
  // }),
  // //    defense
  // derivation.gcs([`block`, `dodge`, `parry`], [`activeDefense`], gcs => {
  //   const activeDefense = {} as { block?: string | false; dodge?: string | false; parry?: string | false }

  //   const defenses = [`block`, `parry`, `dodge`]
  //   for (const defense of defenses) {
  //     const value = gcs[defense]

  //     if (value === `No` || value === `-` || isEmpty(value)) activeDefense[defense] = false
  //     else activeDefense[defense] = value
  //   }

  //   if (Object.keys(activeDefense).length === 0) return {}
  //   return { activeDefense: activeDefense }
  // }),
  // //    resistable
  // derivation.gcs(`resist`, [`resist`], ({ resist }) => {
  //   if (isNil(resist)) return {}

  //   debugger
  //   // if (resist) return { rolls: defaults.map(_default => parseLevelDefinition(_default)) }
  //   return {}
  // }),
  // // weapon
  // derivation.gcs(`strength`, [`minimumStrength`], ({ strength }) => {
  //   if (strength === `-` || strength === ``) return {}

  //   const value = parseInt(strength)
  //   if (isNaN(value)) return {}

  //   return { minimumStrength: value }
  // }),
  // proxy.gcs(`damage`),
  // derivation.gcs(`type`, [`weapon`], ({ type }) => {
  //   if (type === `melee_weapon`) return { weapon: `melee` }
  //   if (type === `ranged_weapon`) return { weapon: `ranged` }

  //   debugger

  //   return {}
  // }),
  // //    melee
  // derivation.gcs(`reach`, [`reach`], ({ reach }) => {
  //   if (isNilOrEmpty(reach)) return {}

  //   let _reach = reach.split(`,`)
  //   if (_reach.length === 0) return {}

  //   return { reach: _reach }
  // }),
  // //    ranged
  // proxy.gcs(`range`),
  // derivation.gcs(`accuracy`, [`accuracy`], ({ accuracy }) => {
  //   if (isNilOrEmpty(accuracy)) return {}

  //   const value = parseInt(accuracy)

  //   if (isNaN(value)) debugger

  //   return { accuracy: value }
  // }),
  // proxy.gcs(`rate_of_fire`, `rof`),
  // proxy.gcs(`recoil`),
  // #endregion
  // #region GCA

  // #endregion
  // // #region DATA
  // derivation([`actor`, `rolls`], [`bases`], function (_, __, { object }: { object: FeatureUsage }) {
  //   // usages:compiled is not on derivation because rolls are already derived from it
  //   const { rolls } = object.data

  //   const actor = object.actor

  //   if (!actor || !rolls) return {}

  //   debugger
  // }),
  derivation([`use.rolls`], [`use.levels`], function (_, __, { object, utils }: { object: FeatureUsage; utils: { knownSkills: number[] } }) {
    const feature = object.parent
    const actor = feature.actor as GurpsMobileActor

    if (object.data.use.rule !== `roll_to_use`) return {}
    debugger

    const rolls = object.data.use.rolls

    // ERROR: Unimplemented
    if (isNil(rolls)) debugger

    const levels = rolls.map(definition => {
      const viability = viabilityTest(definition, [nonSkillVariables, allowedSkillVariables], { allowedSkillList: utils.knownSkills })

      if (viability.viable) return calculateLevel(definition, feature, actor)
      return { value: null, definition }
    })
    const orderedLevels = orderBy(levels, def => def?.value ?? -Infinity, `desc`)

    debugger

    return { "use.levels": OVERWRITE(`use.levels`, orderedLevels) }
  }),
  derivation([`hit.rolls`], [`hit.levels`], function (_, __, { object, utils }: { object: FeatureUsage; utils: { knownSkills: number[] } }) {
    const feature = object.parent
    const actor = feature.actor as GurpsMobileActor

    if (object.data.hit.rule !== `roll_to_hit` && object.data.hit.rule !== `roll_to_resist`) return {}

    const rolls = object.data.hit.rolls

    // ERROR: Unimplemented
    if (isNil(rolls)) {
      LOGGER.error(`Missing "rolls" in ${object.data.hit.rule} usage`, object.data, object)
      return {}
    }

    const levels = rolls.map(definition => {
      const viability = viabilityTest(definition, [nonSkillVariables, allowedSkillVariables], { allowedSkillList: utils.knownSkills })

      if (viability.viable) return calculateLevel(definition, feature, actor)
      return { value: null, definition, viability }
    })
    const orderedLevels = orderBy(levels, def => def?.value ?? -Infinity, `desc`)

    return { "hit.levels": OVERWRITE(`hit.levels`, orderedLevels) }
  }),
  // // #endregion
]

FeatureUsagePipeline.name = `FeatureUsagePipeline`
// FeatureUsagePipeline.conflict = {
//   attribute: function genericConflictResolution(migrations: MigrationValue<any>[]) {
//     const attributes = flatten(Object.values(migrations)).map(migration => (migration.value as string).toUpperCase())
//     const uniqueAttributes = uniq(attributes)
//     if (uniqueAttributes.length === 1) return { attribute: Object.values(migrations)[0] }
//     else {
//       // ERROR: Too many different attributes
//       // eslint-disable-next-line no-debugger
//       debugger
//     }
//   },
// }

FeatureUsagePipeline.utils = function utilsUsage(utils, object) {
  const actor = object.actor

  if (!actor) debugger

  // GET ALL TRAINED SKILLS
  const _knownSkills = actor.getSkills(`known`)
  const knownSkills = _knownSkills.map(feature => feature.sources.gca?._index).filter(index => !isNil(index))

  utils._knownSkills = _knownSkills
  utils.knownSkills = knownSkills
}

FeatureUsagePipeline.post = function postUsage(data) {
  const MDO = {} as MigrationDataObject<any>

  // ERROR: No name
  if (isNilOrEmpty(data.get(`label`))) LOGGER.error(`LACKING LABEL`)

  // ERROR: No Use
  if (isNilOrEmpty(data.get(`use.rule`))) debugger

  return MDO
}
