import { isNil } from "lodash"
import { GenericSource, IDerivationPipeline, derivation, proxy } from "."
import { IFeatureData } from ".."
import { MigrationDataObject, OVERWRITE } from "../../../../core/feature/compilation/migration"
import DefenseFeature from "../defense"
import { IGenericFeatureData } from "./generic"
import { IUsableFeatureData } from "./usable"
import FeatureUsage from "../usage"

export interface IDefenseFeatureData extends IGenericFeatureData, IUsableFeatureData {
  container: true

  activeDefense: `block` | `dodge` | `parry`
  features: string[] // Feature.id[]
}

export const DefenseFeaturePipeline: IDerivationPipeline<IDefenseFeatureData, GenericSource> = [
  // #region MANUAL
  proxy.manual(`activeDefense`),
  proxy.manual(`name`),
  // #endregion
  // #region GCS
  // #endregion
  // #region GCA
  // #endregion
  // #region DATA
  derivation([`actor`, `activeDefense`], [`usages`], function (_, __, { object }: { object: DefenseFeature }) {
    const actor = object.actor
    const activeDefense = object.data.activeDefense

    if (!actor || isNil(activeDefense)) debugger

    // get all defense capable features and cache them

    const allFeatures = Object.values(actor.cache.features ?? {})
    const defenseCapable = allFeatures.filter(feature => feature.data.usages?.some(usage => usage.data.type === `defense` && usage.data.tags.includes(activeDefense)))
    const features = defenseCapable.map(feature => feature.id)

    return { features: OVERWRITE(`features`, features) }
  }),
  // #endregion
]

DefenseFeaturePipeline.name = `DefenseFeaturePipeline`
// DefenseFeaturePipeline.conflict = {
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

DefenseFeaturePipeline.post = function postWeapon(data) {
  const MDO = {} as MigrationDataObject<any>

  return MDO
}
