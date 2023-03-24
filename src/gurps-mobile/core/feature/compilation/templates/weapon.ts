import { flatten, flattenDeep, get, isArray, isEmpty, isNil } from "lodash"
import { Type } from "../../type"
import { MigrationValue, MigrationDataObject, FastMigrationDataObject, isOrigin, OVERWRITE, WRITE, PUSH, MigratableObject } from "../migration"
import CompilationTemplate, { CompilationContext, GURPSSources } from "../template"
import { GCS } from "../../../../../gurps-extension/types/gcs"
import { typeFromGCA, typeFromGCS } from "../../utils"
import { isNilOrEmpty } from "../../../../../december/utils/lodash"
import { GCA } from "../../../gca/types"
import { GenericFeatureCompilationContext } from "./generic"
import { IFeature } from "../../base"
import { GURPS4th } from "../../../../../gurps-extension/types/gurps4th"
import { IRollDefinition, parseRollDefinition } from "../../../../../gurps-extension/utils/roll"

export interface IWeaponFeature extends IFeature {
  block: string | false
  damage: string
  parry: string | false
  range: string
  reach: string[]
  usage: string
  strength: number
}

export default class WeaponFeatureCompilationTemplate extends CompilationTemplate {
  static gcs(GCS: GCS.Entry, context: GenericFeatureCompilationContext): FastMigrationDataObject<any> | null {
    let block = get(GCS, `block`) as any as string | false
    if (block === `No` || block === `-` || isEmpty(block)) block = false

    let parry = get(GCS, `parry`) as any as string | false
    if (parry === `No` || parry === `-`) parry = false
    else if (isEmpty(parry)) parry = ``

    let reach = get(GCS, `reach`, ``).split(`,`)
    if (reach.length === 0) reach = undefined as any

    let strength = get(GCS, `strength`, `-`)
    if (strength === `-` || strength === ``) strength = undefined as any

    const MDO = {
      block,
      damage: get(GCS, `damage`),
      parry,
      range: get(GCS, `range`),
      reach,
      usage: get(GCS, `usage`),
      strength: strength !== undefined ? parseInt(strength) : undefined,
    } as FastMigrationDataObject<any>

    const defaults = get(GCS, `defaults`)
    if (defaults) MDO.rolls = defaults.map(_default => parseRollDefinition(_default))

    return MDO
  }

  static post(data: MigratableObject & IFeature & IWeaponFeature, context: CompilationContext, sources: Record<string, object>): FastMigrationDataObject<any> | null {
    const MDO = {} as FastMigrationDataObject<any>

    if (isNilOrEmpty(data.name) && !isNilOrEmpty(data.parent?.name)) MDO.name = data.parent?.name

    return MDO
  }
}
