import { cloneDeep, get, isArray, isFunction, isNil } from "lodash"
import { FastMigrationDataObject, MigratableObject, MigrationDataObject, MigrationValue } from "../../../../core/feature/compilation/migration"
import Feature, { IFeatureData } from ".."
import { GCS } from "../../../../../gurps-extension/types/gcs"
import { GCA } from "../../../../core/gca/types"
import { Type } from "../../../../core/feature"

export type GenericSource = { [P in string]?: unknown }

export interface FeatureSources<TManualSource extends GenericSource> {
  gca: GCA.Entry
  gcs: GCS.Entry
  manual: TManualSource
}

export type SingleSource<TManualSource extends GenericSource> = FeatureSources<TManualSource>[keyof FeatureSources<TManualSource>]
export type AllSources<TManualSource extends GenericSource> = FeatureSources<TManualSource> | FeatureSources<TManualSource>[keyof FeatureSources<TManualSource>]

export interface CompilationContext {
  id: string
  humanId: string
  type: Type
  parent?: Feature<any, any>
  tl?: number
}

type AllLess<T extends ReadonlyArray<unknown>> = T extends readonly [...infer Head, any] ? AllLess<Head> | T : T
type PartialFunction<F extends (...args: any[]) => any> = AllLess<Parameters<F>> extends infer P extends ReadonlyArray<unknown>
  ? P extends P
    ? (...args: P) => ReturnType<F>
    : never
  : never

/**
 * The ideia is to receive a stripped down version of sources in newValues, with only the information required
 * Then, derive that information into new tuples to add to final data
 */
export type IDerivationFunction<TDestination extends string | number | symbol, TManualSource extends GenericSource = never, TSource = AllSources<TManualSource>> = (
  this: CompilationContext,
  values: TSource,
  previous: TSource,
  { previousSources, sources, object }: { previousSources: FeatureSources<TManualSource>; sources: FeatureSources<TManualSource>; object: Feature<any, any> },
) => MigrationDataObject<TDestination>

export type IDerivation<
  TDestination extends string | number | symbol,
  TManualSource extends GenericSource = never,
  TSource = AllSources<TManualSource>,
  TTarget = keyof TSource,
> = {
  pipeline?: IDerivationPipeline<any>
  derive: IDerivationFunction<TDestination, TManualSource, TSource>
  targets: TTarget[]
  destinations: TDestination[]
}

// proxy, target = destination
// export function derivation<TManualSource extends GenericSource = never, TSource extends GenericSource = SingleSource<TManualSource>>(
//   target: keyof TSource | (keyof TSource)[],
// ): IDerivation<keyof TSource, TManualSource, TSource>

// // target = destination
// export function derivation<TManualSource extends GenericSource = never, TSource extends GenericSource = SingleSource<TManualSource>>(
//   target: keyof TSource | (keyof TSource)[],
//   derive: IDerivationFunction<keyof TSource, TManualSource, TSource>,
// ): IDerivation<keyof TSource, TManualSource, TSource>
export function derivation<TDestination extends string | number | symbol, TManualSource extends GenericSource = never, TSource = AllSources<TManualSource>>(
  target: keyof TSource | (keyof TSource)[],
  destination: TDestination | TDestination[],
  derive: IDerivationFunction<TDestination, TManualSource, TSource>,
): IDerivation<TDestination, TManualSource, TSource>
export function derivation<TDestination extends string | number | symbol, TManualSource extends GenericSource = never, TSource = AllSources<TManualSource>>(
  target: keyof TSource | (keyof TSource)[],
  destination?: TDestination | TDestination[] | IDerivationFunction<TDestination, TManualSource, TSource>,
  derive?: IDerivationFunction<TDestination, TManualSource, TSource>,
): IDerivation<TDestination, TManualSource, TSource> {
  const targets = isArray(target) ? target : [target]
  const destinations = isFunction(destination) || isNil(destination) ? (cloneDeep(targets) as any as TDestination[]) : isArray(destination) ? destination : [destination]
  const derivationFunction = isFunction(destination) || isNil(derive) ? (proxy as any as IDerivationFunction<TDestination, TManualSource, TSource>) : derive

  return {
    derive: derivationFunction,
    targets,
    destinations,
  }
}

