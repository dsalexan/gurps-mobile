/* eslint-disable no-debugger */
import {
  Primitive,
  isArray,
  set as _set,
  uniq,
  mergeWith,
  intersection,
  orderBy,
  min,
  isNil,
  isEmpty,
  flatten,
  pick,
  last,
  cloneDeep,
  flattenDeep,
  has,
  isEqual,
  set,
  get,
} from "lodash"
import CompilationTemplate, { CompilationContext } from "./template"
import LOGGER from "../../../logger"
import { AllSources, IConflictResolution, IDerivation, IDerivationPipeline } from "../../../foundry/actor/feature/pipelines"
import Feature from "../../../foundry/actor/feature"

export type MigrationMode = `fallback` | `write` | `overwrite` | `push` | `merge`

interface MigrationDerivationOrigin {
  type: `derivation`
  on: string[]
  derivation: IDerivation<any>
  pipeline: IDerivationPipeline<any>
  source: string[]
}

interface MigrationPostOrigin {
  type: `post`
  pipeline: IDerivationPipeline<any>
  source: string[]
}

interface MigrationConflictOrigin {
  type: `conflict`
  on: string[]
  between: MigrationValue<any>[]
  resolve: IConflictResolution<any>
  pipeline: IDerivationPipeline<any>
  source: string[]
}

export type MigrationOrigin = MigrationDerivationOrigin | MigrationPostOrigin | MigrationConflictOrigin
export type FastMigrationOrigin = Omit<MigrationDerivationOrigin, `pipeline` | `source`> | Omit<MigrationPostOrigin, `source`> | Omit<MigrationConflictOrigin, `resolve` | `source`>

