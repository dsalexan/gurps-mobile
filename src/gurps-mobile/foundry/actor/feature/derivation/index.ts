import { cloneDeep, isArray, isFunction } from "lodash"

function _derivation<TTarget extends string, TDestination extends string>(targetPrefix?: string, destinationPrefix?: string) {
  return (
    target: TTarget | TTarget[],
    destination: TDestination | TDestination[] | IDerivationFunction<TTarget, TDestination>,
    fn: IDerivationFunction<TTarget, TDestination> | number | undefined,
    priority?: number,
  ) => {
    const targets = isArray(target) ? target : [target]
    const destinations = (isFunction(destination) ? cloneDeep(targets) : isArray(destination) ? destination : [destination]) as TDestination[]
    const derivationFunction = (isFunction(destination) ? priority : fn) as IDerivationFunction<TTarget, TDestination>

    const prio = (isFunction(destination) ? fn : priority) as number | undefined

    return {
      fn: derivationFunction,
      targets,
      destinations,
      priority: prio as number,
    }
  }
}

export const derivation = _derivation()
// export function derivation<TTarget extends string, TDestination extends string>(
//   target: TTarget | TTarget[],
//   destination: TDestination | TDestination[] | IDerivationFunction<TTarget, TDestination>,
//   fn: IDerivationFunction<TTarget, TDestination> | number | undefined,
//   priority?: number,
// ): IDerivation<TTarget, TDestination> {
//   const targets = isArray(target) ? target : [target]
//   const destinations = (isFunction(destination) ? cloneDeep(targets) : isArray(destination) ? destination : [destination]) as TDestination[]
//   const derivationFunction = (isFunction(destination) ? priority : fn) as IDerivationFunction<TTarget, TDestination>

//   const prio = (isFunction(destination) ? fn : priority) as number | undefined

//   return {
//     fn: derivationFunction,
//     targets,
//     destinations,
//     priority: prio as number,
//   }
// }

function _proxy<TTarget extends string>(targetPrefix: string) {
  return (target: TTarget | TTarget[], priority?: number) => {
    const a = derivation(
      target,
      ((context, newValues: Record<TTarget, unknown>) => {
        const results = {} as Record<TTarget, unknown>
        for (const [key, value] of Object.entries(newValues)) {
          results[key] = value
        }

        // eslint-disable-next-line no-debugger
        debugger
        return results
      }) as IDerivationFunction<TTarget, TTarget>,
      priority,
    )

    return a
    //     ^?
  }
}

export const proxy = _proxy()
proxy.gcs = _proxy(`gcs.`)
