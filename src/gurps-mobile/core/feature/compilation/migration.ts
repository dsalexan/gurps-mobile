/* eslint-disable jsdoc/require-jsdoc */
import { Primitive, isArray, set as _set, uniq, mergeWith, intersection, orderBy, min, isNil, isEmpty, flatten } from "lodash"
import CompilationTemplate, { CompilationContext } from "./template"
import LOGGER from "../../../logger"
import { AllSources, IDerivation, IDerivationPipeline } from "../../../foundry/actor/feature/pipelines"

export type MigrationMode = `fallback` | `write` | `overwrite` | `push` | `merge` | `conflict`

export interface MigrationValue<TValue> {
  _meta: {
    derivation: IDerivation<any>
    origin: {
      // stack migrations that originated this value
      sources?: string[]
      migrations?: MigrationValue<any>[]
    }[]
    key: string // key to which value is to be applied
  }
  value: TValue
  mode: MigrationMode
}

// export interface MigrationDataObject {
//   [path: string]: MigrationValue<unknown>[]
// // }
export type MigrationDataObject<TKey extends string | number | symbol = string, TValue = unknown> = { [P in TKey]?: MigrationValue<TValue>[] | TValue }
// export type MigrationDataObject<TData extends Record<TKey, TValue>, TKey extends string | number | symbol = string, TValue = unknown> = {
//   [P in keyof TData]?: MigrationValue<TData[P]>[] | TData[P]
// }

// export interface FastMigrationDataObject<TValue> {
//   [path: string]: MigrationValue<TValue>[] | TValue
// }

export type MigratableObject = ReturnType<typeof buildMigratableObject>

/**
 * Packages value into a MigrationValue structure
 */
export function buildMigrationValue<TValue>(key: string, value: TValue, mode: MigrationMode = `write`): MigrationValue<TValue> {
  return {
    // @ts-ignore
    _meta: {
      key,
      origin: [],
    },
    value,
    mode,
  }
}

export function WRITE<TValue>(key: string, value: TValue): MigrationValue<TValue> {
  return buildMigrationValue(key, value, `write`)
}

export function OVERWRITE<TValue>(key: string, value: TValue): MigrationValue<TValue> {
  return buildMigrationValue(key, value, `overwrite`)
}

export function PUSH<TValue>(key: string, value: TValue): MigrationValue<TValue> {
  return buildMigrationValue(key, value, `push`)
}

export function MERGE<TValue>(key: string, value: TValue): MigrationValue<TValue> {
  return buildMigrationValue(key, value, `merge`)
}

export function FALLBACK<TValue>(key: string, value: TValue): MigrationValue<TValue> {
  return buildMigrationValue(key, value, `fallback`)
}

/**
 * Complete Migration Value definitions inside a MDO
 */
export function completeMigrationValueDefinitions(
  object: MigrationDataObject,
  derivation: IDerivation<any>,
  origin: { sources?: string[]; migrations?: MigrationValue<unknown>[] },
  mode?: MigrationMode,
) {
  const remove = [] as string[]

  for (const key of Object.keys(object)) {
    let migrationValue = object[key] as MigrationValue<unknown>[]

    if (migrationValue === null) debugger
    if (migrationValue === undefined) {
      remove.push(key)
      continue
    }

    if (isArray(migrationValue)) {
      // no item in array is a MigrationValue
      if (migrationValue.length === 0) migrationValue = [PUSH(key, migrationValue)] as MigrationValue<unknown>[]
      else if (!migrationValue.every(item => item._meta !== undefined)) migrationValue = [WRITE(key, migrationValue)] as MigrationValue<unknown>[]
      // eslint-disable-next-line no-self-assign
      else if (migrationValue.every(item => item._meta !== undefined)) migrationValue = migrationValue
      else {
        // ERROR: Unimplemented case where SOME (but not all) items in array are MigrationValue
        debugger
      }
    } else if ((migrationValue as MigrationValue<unknown>)._meta === undefined) migrationValue = [WRITE(key, migrationValue)] as MigrationValue<unknown>[]
    else migrationValue = [migrationValue]

    object[key] = migrationValue.map(item => {
      if (mode) item.mode = mode
      item._meta.derivation = derivation
      item._meta.origin.push(origin)

      return item
    })
  }

  for (const key of remove) delete object[key]

  return object
}

/**
 *
 */
export function buildMigratableObject() {
  return {
    migrate(mdo: MigrationDataObject, context: CompilationContext, sources: AllSources<any>) {
      return resolveMigrationDataObject(this, mdo, context, sources)
    },
    migrations: [] as MigrationValue<any>[],
    migrationsByKey: {} as Record<string, MigrationValue<any>[]>,
  }
}

