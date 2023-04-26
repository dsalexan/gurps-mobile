import { flatten, flattenDeep, get, has, isArray, isEmpty, isNil, orderBy, uniq } from "lodash"
import { Type } from "../../type"
import { MigrationValue, MigrationDataObject, FastMigrationDataObject, isOrigin, OVERWRITE, WRITE, PUSH, MigratableObject, FALLBACK } from "../migration"
import CompilationTemplate, { CompilationContext, GURPSSources } from "../template"
import { GCS } from "../../../../../gurps-extension/types/gcs"
import { isNilOrEmpty, push } from "../../../../../december/utils/lodash"
import { GCA } from "../../../gca/types"
import { GenericFeatureCompilationContext, GenericFeatureManualSource } from "./generic"
import { GurpsMobileActor } from "../../../../foundry/actor"
import LOGGER from "../../../../logger"
import { ILevel, ILevelDefinition, IRelativeLevel, parseLevelDefinition } from "../../../../../gurps-extension/utils/level"
import { IGenericFeature } from "../../variants/generic"
import { parseExpression } from "../../../../../december/utils/math"
import { GURPS4th } from "../../../../../gurps-extension/types/gurps4th"

export interface SkillManualSource extends GenericFeatureManualSource {
  training?: `trained` | `untrained` | `unknown`
  ignoreSpecialization?: boolean
  tl?: number
}

export interface ISkillFeature extends IGenericFeature {
  attribute: string
  difficulty: string
  points: number
  training: `trained` | `untrained` | `unknown`
  defaultFrom: object[]
  form: false | `art` | `sport`
}

export default class SkillFeatureCompilationTemplate extends CompilationTemplate {
  static manual(sources: GURPSSources & { manual?: SkillManualSource }, context: GenericFeatureCompilationContext): FastMigrationDataObject<any> | null {
    const training = sources.manual?.training !== undefined ? OVERWRITE(`training`, sources.manual?.training) : undefined
    const specialization = sources.manual?.ignoreSpecialization ? OVERWRITE(`specialization`, undefined) : undefined

    return {
      //
      training,
      specialization,
    }
  }

  static gcs(GCS: GCS.Entry, context: GenericFeatureCompilationContext): FastMigrationDataObject<any> | null {
    const MDO = {} as FastMigrationDataObject<any>

    const rawDifficulty = get(GCS, `difficulty`, ``).toUpperCase()
    const _difficulty = /(\w{1,4})\/(\w+)/i
    const difficulty = rawDifficulty.match(_difficulty)
    if (difficulty) {
      MDO.attribute = difficulty[1]
      MDO.difficulty = difficulty[2]
    }

    const points = get(GCS, `points`)
    if (!isNil(points)) {
      MDO.points = points
      if (points > 0) MDO.training = `trained`
      else MDO.training = `unknown`
    }

    return MDO
  }

  static gca(GCA: GCA.Entry, context: GenericFeatureCompilationContext): FastMigrationDataObject<any> | null {
    const MDO = {} as FastMigrationDataObject<any>

    // eslint-disable-next-line no-debugger
    if (!isNil(get(GCA, `difficulty`))) debugger
    if (!isNilOrEmpty(GCA?.type)) {
      MDO.attribute = GCA.type.split(`/`)[0]
      MDO.difficulty = GCA.type.split(`/`)[1]
    }

    if (!isNil(GCA?.default)) MDO.defaults = GCA.default.map(_default => parseLevelDefinition(_default))

    return MDO
  }

  static conflict(key: string, migrations: MigrationValue<any>[], context: CompilationContext, sources: GURPSSources): FastMigrationDataObject<unknown> | undefined {
    let MDO = super.conflict(key, migrations, context, sources)

    if (key === `attribute` && MDO === undefined) {
      const attributes = flatten(Object.values(migrations)).map(migration => (migration.value as string).toUpperCase())
      const uniqueAttributes = uniq(attributes)
      if (uniqueAttributes.length === 1) return { attribute: Object.values(migrations)[0] }
      else {
        // ERROR: Too many different attributes
        // eslint-disable-next-line no-debugger
        debugger
      }
    }

    return MDO
  }

  static post(data: MigratableObject & ISkillFeature, context: CompilationContext, sources: Record<string, object>): FastMigrationDataObject<any> | null {
    const MDO = {} as FastMigrationDataObject<any>

    if (has(data, `name`)) {
      const name = data.name

      if (name.match(/\w art(?!\w)/i)) MDO.form = WRITE(`form`, `art`)
      else if (name.match(/\w sport(?!\w)/i)) MDO.form = WRITE(`form`, `sport`)
      else MDO.form = WRITE(`form`, false)
    }

    if (has(data, `training`)) {
      const training = data.training

      if (training === `untrained`) MDO.group = OVERWRITE(`group`, `Untrained Skills`)
      else if (training === `unknown`) MDO.group = OVERWRITE(`group`, `Unknown Skills`)
    }

    return MDO
  }
}
