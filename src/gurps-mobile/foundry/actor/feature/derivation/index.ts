import { MigrationValue } from "../../../../core/feature/compilation/migration"

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
