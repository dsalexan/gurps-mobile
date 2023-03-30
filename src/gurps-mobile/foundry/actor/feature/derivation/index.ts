import { cloneDeep, isArray, isFunction } from "lodash"
import { MigrationValue } from "../../../../core/feature/compilation/migration"
import Feature from ".."

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
export type IDerivationFunction<TTarget extends string, TDestination extends string> = (
  values: Record<TTarget, unknown>,
  previous: Record<TTarget, unknown>,
  { previousSources, sources, object }: { previousSources: object; sources: object; object: Feature<any, any> },
) => Record<TDestination, MigrationValue<unknown>[] | unknown>

export type IDerivation<TTarget extends string, TDestination extends string> = {
  derive: IDerivationFunction<TTarget, TDestination>
  targets: TTarget[]
  destinations: TDestination[]
  priority: number
}

export function derivation<TTarget extends string>(target: TTarget | TTarget[], derive: IDerivationFunction<TTarget, TTarget>, priority?: number): IDerivation<TTarget, TTarget>
export function derivation<TTarget extends string, TDestination extends string>(
  target: TTarget | TTarget[],
  destination: TDestination | TDestination[],
  derive: IDerivationFunction<TTarget, TDestination>,
  priority?: number,
): IDerivation<TTarget, TDestination>
export function derivation<TTarget extends string, TDestination extends string>(
  target: TTarget | TTarget[],
  destination: TDestination | TDestination[] | IDerivationFunction<TTarget, TDestination>,
  derive: IDerivationFunction<TTarget, TDestination> | number | undefined,
  priority?: number,
): IDerivation<TTarget, TDestination> {
  const targets = isArray(target) ? target : [target]
  const destinations = (isFunction(destination) ? cloneDeep(targets) : isArray(destination) ? destination : [destination]) as TDestination[]
  const derivationFunction = (isFunction(destination) ? priority : derive) as IDerivationFunction<TTarget, TDestination>

  const prio = (isFunction(destination) ? derive : priority) as number | undefined

  return {
    derive: derivationFunction,
    targets,
    destinations,
    priority: prio as number,
  }
}

export function derivationWithPrefix<TTarget extends string, TDestination extends string>(prefix: string) {
  return (target: TTarget | TTarget[], destination: TDestination | TDestination[], derive: IDerivationFunction<TTarget, TDestination>, priority?: number) => {
    const targets = isArray(target) ? target : [target]

    return derivation(
      targets.map(target => `${prefix}.${target}`) as any[],
      destination,
      function wrappedDerive(values: Record<TTarget, unknown>, previous: Record<TTarget, unknown>, scope) {
        const prefixedValues = Object.fromEntries(Object.entries(values).map(([key, value]) => [key.replace(new RegExp(`^${prefix}.`), ``), value]))
        const prefixedPrevious = Object.fromEntries(Object.entries(previous).map(([key, value]) => [key.replace(new RegExp(`^${prefix}.`), ``), value]))

        return derive(prefixedValues as any, prefixedPrevious as any, scope)
      },
      priority,
    )
  }
}

derivation.gcs = derivationWithPrefix(`gcs`)
derivation.gca = derivationWithPrefix(`gca`)

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

export function proxyWithPrefix<TTarget extends string>(prefix?: string) {
  return (target: TTarget | TTarget[], priority?: number) => {
    const targets = isArray(target) ? target : [target]

    return derivation(
      prefix ? targets : (targets.map(target => `${prefix}.${target}`) as any[]),
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
}

proxy.gcs = proxyWithPrefix(`gcs`)
proxy.gca = proxyWithPrefix(`gca`)
