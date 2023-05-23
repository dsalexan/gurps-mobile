import { String, flatten, isEmpty, isNil, uniq } from "lodash"
import { GenericSource, IDerivationPipeline, derivation, proxy } from ".."
import { isNilOrEmpty } from "../../../../../../december/utils/lodash"
import { ILevelDefinition, parseLevelDefinition } from "../../../../../../gurps-extension/utils/level"
import { FALLBACK, MigrationDataObject, MigrationValue, OVERWRITE, PUSH, WRITE } from "../../../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "../generic"
import { IFeatureData } from "../.."
import { IBase } from "../../../../../../gurps-extension/utils/base"
import FeatureUsage from "../../usage"
import { IFeatureUsageData, IHit, IHitRollToHit, IHitTargetMelee, IHitTargetRanged, IUsageEffectDamage, IUse, UsageType } from "./usage"
import GenericFeature from "../../generic"
import LOGGER from "../../../../../logger"

export const FeatureRangedUsagePipeline: IDerivationPipeline<IFeatureUsageData> = [
  // #region MANUAL
  // #endregion
  // #region GCS
  derivation.gcs(
    [`type`, `defaults`, `range`, `accuracy`, `rate_of_fire`, `recoil`],
    [`use`, `hit`, `tags`],
    ({ type, defaults, range, accuracy, rate_of_fire, recoil }, __, { object }) => {
      const use: IUse = { rule: `automatic` }

      if (object.parent) {
        // TODO: Detect "use" based on parent (weapons usually are automatic, but spells and advantages are not)
        if (object.parent.type.compare(`advantage`) || object.parent.type.compare(`spell`)) {
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

      // TODO: detect affliction/resist through modifiers
      if (defaults) hit.rolls = defaults.map(_default => parseLevelDefinition(_default))
      // if (damage) hit.success.push({ rule: `damage`, damage: damage } as IUsageEffectDamage)

      if (range || accuracy || rate_of_fire || recoil) {
        const target = { rule: `ranged` } as IHitTargetRanged
        target.range = range as string
        if (accuracy) target.accuracy = parseInt(accuracy as string)
        if (rate_of_fire) target.rof = rate_of_fire as string
        if (recoil) target.recoil = recoil as string

        // ERROR: Untested
        if (!isNil(target.accuracy) && isNaN(target.accuracy)) debugger

        hit.target = target
      }

      // ERROR: Cannotbe
      if (isNil(hit.target)) debugger

      // TODO: Detect affliction
      return { type: usageType, use, hit, tags: PUSH(`tags`, `attack`) }
    },
  ),
  // #endregion
  // #region GCA

  // #endregion
  // #region DATA
  // #endregion
]

FeatureRangedUsagePipeline.name = `FeatureRangedUsagePipeline`
// FeatureRangedUsagePipeline.conflict = {
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

FeatureRangedUsagePipeline.post = function postMeleeUsage(data) {
  const MDO = {} as MigrationDataObject<any>

  return MDO
}
