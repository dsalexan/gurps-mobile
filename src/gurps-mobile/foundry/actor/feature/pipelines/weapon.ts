import { flatten, isEmpty, isNil, uniq } from "lodash"
import { GenericSource, IDerivationPipeline, derivation, proxy } from "."
import { isNilOrEmpty } from "../../../../../december/utils/lodash"
import { parseLevelDefinition } from "../../../../../gurps-extension/utils/level"
import { FALLBACK, MigrationDataObject, MigrationValue, OVERWRITE, PUSH, WRITE } from "../../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "./generic"
import { IWeaponizableFeatureData } from "./weaponizable"

export type WeaponManualSource = GenericSource

export interface IWeaponFeatureData extends IGenericFeatureData, IWeaponizableFeatureData {
  usage: string
  // weapon
  block: string | false
  parry: string | false
  damage: { base: string; type: string }
  strength: number
  // melee
  reach: string[]
  // ranged
  range: string
  accuracy: number
  rof: string
  recoil: string
}

export const WeaponFeaturePipeline: IDerivationPipeline<IWeaponFeatureData> = [
  // #region MANUAL
  // #endregion
  // #region GCS
  derivation.gcs([`name`, `description`, `usage`], `name`, ({ name, description, usage }) => {
    return { name: name ?? description ?? usage ?? `Unnamed Weapon` }
  }),
  derivation.gcs(`defaults`, [`defaults`], ({ defaults }) => {
    if (defaults) return { defaults: defaults.map(_default => parseLevelDefinition(_default)) }
    return {}
  }),
  derivation.gcs(`block`, [`block`], ({ block }) => ({ block: block === `No` || block === `-` || isEmpty(block) ? false : block })),
  derivation.gcs(`parry`, [`parry`], ({ parry }) => ({ parry: parry === `No` || parry === `-` ? false : parry })),
  derivation.gcs(`strength`, [`strength`], ({ strength }) => {
    if (strength === `-` || strength === ``) return {}

    const value = parseInt(strength)
    if (isNaN(value)) return {}

    return { strength: value }
  }),
  //
  proxy.gcs(`damage`),
  proxy.gcs(`range`),
  proxy.gcs(`usage`),
  //
  derivation.gcs(`accuracy`, [`accuracy`], ({ accuracy }) => {
    if (isNilOrEmpty(accuracy)) return {}

    const value = parseInt(accuracy)

    if (isNaN(value)) debugger

    return { accuracy: value }
  }),
  derivation.gcs(`reach`, [`reach`], ({ reach }) => {
    if (isNilOrEmpty(reach)) return {}

    let _reach = reach.split(`,`)
    if (_reach.length === 0) return {}

    return { reach: _reach }
  }),
  proxy.gcs(`rate_of_fire`, `rof`),
  proxy.gcs(`recoil`),
  // #endregion
  // #region GCA

  // #endregion
]

WeaponFeaturePipeline.name = `WeaponFeaturePipeline`
// WeaponFeaturePipeline.conflict = {
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

WeaponFeaturePipeline.post = function postWeapon(data) {
  const MDO = {} as MigrationDataObject<any>

  if (!isNilOrEmpty(this.parent?.data.name)) MDO.name = FALLBACK(`name`, this.parent?.data.name)

  return MDO
}
