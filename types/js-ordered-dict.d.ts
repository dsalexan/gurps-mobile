// eslint-disable-next-line quotes
declare module "js-ordered-dict" {
  export default class OrderedDict<TValue> {
    readonly dict: Record<string, TValue>
    readonly arr: string[]

    set: (key: string | number, value: TValue) => TValue
    get: (key: string | number) => TValue | undefined
    nth: (index: number) => TValue
    first: () => TValue
    last: () => TValue
    has: (key: string | number) => boolean
    keys: () => string[]
  }
}
