import { flatten, flattenDeep, get, isArray, isNil, uniq } from "lodash"
import { Type } from "../../type"
import { MigrationValue, MigrationDataObject, FastMigrationDataObject, isOrigin, OVERWRITE, WRITE, PUSH } from "../migration"
import CompilationTemplate, { CompilationContext, GURPSSources } from "../template"
import { GCS } from "../../../../../gurps-extension/types/gcs"
import { RelativeSkillLevel, typeFromGCA, typeFromGCS } from "../../utils"
import { isNilOrEmpty } from "../../../../../december/utils/lodash"
import { GCA } from "../../../gca/types"
import { GenericFeatureCompilationContext } from "./generic"
import { IFeature } from "../../base"

export interface ISpellFeature extends IFeature {
  spellClass: string
  //
  cost: string
  castingTime: string
  maintain: string
  duration: string
  //
  resist?: string
  powerSource?: string
}

export default class SpellFeatureCompilationTemplate extends CompilationTemplate {
  static gcs(GCS: GCS.Entry, context: GenericFeatureCompilationContext): FastMigrationDataObject<any> | null {
    return {
      spellClass: get(GCS, `spell_class`),
      cost: get(GCS, `casting_cost`, `—`).replace(`-`, `—`),
      castingTime: get(GCS, `casting_time`, `—`).replace(`-`, `—`),
      maintain: get(GCS, `maintenance_cost`, `—`).replace(`-`, `—`),
      duration: get(GCS, `duration`, `—`).replace(`-`, `—`),
      resist: get(GCS, `resist`),
      powerSource: get(GCS, `power_source`),
    }
  }
}