export function isOrigin(origin: { sources?: string[]; migrations?: MigrationValue<any>[] }[], sources: string[] = [], migrations: MigrationValue<any>[] = []) {
  for (const o of origin) {
    const ISources = intersection(o.sources, sources)
    const IMigrations = intersection(o.migrations, migrations)

    if (ISources.length > 0) return true
    if (IMigrations.length > 0) return true
  }

  return false
}

export function applyMigrationValue<TValue>(data: MigratableObject, migration: MigrationValue<TValue>, context: CompilationContext, sources: Record<string, object>) {
  const key = migration._meta.key
  const value = migration.value
  const mode = migration.mode

  const keyMigrations = data.migrationsByKey[key] ?? []

  const meta = () => {
    data.migrations.push(migration)

    if (data.migrationsByKey[key] === undefined) data.migrationsByKey[key] = []
    data.migrationsByKey[key].push(migration)
  }

  const lastMigration = keyMigrations[keyMigrations.length - 1]

  if (mode === `write`) {
    // if value is nothing OR value is the same as already is
    if (value === undefined || value === data[key]) {
      // pass
    }
    // if value in data is fallback OR empty AND value is something
    else if (data[key] === undefined || lastMigration.mode === `fallback` || isEmpty(data[key])) {
      data[key] = value
      meta()
    }
    // if there is something in data, CONLFICT!!!
    else {
      // if both migrations came from the same template, try conflict resolution
      let isConflict = true

      debugger

      const sameMigration = migration._meta.template.name === lastMigration._meta.template.name

      const manualMigration = migration._meta.template.name === `Manual`
      const manualLastMigration = lastMigration._meta.template.name === `Manual`
      const oneIsManual = manualMigration || manualLastMigration

      if (sameMigration || oneIsManual) {
        const template = sameMigration || manualLastMigration ? migration._meta.template : lastMigration._meta.template
        const prio = min([migration._meta.prio, lastMigration._meta.prio]) as number

        const MDO = template.conflict(key, [migration, lastMigration], context, sources) as MigrationDataObject

        if (MDO && Object.keys(MDO).length >= 1) {
          completeMigrationValueDefinitions(MDO, template, prio, { migrations: [migration, lastMigration] }, `conflict`)
          resolveMigrationDataObject(data, MDO, context, sources)

          isConflict = false
        }
      }

      if (isConflict) {
        LOGGER.group().info(`[${context.humanId ?? (data as any).name ?? `?`}]`, `Migration Conflict`, `"${key}"`, [
          `background-color: rgb(255, 224, 60, 0.45); padding: 3px 0; font-weight: regular;`,
          `background-color: rgb(255, 224, 60, 0.45); padding: 3px 0; font-style: italic; color: #999;`,
          `background-color: rgb(255, 224, 60, 0.45); padding: 3px 0; font-weight: bold;`,
        ])
        LOGGER.info(`    `, `current:`, lastMigration, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
        LOGGER.info(`    `, `    new:`, migration, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
        LOGGER.info(` `)
        LOGGER.info(`    `, ` values:`, data[key], `<-`, value, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
        LOGGER.info(`    `, `   from:`, data, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
        LOGGER.group()
        // ERROR: Unimplemented conflict
        debugger
      }
    }
  } else if (mode === `overwrite` || mode === `conflict`) {
    data[key] = value
    meta()
  } else if (mode === `push`) {
    if (data[key] === undefined) data[key] = []
    else if (!isArray(data[key])) data[key] = [data[key]]

    data[key].push(...(isArray(value) ? value : [value]))
    data[key] = uniq(data[key])

    meta()
  } else if (mode === `merge`) {
    const merged = {}
    mergeWith(merged, value, data[key], (value, srcValue, key, object, source) => {
      if (srcValue !== undefined && value === undefined) return srcValue
      else if (srcValue === undefined && value !== undefined) return value
      else if (srcValue === value) return srcValue

      // source === listMigration
      // object === migration
      debugger
      // if (isOrigin(migration._meta.origin, [`gcs`])) return value
      // else if (isOrigin(lastMigration._meta.origin, [`gcs`])) return srcValue

      // ERROR: Mergin not implemented
      debugger
    })

    data[key] = merged
    meta()
  } else if (mode === `fallback`) {
    // if there is no value in data AND value is something
    if (data[key] !== undefined && value !== undefined) {
      data[key] = value
      meta()
    }
  }

  return data
}

export function resolveMigrationDataObject(data: MigratableObject, mdo: MigrationDataObject, context: CompilationContext, sources: Record<string, object>) {
  const modes = [`write`, `push`, `merge`, `overwrite`, `conflict`, `fallback`]

  const rawMigrations = Object.values(mdo) as MigrationValue<unknown>[][]
  for (const migrationByKey of rawMigrations) {
    if (migrationByKey.some(migration => isNil(migration))) debugger // COMMENT

    const migrations = orderBy(migrationByKey, migration => modes.indexOf(migration.mode))
    for (const migration of migrations) applyMigrationValue(data, migration, context, sources)
  }

  return data
}
