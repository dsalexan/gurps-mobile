import { String, flatten, isEmpty, isNil, uniq } from "lodash"
import { GenericSource, IDerivationPipeline, derivation, proxy } from ".."
import { isNilOrEmpty } from "../../../../../../december/utils/lodash"
import { ILevelDefinition, IVariable, createLevelDefinition, createVariable, parseLevelDefinition } from "../../../../../../gurps-extension/utils/level"
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

    const modifier = !isNil(damage.base) ? parseInt(damage.base) : undefined
    const base = damage.st as any as `thr` | `sw`
    const type = damage.type as any as string

    const variables = {} as Record<string, IVariable<string>>

    const expression = [] as string[]

    if (!isNilOrEmpty(base)) {
      expression.push(`∂ST`)
      variables.ST = createVariable(`ST`, `attribute`, base, { label: base })
    }

    if (!isNil(modifier)) {
      expression.push(`∂MODIFIER`)
      variables.MODIFIER = createVariable(`MODIFIER`, `constant`, modifier)
    }

    const definition = createLevelDefinition(expression.join(` + `), variables)

    effect.damage = { definition, type }

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
