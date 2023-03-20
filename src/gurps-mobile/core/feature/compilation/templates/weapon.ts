import { flatten, flattenDeep, get, isArray, isNil } from "lodash"
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
  damage: string
  parry: string
  range: string
  usage: string
  defaults: IRollDefinition[]
}

export default class WeaponFeatureCompilationTemplate extends CompilationTemplate {
  static gcs(GCS: GCS.Entry, context: GenericFeatureCompilationContext): FastMigrationDataObject<any> | null {
    const MDO = {
      damage: get(GCS, `damage`),
      parry: get(GCS, `parry`),
      range: get(GCS, `range`),
      usage: get(GCS, `usage`),
    } as FastMigrationDataObject<any>

    const defaults = get(GCS, `defaults`)
    if (defaults) MDO.defaults = defaults.map(_default => parseRollDefinition(_default))

    return MDO
  }

  static post(data: MigratableObject & IFeature & IWeaponFeature, context: CompilationContext, sources: Record<string, object>): FastMigrationDataObject<any> | null {
    const MDO = {} as FastMigrationDataObject<any>

    if (isNilOrEmpty(data.name) && !isNilOrEmpty(data.parent?.name)) MDO.name = data.parent?.name

    return MDO
  }
}
