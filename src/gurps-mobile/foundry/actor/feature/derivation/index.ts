import { cloneDeep, isArray, isFunction } from "lodash"
import { MigrationValue } from "../../../../core/feature/compilation/migration"
import Feature from ".."
import { GCS } from "../../../../../gurps-extension/types/gcs"
import { GCA } from "../../../../core/gca/types"
export interface CompilationContext {
  humanId: string
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
export type IDerivationFunction<TSource extends Record<string, unknown>, TDestination extends string | number | symbol> = (
  this: CompilationContext,
  values: TSource,
  previous: TSource,
  { previousSources, sources, object }: { previousSources: object; sources: object; object: Feature<any, any> },
) => { [P in TDestination]?: MigrationValue<unknown>[] | unknown }

export type IDerivation<TSource extends Record<string, unknown>, TDestination extends string | number | symbol> = {
  derive: IDerivationFunction<TSource, TDestination>
  targets: (keyof TSource)[]
  destinations: TDestination[]
  priority: number
}

export function derivation<TSource extends Record<string, unknown>>(
  target: keyof TSource | (keyof TSource)[],
  derive: IDerivationFunction<TSource, keyof TSource>,
  priority?: number,
): IDerivation<TSource, keyof TSource>
export function derivation<TSource extends Record<string, unknown>, TDestination extends string | number | symbol>(
  target: keyof TSource | (keyof TSource)[],
  destination: TDestination | TDestination[],
  derive: IDerivationFunction<TSource, TDestination>,
  priority?: number,
): IDerivation<TSource, TDestination>
export function derivation<TSource extends Record<string, unknown>, TDestination extends string | number | symbol>(
  target: keyof TSource | (keyof TSource)[],
  destination: TDestination | TDestination[] | IDerivationFunction<TSource, TDestination>,
  derive: IDerivationFunction<TSource, TDestination> | number | undefined,
  priority?: number,
): IDerivation<TSource, TDestination> {
  const targets = isArray(target) ? target : [target]
  const destinations = (isFunction(destination) ? cloneDeep(targets) : isArray(destination) ? destination : [destination]) as TDestination[]
  const derivationFunction = (isFunction(destination) ? priority : derive) as IDerivationFunction<TSource, TDestination>

  const prio = (isFunction(destination) ? derive : priority) as number | undefined

  return {
    derive: derivationFunction,
    targets,
    destinations,
    priority: prio as number,
  }
}

export function derivationWithPrefix<TSource extends Record<string, unknown>>(prefix: string) {
  return function wrappedDerivation<TDestination extends string | number | symbol>(
    target: keyof TSource | (keyof TSource)[],
    destination: TDestination | TDestination[],
    derive: IDerivationFunction<TSource, TDestination>,
    priority?: number,
  ) {
    const targets = isArray(target) ? target : [target]

    return derivation(
      targets.map(target => `${prefix}.${target.toString()}`) as any[],
      destination,
      function wrappedDerive(values: TSource, previous: TSource, scope) {
        const prefixedValues = Object.fromEntries(Object.entries(values).map(([key, value]) => [key.replace(new RegExp(`^${prefix}.`), ``), value]))
        const prefixedPrevious = Object.fromEntries(Object.entries(previous).map(([key, value]) => [key.replace(new RegExp(`^${prefix}.`), ``), value]))

        // @ts-ignore
        return derive(prefixedValues, prefixedPrevious, scope)
      },
      priority,
    )
  }
}

derivation.gcs = derivationWithPrefix<GCS.Entry>(`gcs`)
derivation.gca = derivationWithPrefix<GCA.Entry>(`gca`)

export function proxy<TTarget extends string>(target: TTarget | TTarget[], priority?: number) {
  const targets = isArray(target) ? target : [target]

  return derivation(
    targets,
    function wrappedDerive(values: Record<TTarget, unknown>) {
      const results = {} as Record<TTarget, unknown>
      for (const [key, value] of Object.entries(values)) {
        results[key] = value
      }

      // eslint-disable-next-line no-debugger
      debugger
      return results
    },
    priority,
  )
}

export function proxyWithPrefix<TSource extends Record<string, unknown>>(prefix?: string) {
  return (target: keyof TSource | (keyof TSource)[], priority?: number) => {
    const targets = isArray(target) ? target : [target]

    return derivation(
      prefix ? targets : targets.map(target => `${prefix}.${target.toString()}`),
      targets,
      function wrappedDerive(values: Record<keyof TSource, unknown>) {
        const results = {} as Record<keyof TSource, unknown>
        for (const [key, value] of Object.entries(values)) {
          results[key as keyof TSource] = value
        }

        // eslint-disable-next-line no-debugger
        debugger
        return results
      },
      priority,
    )
  }
}

proxy.gcs = proxyWithPrefix<GCS.Entry>(`gcs`)
proxy.gca = proxyWithPrefix<GCS.Entry>(`gca`)
