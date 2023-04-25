import { has } from "lodash"
import { GenericSource, IDerivationPipeline, derivation, proxy } from "."
import Feature, { IFeatureData } from ".."
import { MigrationDataObject, OVERWRITE } from "../../../../core/feature/compilation/migration"
import { FEATURE } from "../../../../core/feature/type"
import { GCS } from "../../../../../gurps-extension/types/gcs"
import { IGenericFeatureData } from "./generic"
import WeaponFeatureContextTemplate from "../../../actor-sheet/context/feature/variants/weapon"
import LOGGER from "../../../../logger"

export interface IWeaponizableFeatureData extends IFeatureData {
  weapons: Feature<IFeatureData, GenericSource>[]
}

export const WeaponizableFeaturePipeline: IDerivationPipeline<IWeaponizableFeatureData & IGenericFeatureData> = [
  //
  derivation.gcs(`weapons`, [`weapons`], ({ weapons }, _, { object }) => {
    if (weapons && weapons.length > 0) {
      const factory = object.factory
      const features = [] as Feature<any, never>[]

      for (let index = 0; index < weapons.length ?? 0; index++) {
        const weapon = weapons[index] as any as GCS.Entry

        // ERROR: Pathless parent
        if (object && !object.path) debugger

        const feature = factory
          .build(`weapon`, weapon.id, index, object, {
            context: { templates: [WeaponFeatureContextTemplate] },
          })
          .addSource(`gcs`, weapon, { path: `${object.path}.weapons.${index}` })

        // feature.on(`compile:gcs`, event => {
        //   LOGGER.info(
        //     `WeaponizableFeaturePipeline:compile:gcs`,
        //     event.data.feature.id,
        //     event.data.feature.data.name,
        //     `@`,
        //     event.data.feature.parent.id,
        //     event.data.feature.parent.data.name,
        //     event.data.feature,
        //   )
        // })

        features.push(feature)
      }

      return { weapons: OVERWRITE(`weapons`, features) }
    }

    return {}
  }),
]

WeaponizableFeaturePipeline.name = `WeaponizableFeaturePipeline`
// WeaponizableFeaturePipeline.post = function postWeaponizable(data, object) {
//   const MDO = {} as MigrationDataObject<any>

//   if (has(data, `weapons`) && data.weapons.length > 0) {
//     const factory = object.factory
//     const weapons = [] as Feature<any, never>[]

//     for (let index = 0; index < data.weapons.length ?? 0; index++) {
//       const weapon = data.weapons[index] as any as GCS.Entry

//       debugger
//       const feature = factory
//         .build(`weapon`, weapon.id, index, object, {
//           context: { templates: [WeaponFeatureContextTemplate] },
//         })
//         .addSource(`gcs`, weapon)

//       weapons.push(feature)
//     }

//     MDO.weapons = OVERWRITE(`weapons`, weapons)
//   }

//   return MDO
// }