export interface MigrationValue<TValue> {
  _meta: {
    // stack migrations that originated this value
    origin: MigrationOrigin[]
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

export interface MigratableObject<TData extends object = object> {
  data: TData
  migrations: MigrationValue<any>[]
  migrationsByKey: Record<string, MigrationValue<any>[]>
}

export interface MigrationRecipe<TValue> {
  action: `ignore` | `same` | `pass` | `conflict` | `set` | `push` | `merge`
  key: string
  value: TValue
  migrations: MigrationValue<any>[]
}

export interface MigrationConflictResolution<TValue> {
  action: `unknown` | `pipeline`
  pipeline?: IDerivationPipeline<any>
}

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
export function completeMigrationValueDefinitions(object: MigrationDataObject, origin?: FastMigrationOrigin | FastMigrationOrigin[], mode?: MigrationMode) {
  const remove = [] as string[]

  for (const key of Object.keys(object)) {
    let migrationValue = get(object, key) as MigrationValue<unknown>[]

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
    } else if ((migrationValue as MigrationValue<unknown>)?._meta === undefined) migrationValue = [WRITE(key, migrationValue)] as MigrationValue<unknown>[]
    else migrationValue = [migrationValue]

    let DEBUGGER_CONFLICT = false // COMMENT

    const origins = (origin ? (isArray(origin) ? origin : [origin]) : []).map(fastOrigin => {
      const origin = cloneDeep(fastOrigin) as MigrationOrigin

      if (fastOrigin.type === `derivation`) {
        if (fastOrigin.derivation.pipeline === undefined) throw new Error(`Unimplemented derivation without pipeline`)
        origin.pipeline = fastOrigin.derivation.pipeline
        origin.source = uniq(fastOrigin.on.map(target => target.split(`.`)[0]))
      } else if (fastOrigin.type === `post`) {
        origin.pipeline = fastOrigin.pipeline
        origin.source = [`feature`]
      } else if (fastOrigin.type === `conflict`) {
        // @ts-ignore
        const migrationSources = uniq(flattenDeep(migrationValue.map(migration => migration._meta.origin.map(origin => origin.source))))

        // WARN: Untested
        if (migrationSources.length > 1) debugger

        origin.source = migrationSources.length === 0 ? [`feature`] : migrationSources
      } else {
        // ERROR: Unimplemented
        debugger
      }
      return origin
    })

    object[key] = migrationValue.map(item => {
      if (mode) item.mode = mode
      if (origins.length > 0) {
        const allOriginsAreConflict = origins.every(o => o.type === `conflict`)
        const someOriginsAreConflict = origins.some(o => o.type === `conflict`)

        if (allOriginsAreConflict) item._meta.origin = []
        // ERROR: Unimplemented case where SOME (but not all) origins are conflict
        if (!allOriginsAreConflict && someOriginsAreConflict) debugger

        item._meta.origin.push(...origins)
      }

      return item
    })
  }

  for (const key of remove) delete object[key]

  return object
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

function printConflict<TValue, TData extends object = object>(data: TData, migration: MigrationValue<TValue>, lastMigration: MigrationValue<TValue>, context: CompilationContext) {
  LOGGER.group().info(`[${context.humanId ?? (data as any).name ?? `?`}]`, `Migration Conflict`, `"${migration._meta.key}"`, [
    `background-color: rgb(255, 224, 60, 0.45); padding: 3px 0; font-weight: regular;`,
    `background-color: rgb(255, 224, 60, 0.45); padding: 3px 0; font-style: italic; color: #999;`,
    `background-color: rgb(255, 224, 60, 0.45); padding: 3px 0; font-weight: bold;`,
  ])
  LOGGER.info(`    `, `current:`, lastMigration, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
  LOGGER.info(`    `, `    new:`, migration, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
  LOGGER.info(` `)
  LOGGER.info(`    `, ` values:`, data[migration._meta.key], `<-`, migration.value, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
  LOGGER.info(`    `, `   from:`, data, [, `font-style: italic; color: #999;`, `font-style: normal; color: black;`])
  LOGGER.group()
}

/**
 * Generate a resolution path to solve a migration conflict
 */
export function prepareMigrationConflict<TValue>(migration: MigrationValue<TValue>, lastMigration: MigrationValue<TValue>) {
  const key = migration._meta.key

  const resolution: MigrationConflictResolution<TValue> = { action: `unknown` } as any

  if (migration === undefined || lastMigration === undefined) debugger
  if (migration._meta === undefined || lastMigration._meta === undefined) debugger

  // if both migrations have the save origin, try conflict resolution
  const sameOrigin = last(migration._meta.origin)?.type === last(lastMigration._meta.origin)?.type

  if (sameOrigin) {
    const lastOrigin = last(migration._meta.origin)
    let pipeline = lastOrigin?.pipeline
    if (pipeline === undefined) throw new Error(`Unimplemented derivation without a pipeline`)

    const conflict = pipeline.conflict?.[key]
    if (conflict) {
      // try to run conflict call from pipeline
      resolution.action = `pipeline`
      resolution.pipeline = pipeline

      // there is still a change the conflict call will return undefined
      // if it does, then THERE IS STILL CONFLICT
    }
  }

  return resolution
}

/**
 * Base on last migrations, try to resolve a conflict (generating a list of recipes)
 */
export function prepareMigrationConflictResolution<TValue>(
  key: string,
  resolution: MigrationConflictResolution<TValue>,
  migration: MigrationValue<TValue>,
  lastMigration: MigrationValue<TValue>,
  //
  shadowData: MigratableObject[`data`],
  migratableObject: MigratableObject,
  context: CompilationContext,
  object: Feature<any>,
) {
  let migrationRecipe: MigrationRecipe<TValue> = { action: `pass`, key, migrations: [] } as any

  if (resolution.action === `pipeline`) {
    const pipeline = resolution.pipeline!
    const conflict = pipeline.conflict?.[key]

    // there is still a change the conflict call will return undefined
    // if it does, then THERE IS STILL CONFLICT

    const MDO = conflict!.call(context, [migration, cloneDeep(lastMigration)], object.sources) as MigrationDataObject
    if (MDO && Object.keys(MDO).length >= 1) {
      completeMigrationValueDefinitions(MDO, { type: `conflict`, on: [key], pipeline, between: [lastMigration, migration] }, `overwrite`)

      // know that we have a MDO that can be used to resolve the conflict, we can generate a recipe
      const recipes = resolveMigrationDataObject(shadowData, migratableObject, MDO, context, object)

      return recipes
    }
  }

  debugger
  // in case no action can solve the conflict, just pass the migration
  return [migrationRecipe]
}

/**
 * Parse a migration into a recipe based on current state of data
 */
export function prepareMigrationValue<TValue>(
  shadowData: MigratableObject[`data`],
  { data: immutableData, migrations, migrationsByKey }: MigratableObject,
  migration: MigrationValue<TValue>,
) {
  const key = migration._meta.key
  const mode = migration.mode
  const keyMigrations = migrationsByKey[key] ?? []
  const lastMigration = keyMigrations[keyMigrations.length - 1]

  const ___key = key.split(`.`)

  const newValue = migration.value

  // here we just decide what to do with the migration, we dont set values yet
  let migrationRecipe: MigrationRecipe<TValue> = { action: `pass`, key, migrations: [] } as any

  const recipe = (action: MigrationRecipe<TValue>[`action`], value?: MigrationRecipe<TValue>[`value`], ...migrations: MigrationRecipe<TValue>[`migrations`]) => {
    migrationRecipe.action = action
    if (value !== undefined) migrationRecipe.value = value
    migrationRecipe.migrations.push(...migrations)
  }

  if (mode === `write`) {
    if (newValue === undefined) {
      // migration sets no value
      recipe(`ignore`)
    } else {
      const currentValue = has(shadowData, key) ? get(shadowData, key) : get(immutableData, key)

      if (isEqual(newValue, currentValue)) {
        // migration stays the same
        recipe(`same`)
      } else if (lastMigration?.mode === `fallback` || currentValue === undefined || isEmpty(currentValue)) {
        // if value in data is fallback OR empty
        recipe(`set`, newValue, migration)
      } else {
        // CONFLICT
        recipe(`conflict`)
      }
    }
  } else if (mode === `overwrite`) {
    const currentValue = has(shadowData, key) ? get(shadowData, key) : get(immutableData, key)

    if (isEqual(newValue, currentValue)) {
      recipe(`same`)
    } else {
      recipe(`set`, newValue, migration)
    }
  } else if (mode === `push`) {
    const currentValue = has(shadowData, key) ? get(shadowData, key) : get(immutableData, key)
    const value = isArray(newValue) ? newValue : [newValue]

    if (value.length === 0 && currentValue !== undefined) {
      // there will be no addition to the array (and it already exists, so it will not be a initialization)
      recipe(`same`)
    } else {
      recipe(`push`, value as any as TValue, migration)
    }
  } else if (mode === `merge`) {
    if (___key.length > 1) debugger

    recipe(`merge`, newValue, migration)
  } else if (mode === `fallback`) {
    const currentValue = has(shadowData, key) ? get(shadowData, key) : get(immutableData, key)

    // if there is no value in data AND value is something
    if (currentValue === undefined && newValue !== undefined) {
      recipe(`set`, newValue, migration)
    }
  }

  return migrationRecipe
}

/**
 * Apply a recipe to change values in data.
 * This method only ensures data will be applied at the correct order, but in a reversible way
 */
export function applyMigrationRecipe<TValue>(shadowData: MigratableObject[`data`], immutableData: MigratableObject[`data`], recipe: MigrationRecipe<TValue>) {
  const action = recipe.action
  const key = recipe.key

  const ___key = key.split(`.`)

  const currentValue = shadowData[key] ?? immutableData[key]

  if (action === `pass` || action === `ignore` || action === `same`) {
    // pass, just do nothing mate
  } else if (action === `set` || action === `push` || action === `merge`) {
    if (action === `set`) {
      // ERROR: Wait, how a set of undefined is possible??
      if (recipe.value === undefined) debugger

      set(shadowData, key, recipe.value)
    } else if (action === `push`) {
      let value = [] as any[]
      if (currentValue !== undefined && !isArray(currentValue)) value.push(currentValue)

      value.push(...(recipe.value as any as TValue[]))

      set(shadowData, key, recipe.value)
    } else if (action === `merge`) {
      let value = {} as any
      if (!isNil(currentValue)) value = cloneDeep(currentValue)

      const merged = {}
      mergeWith(merged, value, recipe.value, (srcValue, newValue, key, source, object) => {
        if (srcValue === undefined && newValue !== undefined) return newValue
        else if (srcValue !== undefined && newValue === undefined) return srcValue
        else if (srcValue === newValue) return srcValue

        // source === listMigration
        // object === migration
        debugger
        // if (isOrigin(migration._meta.origin, [`gcs`])) return newValue
        // else if (isOrigin(lastMigration._meta.origin, [`gcs`])) return srcValue

        // ERROR: Mergin not implemented
        debugger
      })

      if (___key.length > 1) debugger
      set(shadowData, key, merged)
    }
  }
}

/**
 * Parse a MDO into a list of recipes that can be applied to a data migratable object.
 * You also try to resolve any conflicts inside of it
 */
export function resolveMigrationDataObject(
  shadowData: MigratableObject[`data`],
  migratableObject: MigratableObject,
  mdo: MigrationDataObject,
  context: CompilationContext,
  object: Feature<any>,
) {
  const modes = [`write`, `push`, `merge`, `overwrite`, `conflict`, `fallback`]

  const recipes: MigrationRecipe<unknown>[] = []

  const listOfMigrationsByKey = Object.values(mdo) as MigrationValue<unknown>[][]

  for (const migrationsByKey of listOfMigrationsByKey) {
    if (migrationsByKey.some(migration => isNil(migration))) debugger // COMMENT

    const migrations = orderBy(migrationsByKey, migration => modes.indexOf(migration.mode))

    // WARN: Never tested
    if (migrations.length > 1) debugger

    for (const migration of migrations) {
      // get recipe from migration
      const recipe = prepareMigrationValue(shadowData, migratableObject, migration)

      if (recipe.action !== `conflict`) {
        recipes.push(recipe)
        applyMigrationRecipe(shadowData, migratableObject.data, recipe)
      } else {
        // if detected that some migration will resolve in conflict
        const keyMigrations = migratableObject.migrationsByKey[recipe.key] ?? []
        const lastMigration = keyMigrations[keyMigrations.length - 1]

        // WARN: Untested
        if (recipe.migrations.length > 1) debugger

        // get resolution for specific conflict
        const resolution = prepareMigrationConflict(migration, lastMigration)

        if (resolution.action !== `unknown`) {
          // if resolution is known, get recipes for resolution
          const resolutionRecipes = prepareMigrationConflictResolution(
            recipe.key,
            resolution,
            migration,
            lastMigration, //
            shadowData,
            migratableObject,
            context,
            object,
          )

          // ERROR: C'mon, we just solved a conflict, how could there be other?
          if (resolutionRecipes.some(recipe => recipe.action === `conflict`)) debugger

          recipes.push(...resolutionRecipes)
        } else {
          // if cannot determine how to resolve conflict, print it and log it
          printConflict(migratableObject.data, recipe.migrations[0], lastMigration, context)
          debugger
        }
      }
    }
  }

  return recipes
}
