import { has, isEmpty, isNil } from "lodash"
import { GenericSource, IDerivationPipeline, derivation, proxy } from "."
import Feature, { IFeatureData } from ".."
import { FALLBACK, MigrationDataObject, OVERWRITE } from "../../../../core/feature/compilation/migration"
import { FEATURE } from "../../../../core/feature/type"
import { GCS } from "../../../../../gurps-extension/types/gcs"
import { IGenericFeatureData } from "./generic"
import WeaponFeatureContextTemplate from "../../../actor-sheet/context/feature/variants/weapon"
import LOGGER from "../../../../logger"
import { push } from "../../../../../december/utils/lodash"

export interface IWeaponizableFeatureData extends IFeatureData {
  weapons: Feature<IFeatureData, GenericSource>[]
}

export const WeaponizableFeaturePipeline: IDerivationPipeline<IWeaponizableFeatureData & IGenericFeatureData> = [
  //
  derivation.gcs(`weapons`, [`weapons`], ({ weapons }, _, { object }) => {
    if (weapons && weapons.length > 0) {
      const factory = object.factory

      const features = [] as Feature<any, never>[]
      const activeDefense = {} as Record<`block` | `parry` | `dodge`, string[]>

      for (let index = 0; index < weapons.length ?? 0; index++) {
        const weapon = weapons[index] as any as GCS.Entry

        // GCS fallback for active defense formulas (in case there is no suitable GCA match for feature)
        const defenses = [`block`, `parry`, `dodge`] as const
        for (const defense of defenses) {
          const value = weapon[defense]
          if (!isNil(value) && value !== `No` && value !== `-`) {
            // ERROR: Untested
            if (isEmpty(value)) debugger
            push(activeDefense, defense, Symbol.for(`DEFAULT`))
          }
        }

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

      const obj = { weapons: OVERWRITE(`weapons`, features) } as any
      if (Object.keys(activeDefense).length > 0) obj.activeDefense = FALLBACK(`activeDefense`, activeDefense)

      return obj
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
