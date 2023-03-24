import { findIndex, findLastIndex, flatten, orderBy, uniq } from "lodash"
import BaseFeature, { FeatureTemplate } from "../base"
import { GCA } from "../../gca/types"
import { GCS } from "../../../../gurps-extension/types/gcs"
import { FastMigrationDataObject, MigratableObject, MigrationDataObject, MigrationValue, WRITE } from "./migration"

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CompilationContext {
  humanId: string
  tl?: number
}

export type GURPSSources = Record<string, object> & {
  gca: GCA.Entry
  gcs: GCS.Entry
}

export type ManualTemplateProperty<TValue> = (sources: GURPSSources & Record<string, object>, context: CompilationContext) => MigrationValue<TValue>[] | TValue

export default class CompilationTemplate {
  static order(): string[][] {
    return []
  }

  /**
   * Prepare source before compilation
   */
  static source(name: string, source: Record<string, any>, context: CompilationContext): Record<string, any> {
    return source
  }

  /**
   * This method centralizes the calls for key compilations
   */
  static compile(name: string, source: object, context: CompilationContext): MigrationDataObject | null {
    if (this[name] !== undefined) return this[name](source, context)

    return null
  }

  /**
   * This method centralizes the calls for conflict resolution
   */
  static conflict(key: string, migrations: MigrationValue<any>[], context: CompilationContext, sources: Record<string, object>): FastMigrationDataObject<unknown> | undefined {
    const flatMigrations = flatten(Object.values(migrations)).filter(migration => {
      if (migration.mode !== `overwrite` && migration.value === undefined) return false
      return true
    })

    // sort by migration mode
    const orderedMigrations = orderBy(flatMigrations, migration => ({ fallback: -1, write: 0, overwrite: 1, push: 2, merge: 3 }[migration.mode]), [`asc`])
    // if ONLY the first one is a write (or NONE is write), pass it along as a array of migrations
    const lastWrite = findLastIndex(
      orderedMigrations.filter(migration => migration.mode !== `fallback`),
      migration => migration.mode === `write`,
    )
    if (lastWrite === 0 || lastWrite === -1) return { [key]: orderedMigrations }

    // check for multiple equal values
    const allValues = flatMigrations.map(migration => migration.value) as unknown[]
    const uniqValues = uniq(allValues)
    if (uniqValues.length === 1) return { [key]: [WRITE(key, uniqValues[0])] }

    return undefined
  }

  /**
   * Post compilation call to do shome shit if necessary. This call returns migration definitions for the entire DATA final object, bc
   */
  static post(data: MigratableObject, context: CompilationContext, sources: Record<string, object>, object: BaseFeature): FastMigrationDataObject<any> | null {
    return null
  }
}
