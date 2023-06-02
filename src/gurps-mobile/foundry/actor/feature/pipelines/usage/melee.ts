import { String, flatten, isEmpty, isNil, uniq } from "lodash"
import { GenericSource, IDerivationPipeline, derivation, proxy } from ".."
import { isNilOrEmpty } from "../../../../../../december/utils/lodash"
import { ILevelDefinition, parseLevelDefinition } from "../../../../../../gurps-extension/utils/level"
import { FALLBACK, MigrationDataObject, MigrationValue, OVERWRITE, PUSH, WRITE } from "../../../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "../generic"
import { IFeatureData } from "../.."
import { IBase } from "../../../../../../gurps-extension/utils/base"
import FeatureUsage from "../../usage"
import { IFeatureUsageData, IHit, IHitRollToHit, IHitTargetMelee, IUsageEffectDamage, IUse, UsageType } from "./usage"
import GenericFeature from "../../generic"
import LOGGER from "../../../../../logger"

export const FeatureMeleeUsagePipeline: IDerivationPipeline<IFeatureUsageData> = [
  // #region MANUAL
  // #endregion
  // #region GCS
  derivation.gcs([`type`, `defaults`, `reach`], [`use`, `hit`, `tags`], ({ type, defaults, reach }, __, { object }) => {
    const use: IUse = { rule: `automatic` }

    if (object.parent) {
      // TODO: Detect "use" based on parent (weapons usually are automatic, but spells and advantages are not)
      if (object.parent.type.compare(`generic_advantage`, false) || object.parent.type.compare(`spell`, false)) {
        LOGGER.error(`Deal with advantage/spell on usage pipeline`)
      }
    }

    const usageType: UsageType = `attack`
    const hit: IHitRollToHit = {
      rule: `roll_to_hit`,
      target: undefined,
      success: [],
      //
    }

    if (defaults) hit.rolls = defaults.map(_default => parseLevelDefinition(_default))
    // if (damage) hit.success.push({ rule: `damage`, damage: damage } as IUsageEffectDamage)

    if (reach) {
      const _reach = reach.split(`,`)
      if (_reach.length > 0) hit.target = { rule: `melee`, reach: _reach } as IHitTargetMelee
    }

    // ERROR: Cannotbe
    if (isNil(hit.target)) debugger

    // TODO: Detect affliction
    return { type: usageType, use, hit, tags: PUSH(`tags`, `attack`) }
  }),
  // #endregion
  // #region GCA

  // #endregion
  // #region DATA
  // #endregion
]

FeatureMeleeUsagePipeline.name = `FeatureMeleeUsagePipeline`
// FeatureMeleeUsagePipeline.conflict = {
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

FeatureMeleeUsagePipeline.post = function postMeleeUsage(data) {
  const MDO = {} as MigrationDataObject<any>

  return MDO
}