export function passthrough<TDestination extends string | number | symbol, TManualSource extends GenericSource = never, TSource = AllSources<TManualSource>>(
  destination: TDestination | TDestination[],
  derive: IDerivationFunction<TDestination, TManualSource, TSource>,
): IDerivation<TDestination, TManualSource, TSource> {
  const destinations = isArray(destination) ? destination : [destination]

  return {
    derive,
    targets: [],
    destinations,
  }
}

export function derivationWithPrefix<
  TSourceName extends keyof FeatureSources<never>,
  TManualSource extends GenericSource = any,
  TSource extends GenericSource = FeatureSources<TManualSource>[TSourceName],
>(prefix: TSourceName) {
  return function wrappedDerivation<TDestination extends string | number | symbol>(
    target: keyof TSource | (keyof TSource)[],
    destination: TDestination | TDestination[],
    derive: IDerivationFunction<TDestination, TManualSource, TSource>,
  ) {
    const targets = isArray(target) ? target : [target]

    return derivation(
      targets.map(target => `${prefix}.${target.toString()}`) as any[],
      destination,
      //
      function wrappedDerive(values: FeatureSources<TManualSource>, previous: FeatureSources<TManualSource>, scope) {
        // const prefixedValues = Object.fromEntries(Object.entries(values).map(([key, value]) => [key.replace(new RegExp(`^${prefix}.`), ``), value]))
        // const prefixedPrevious = Object.fromEntries(Object.entries(previous).map(([key, value]) => [key.replace(new RegExp(`^${prefix}.`), ``), value]))

        const prefixedValues = values[prefix]
        const prefixedPrevious = previous[prefix]

        return derive.call(this, prefixedValues, prefixedPrevious, scope)
      },
    )
  }
}

derivation.manual = derivationWithPrefix(`manual`)
derivation.gcs = derivationWithPrefix(`gcs`)
derivation.gca = derivationWithPrefix(`gca`)

// typescript "property of" utility type
type PropertyOf<T> = keyof T extends string | number | symbol ? keyof T : never

export function proxyWithPrefix<
  TSourceName extends keyof FeatureSources<never>,
  TManualSource extends GenericSource = never,
  TSource extends GenericSource = FeatureSources<TManualSource>[TSourceName],
>(prefix: TSourceName) {
  return function wrappedDerivation<TDestination extends string | number | symbol>(target: keyof TSource | (keyof TSource)[], defaultValue?: any) {
    const targets = isArray(target) ? target : [target]

    return derivation(
      targets.map(target => `${prefix}.${target.toString()}`) as any[],
      targets as TDestination[],
      //
      function wrappedDerive(values: TSource, previous: TSource, scope) {
        const results = {} as { [P in TDestination]?: MigrationValue<unknown>[] | unknown }

        for (const key of targets) {
          const value = get(values, `${prefix}.${String(key)}`, defaultValue)
          results[key as TDestination] = value
        }

        return results
      },
    )
  }
}

export const proxy = {
  manual: proxyWithPrefix(`manual`),
  gcs: proxyWithPrefix(`gcs`),
  gca: proxyWithPrefix(`gca`),
}

export type IConflictResolution<TManualSource extends GenericSource> = (
  this: CompilationContext,
  migrations: MigrationValue<any>[],
  sources: FeatureSources<TManualSource>,
) => MigrationValue<unknown>[] | unknown

export type DeepKeyOf<T> = T[keyof T] extends object ? DeepKeyOf<T[keyof T]> : keyof T
export type IDerivationPipeline<TData extends IFeatureData, TManualSource extends GenericSource = GenericSource, TSource = AllSources<TManualSource>> = IDerivation<
  keyof TData,
  TManualSource,
  TSource,
  any
>[] & {
  name?: string
  conflict?: Partial<Record<keyof TData, IConflictResolution<TManualSource>>>
  pre?: (
    this: CompilationContext,
    data: MigratableObject<TData>,
    object: Feature<TData, TManualSource>,
    sources: FeatureSources<TManualSource>,
  ) => FastMigrationDataObject<any> | null
  post?: (
    this: CompilationContext,
    data: {
      get: <TKey extends keyof TData>(key: TKey) => TData[TKey]
      has: <TKey extends keyof TData>(key: TKey) => boolean
    },
  ) => FastMigrationDataObject<any> | null
}

export type IManualPipeline<TData extends IFeatureData, TManualSource extends GenericSource> = Record<
  string,
  IDerivation<keyof TData, TManualSource, AllSources<TManualSource>> & unknown
>
