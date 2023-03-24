import { flatten, flattenDeep, get, has, isArray, isNil, uniq } from "lodash"
import { FEATURE, Type } from "../../type"
import { MigrationValue, MigrationDataObject, FastMigrationDataObject, isOrigin, OVERWRITE, WRITE, PUSH, MigratableObject, MERGE } from "../migration"
import CompilationTemplate, { CompilationContext, GURPSSources } from "../template"
import { GCS } from "../../../../../gurps-extension/types/gcs"
import { RelativeSkillLevel, parseWeight, typeFromGCA, typeFromGCS } from "../../utils"
import { isNilOrEmpty } from "../../../../../december/utils/lodash"
import { GCA as _GCA } from "../../../gca/types"
import { GenericFeatureCompilationContext } from "./generic"
import { IFeature } from "../../base"

export interface EquipmentManualSource {
  carried?: boolean
}

export interface IEquipmentFeature extends IGenericFeature {
  description: string
  carried: boolean
  quantity: number
  cost: { base: number | null; extended: string; unit: string }
  weight: { base: number | null; extended: string; unit: string }
  piece: { value: number; weight: number }
}

export default class EquipmentFeatureCompilationTemplate extends CompilationTemplate {
  static source(name: string, source: Record<string, any>, context: GenericFeatureCompilationContext): Record<string, any> {
    let changedSource = source

    if (name === `gca`) {
      // if there is a name
      if (source.name) {
        const _piece = (source.name as string).match(/(\w+) +piece/i)

        // if it is named like a coin piece
        if (_piece) {
          const metal = _piece[1].toLowerCase()

          // jerry rig it to a pre-assembled gca entry
          changedSource = {
            basecost: {
              copper: 1,
              silver: 10,
              gold: 200,
              platinum: 2000,
            }[metal],
            baseweight: 0.004,
            name: `${metal[0].toUpperCase()}${metal.substring(1)} Piece`,
            piece: true,
          }

          // ERROR: Context missing feature id
          if (!context.id) debugger

          // eslint-disable-next-line no-undef
          GCA.setCache(context.id, source)
        }
      }
    }

    return changedSource
  }

  static manual(sources: GURPSSources & { manual?: EquipmentManualSource }, context: GenericFeatureCompilationContext): FastMigrationDataObject<any> | null {
    return {
      carried: sources.manual?.carried,
    }
  }

  static gcs(GCS: GCS.Entry, context: GenericFeatureCompilationContext): FastMigrationDataObject<any> | null {
    const cost = get(GCS, `value`, null)
    const weight = parseWeight(get(GCS, `weight`, null))

    return {
      type: OVERWRITE(`type`, FEATURE.EQUIPMENT),
      description: get(GCS, `description`),
      name: get(GCS, `description`),
      label: get(GCS, `description`),
      quantity: get(GCS, `quantity`, 1),
      cost: {
        base: isNil(cost) ? null : parseFloat(cost),
        extended: get(GCS, `calc.extended_value`, null),
        unit: `unknown`,
      },
      weight: {
        base: weight,
        extended: parseWeight(get(GCS, `calc.extended_weight`, null)),
        unit: `kg`,
      },
    }
  }

  static conflict(key: string, migrations: MigrationValue<any>[], context: CompilationContext, sources: GURPSSources): FastMigrationDataObject<unknown> | undefined {
    let MDO = super.conflict(key, migrations, context, sources)

    if (key === `cost` || key === `weight`) {
      debugger
      // // TODO: Make a merge based on defaultDeep
      // const gcsKeys = Object.keys(sources.gcs?.value)
      // const gcaKeys = Object.keys(sources.gca?.value)

      // const keys = new Set([...gcsKeys, ...gcaKeys])
      // const merged = {}

      // const discrepancies = []
      // for (const key of keys) {
      //   const _gcs = gcs.value[key]
      //   const _gca = gca.value[key]

      //   if (_gcs === undefined && _gca !== undefined) merged[key] = _gca
      //   else if (_gcs !== undefined && _gca === undefined) merged[key] = _gcs
      //   else if (!isEqual(_gcs, _gca)) discrepancies.push(key)
      //   else merged[key] = _gcs
      // }

      // if (discrepancies.length === 0) return merged
      // else return GenericFeature.WARN_CONFLICT(GenericFeature.UNRESOLVED_CONFLICT, this, key, gcs, gca)
    }

    return MDO
  }

  static post(data: MigratableObject & IEquipmentFeature, context: CompilationContext, sources: Record<string, object>): FastMigrationDataObject<any> | null {
    const MDO = {} as FastMigrationDataObject<any>

    if (has(data, `quantity`)) {
      MDO.cost = MERGE(`cost`, { extended: isNil(data.cost.base) ? `${data.quantity}x??` : data.quantity * data.cost.base })
      MDO.weight = MERGE(`weight`, { extended: isNil(data.weight.base) ? `${data.quantity}x??` : data.quantity * data.weight.base })
    }

    return MDO
  }
}
