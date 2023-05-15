import { flatten, flattenDeep, get, has, isArray, isNil, omit } from "lodash"
import { FEATURE, Type } from "../../type"
import { MigrationValue, MigrationDataObject, FastMigrationDataObject, isOrigin, OVERWRITE, WRITE, PUSH, MigratableObject } from "../migration"
import CompilationTemplate, { CompilationContext, GURPSSources } from "../template"
import { GCS } from "../../../../../gurps-extension/types/gcs"
import { typeFromGCA, typeFromGCS } from "../../utils"
import { isNilOrEmpty } from "../../../../../december/utils/lodash"
import { GCA } from "../../../gca/types"
import { GenericFeatureCompilationContext } from "./generic"
import BaseFeature, { FeatureTemplate, IFeature } from "../../base"
import FeatureFactory from "../../factory"
import WeaponFeature from "../../variants/weapon"
import WeaponFeatureContextTemplate from "../../../../foundry/actor-sheet/context/feature/variants/usage"

export interface IWeaponizableFeature {
  weapons: WeaponFeature[]
}

export default class WeaponizableFeatureCompilationTemplate extends CompilationTemplate {
  static gcs(GCS: GCS.Entry, context: GenericFeatureCompilationContext): FastMigrationDataObject<any> | null {
    return {
      weapons: get(GCS, `weapons`, []),
    }
  }

  static post(
    data: MigratableObject & IFeature & IWeaponizableFeature,
    context: CompilationContext,
    sources: Record<string, object>,
    object: BaseFeature,
  ): FastMigrationDataObject<any> | null {
    const MDO = {} as FastMigrationDataObject<any>

    if (has(data, `weapons`)) {
      const weapons = [] as BaseFeature[]
      for (let index = 0; index < data.weapons.length ?? 0; index++) {
        const weapon = data.weapons[index]
        // const baseWeaponTemplate = template.weapons
        // // @ts-ignore
        // const weaponTemplate: FeatureTemplate<any> = {
        //   ...omit(baseWeaponTemplate ?? {}, [`manual`]),
        //   manual: {
        //     ...(baseWeaponTemplate?.manual ?? {}),
        //     type: weapon.type,
        //     name: sources.gcs?.name ?? sources.gcs?.description ?? `Unnamed Weapon`,
        //   },
        // }
        const weaponTemplate: FeatureTemplate<any> = {
          context: { templates: WeaponFeatureContextTemplate },
          manual: {
            type: ({ gcs }: GURPSSources) => {
              if (gcs.type === `ranged_weapon`) return FEATURE.RANGED_WEAPON
              return FEATURE.MELEE_WEAPON
            },
            name: ({ gcs }: GURPSSources) => {
              return gcs?.name ?? gcs?.description ?? gcs.usage ?? `Unnamed Weapon`
            },
          },
        }

        const factory = object.__compilation.factory

        const feature = factory.build(`weapon`, index, `${object.path ?? ``}.weapons.`, object, weaponTemplate)
        feature.addSource(`gcs`, weapon)
        feature.compile()

        weapons.push(feature)
      }

      MDO.weapons = OVERWRITE(`weapons`, weapons)
    }

    return MDO
  }
}
