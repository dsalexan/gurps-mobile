import { IDerivationPipeline } from "."
import { MigrationDataObject } from "../../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "./generic"
import { IWeaponizableFeatureData } from "./weaponizable"

export interface PLACEHOLDERNAMEFeatureData extends IGenericFeatureData, IWeaponizableFeatureData {
  property1: never
}

export const PLACEHOLDERNAMEFeaturePipeline: IDerivationPipeline<PLACEHOLDERNAMEFeatureData> = [
  // #region GCS
  // #endregion
  // #region GCA
  // #endregion
]

PLACEHOLDERNAMEFeaturePipeline.name = `PLACEHOLDERNAMEFeaturePipeline`
PLACEHOLDERNAMEFeaturePipeline.conflict = {}

PLACEHOLDERNAMEFeaturePipeline.post = function postPLACEHOLDERNAME({ data }) {
  const MDO = {} as MigrationDataObject<any>

  return MDO
}
