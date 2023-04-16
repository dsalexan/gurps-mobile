import { has } from "lodash"
import { GenericSource, IDerivationPipeline, derivation, proxy } from "."
import Feature, { IFeatureData } from ".."
import { MigrationDataObject, OVERWRITE } from "../../../../core/feature/compilation/migration"
import { FEATURE } from "../../../../core/feature/type"
import { GCS } from "../../../../../gurps-extension/types/gcs"
import { IGenericFeatureData } from "./generic"

export interface IWeaponizableFeatureData extends IFeatureData {
  weapons: Feature<IFeatureData, GenericSource>[]
}

export const WeaponizableFeaturePipeline: IDerivationPipeline<IWeaponizableFeatureData & IGenericFeatureData> = [
  //
  proxy.gcs(`weapons`, []),
]

WeaponizableFeaturePipeline.name = `WeaponizableFeaturePipeline`
WeaponizableFeaturePipeline.post = function postWeaponizable({ data }, object) {
  const MDO = {} as MigrationDataObject<any>

  if (has(data, `weapons`) && data.weapons.length > 0 && false) {
    const factory = object.factory
    const weapons = [] as Feature<any, never>[]

    for (let index = 0; index < data.weapons.length ?? 0; index++) {
      const weapon = data.weapons[index] as any as GCS.Entry

      const feature = factory
        .build(`weapon`, weapon.id, index, object, {
          context: { templates: [] }, // WeaponFeatureContextTemplate
        })
        .addPipeline<IGenericFeatureData>([
          // TODO: Move this type into a weapon pipeline, wtf man
          // derivation.gcs(`type`, `type`, ({ type }) => {
          //   let weaponType = FEATURE.MELEE_WEAPON
          //   if (type === `ranged_weapon`) weaponType = FEATURE.RANGED_WEAPON
          //   return { type: weaponType }
          // }),
          //
          derivation.gcs([`name`, `description`, `usage`], `name`, ({ name, description, usage }) => {
            return { name: name ?? description ?? usage ?? `Unnamed Weapon` }
          }),
        ])
        .addSource(`gcs`, weapon)

      debugger
      weapons.push(feature)
    }

    MDO.weapons = OVERWRITE(`weapons`, weapons)
  }

  return MDO
}
