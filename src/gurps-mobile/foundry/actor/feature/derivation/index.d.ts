import type { MigrationValue } from "../../../../core/feature/compilation/migration"

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
  context,
  newValues: Record<TTarget, unknown>,
  previousValues: Record<TTarget, unknown>,
  { previousSources, sources },
) => Record<TDestination, MigrationValue<unknown>[] | unknown>

export type IDerivation<TTarget extends string, TDestination extends string> = {
  fn: IDerivationFunction<TTarget, TDestination>
  targets: TTarget[]
  destinations: TDestination[]
  priority: number
}

export function derivation<TTarget extends string>(target: TTarget | TTarget[], fn: IDerivationFunction<TTarget, TTarget>, priority?: number): IDerivation<TTarget, TTarget>
export function derivation<TTarget extends string, TDestination extends string>(
  target: TTarget | TTarget[],
  destination: TDestination | TDestination[],
  fn: IDerivationFunction<TTarget, TDestination>,
  priority?: number,
): IDerivation<TTarget, TDestination>
