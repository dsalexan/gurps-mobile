import { flatten, isNil, uniq } from "lodash"
import { GenericSource, IDerivationPipeline, derivation, proxy } from "."
import { isNilOrEmpty } from "../../../../../december/utils/lodash"
import { ILevelDefinition, parseLevelDefinition } from "../../../../../gurps-extension/utils/level"
import { FALLBACK, MERGE, MigrationDataObject, MigrationValue, OVERWRITE, PUSH, WRITE } from "../../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "./generic"
import { IWeaponizableFeatureData } from "./weaponizable"
import { parseWeight } from "../../../../core/feature/utils"

export interface EquipmentManualSource extends GenericSource {
  carried?: boolean
}

export interface IEquipmentFeatureData extends IGenericFeatureData, IWeaponizableFeatureData {
  description: string
  carried: boolean
  quantity: number
  cost: { base: number | null; extended: string; unit: string }
  weight: { base: number | null; extended: string; unit: string }
  piece: boolean
}

export const EquipmentFeaturePipeline: IDerivationPipeline<IEquipmentFeatureData> = [
  // #region MANUAL
  proxy.manual(`carried`),
  // #endregion
  // #region GCS
  derivation.gcs(`description`, [`description`, `piece`], ({ description }) => {
    const _piece = description?.match(/(\w+) +piece/i)
    if (!_piece) return { description }

    return { description, piece: true }
  }),
  derivation.gcs(`name`, `name`, ({ name }) => ({ name })),
  derivation.gcs(`label`, `label`, ({ label }) => ({ label })),
  derivation.gcs(`quantity`, `quantity`, ({ quantity }) => ({ quantity: quantity ?? 1 })),
  derivation.gcs([`value`, `weight`, `calc`], [`cost`, `weight`], ({ value, weight: _weight, calc }) => {
    const cost = value ?? null
    const weight = parseWeight(_weight ?? null)

    return {
      cost: MERGE(`cost`, {
        base: isNil(cost) ? null : parseFloat(cost),
        extend: calc?.extended_value ?? null,
        unit: `unknown`,
      }),
      weight: MERGE(`weight`, {
        base: weight,
        extend: parseWeight(calc?.extended_weight ?? null),
        unit: `kg`,
      }),
    }
  }),
  // #endregion
  // #region GCA
  // derivation.gca(`name`, [], function (source) {
  //   debugger

  //   // if it is named like a coin piece
  //   if (_piece) {
  //     const metal = _piece[1].toLowerCase()

  //     // jerry rig it to a pre-assembled gca entry
  //     const changedSource = {
  //       basecost: {
  //         copper: 1,
  //         silver: 10,
  //         gold: 200,
  //         platinum: 2000,
  //       }[metal],
  //       baseweight: 0.004,
  //       name: `${metal[0].toUpperCase()}${metal.substring(1)} Piece`,
  //       piece: true,
  //     }

  //     // ERROR: Context missing feature id
  //     if (!this.id) debugger

  //     // eslint-disable-next-line no-undef
  //     GCA.setCache(this.id, source)
  //   }

  //   return {}
  // }),
  // #endregion
  // #region FEATURE
  derivation<keyof IEquipmentFeatureData, any, IEquipmentFeatureData>([`quantity`, `cost`, `weight`], [`cost`, `weight`], function (_, __, { object }) {
    const { quantity, cost, weight } = object.data

    return {
      cost: MERGE(`cost`, {
        extended: isNil(cost.base) ? null : quantity * cost.base,
      }),
      weight: MERGE(`weight`, {
        extended: isNil(weight.base) ? null : quantity * weight.base,
      }),
    }
  }),
  // #endregion
]

EquipmentFeaturePipeline.name = `EquipmentFeaturePipeline`
// EquipmentFeaturePipeline.conflict = {
// attribute: function genericConflictResolution(migrations: MigrationValue<any>[]) {
//   const attributes = flatten(Object.values(migrations)).map(migration => (migration.value as string).toUpperCase())
//   const uniqueAttributes = uniq(attributes)
//   if (uniqueAttributes.length === 1) return { attribute: Object.values(migrations)[0] }
//   else {
//     // ERROR: Too many different attributes
//     // eslint-disable-next-line no-debugger
//     debugger
//   }
// },
// }

EquipmentFeaturePipeline.post = function postEquipment(data) {
  const MDO = {} as MigrationDataObject<any>

  debugger
  if (data.has(`description`)) {
    const description = data.get(`description`)
    const name = data.get(`name`)
    if (description && !name) {
      MDO.name = FALLBACK(`name`, description)
    }
  }

  return MDO
}
