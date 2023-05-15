import { String, flatten, isEmpty, isNil, uniq } from "lodash"
import { GenericSource, IDerivationPipeline, derivation, proxy } from ".."
import { isNilOrEmpty } from "../../../../../../december/utils/lodash"
import { ILevelDefinition, parseLevelDefinition } from "../../../../../../gurps-extension/utils/level"
import { FALLBACK, MigrationDataObject, MigrationValue, OVERWRITE, PUSH, WRITE } from "../../../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "../generic"
import { IFeatureData } from "../.."
import { IBase } from "../../../../../../gurps-extension/utils/base"
import FeatureUsage from "../../usage"
import { IFeatureUsageData, IHit, IHitRollToHit, IHitTargetMelee, IHitTargetRanged, IUsageEffectDamage, IUse } from "./usage"
import GenericFeature from "../../generic"
import LOGGER from "../../../../../logger"

export const FeatureDamageUsagePipeline: IDerivationPipeline<IFeatureUsageData> = [
  // #region MANUAL
  // #endregion
  // #region GCS
  derivation.gcs([`damage`], [`hit.success`, `tags`], ({ damage }, __, { object }) => {
    const effect = {} as IUsageEffectDamage

    effect.rule = `damage`
    effect.damage = damage as any

    if (isNil(effect.damage)) return {}

    return { "hit.success": PUSH(`hit.success`, effect), tags: PUSH(`tags`, `damage`) }
  }) as any,
  // #endregion
  // #region GCA

  // #endregion
  // #region DATA
  // TODO: Implement weapon_bonus
  // #endregion
]

FeatureDamageUsagePipeline.name = `FeatureDamageUsagePipeline`
// FeatureDamageUsagePipeline.conflict = {
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

FeatureDamageUsagePipeline.post = function postMeleeUsage(data) {
  const MDO = {} as MigrationDataObject<any>

  return MDO
}
