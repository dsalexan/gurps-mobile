import { flatten, flattenDeep, get, isArray, isNil, orderBy, uniq } from "lodash"
import { Type } from "../../type"
import { MigrationValue, MigrationDataObject, FastMigrationDataObject, isOrigin, OVERWRITE, WRITE, PUSH } from "../migration"
import CompilationTemplate, { CompilationContext, GURPSSources } from "../template"
import { GCS } from "../../../../../gurps-extension/types/gcs"
import { isNilOrEmpty } from "../../../../../december/utils/lodash"
import { GCA } from "../../../gca/types"
import { GenericFeatureCompilationContext, GenericFeatureManualSource } from "./generic"
import { GurpsMobileActor } from "../../../../foundry/actor"
import { IFeature, ManualSourceProperty } from "../../base"
import LOGGER from "../../../../logger"
import { IRollDefinition, IRelativeLevelDefinition, parseRollDefinition } from "../../../../../gurps-extension/utils/roll"

export interface SkillManualSource extends GenericFeatureManualSource {
  trained?: boolean
  ignoreSpecialization?: boolean
  defaultDefinition?: { actor: GurpsMobileActor; _index: number; _skill: string; _from: string | string[]; _text: string; expression: GCA.Expression }[]
}

export interface ISkillFeature extends IFeature {
  attribute: string
  difficulty: string
  sl: string
  rsl: IRelativeLevelDefinition
  default: IRollDefinition[]
  untrained: boolean
  defaultFrom: object[]
  proxy?: boolean
}

export default class SkillFeatureCompilationTemplate extends CompilationTemplate {
  static manual(sources: GURPSSources & { manual?: SkillManualSource }, context: GenericFeatureCompilationContext): FastMigrationDataObject<any> | null {
    const group = sources.manual?.trained === false ? OVERWRITE(`group`, `Untraned Skills`) : undefined
    const untrained = sources.manual?.trained !== undefined ? OVERWRITE(`untrained`, sources.manual?.trained === false) : undefined
    const specialization = sources.manual?.ignoreSpecialization ? OVERWRITE(`specialization`, undefined) : undefined

    // let defaultDefinition = sources.manual?.defaultDefinition
    // if (defaultDefinition) {
    //   LOGGER.warn(`Manual Context Building for "defaultDefinition" missing at SkillFeatureCompilationTemplate`)
    //   LOGGER.info(defaultDefinition)
    // }

    return {
      group,
      //
      untrained,
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

    MDO.sl = get(GCS, `calc.level`, undefined)

    const rawRSL = get(GCS, `calc.rsl`, undefined)
    if (!isNil(rawRSL)) {
      const _rsl = /([\w?]+)([+-][\d?]+)?/i
      const relativeLevel = rawRSL.match(_rsl)

      const rsl = { expression: `??`, definitions: {} } as IRelativeLevelDefinition

      // create custom relative definition by hand
      rsl.expression = `GCS`
      // TODO: Do a better job filling this information
      rsl.definitions[`GCS`] = {
        variable: `GCS`,
        value: 0,
        content: relativeLevel?.[1] ?? ``,
        //
        flags: [isNilOrEmpty(relativeLevel?.[1]) && `error`, `unknown`].filter(b => !!b) as string[],
        prefix: ``,
      }

      if (relativeLevel) {
        if (relativeLevel[2] !== `+0` && relativeLevel[2] !== `-0` && !isNilOrEmpty(relativeLevel[2])) {
          rsl.expression = `${rsl.expression} ${relativeLevel[2]}`
        }
      }

      MDO.rsl = rsl
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

    if (!isNil(GCA?.default)) MDO.default = GCA.default.map(_default => parseRollDefinition(_default))

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
}
