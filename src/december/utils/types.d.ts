export type ArrayTree<T> = (T | ArrayTree<T>)[]
export type RecordTree<K extends string | number | symbol, T> = {
  [P in K]: T | RecordTree<K, T>
}

// eslint-disable-next-line @typescript-eslint/ban-types
export type OptionalPropertyNames<T> = { [K in keyof T]-?: {} extends { [P in K]: T[K] } ? K : never }[keyof T]

export type SpreadProperties<L, R, K extends keyof L & keyof R> = { [P in K]: L[P] | Exclude<R[P], undefined> }

export type Id<T> = T extends infer U ? { [K in keyof U]: U[K] } : never

export type SpreadTwo<L, R> = Id<
  Pick<L, Exclude<keyof L, keyof R>> &
    Pick<R, Exclude<keyof R, OptionalPropertyNames<R>>> &
    Pick<R, Exclude<OptionalPropertyNames<R>, keyof L>> &
    SpreadProperties<L, R, OptionalPropertyNames<R> & keyof L>
>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Spread<A extends readonly [...any]> = A extends [infer L, ...infer R] ? SpreadTwo<L, Spread<R>> : unknown

type Foo = Spread<[{ a: string }, { a?: number }]>
//    ^?
