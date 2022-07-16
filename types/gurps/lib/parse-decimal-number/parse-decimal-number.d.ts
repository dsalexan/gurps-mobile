export function parseDecimalNumber(value: string, inOptions: string | string[] | Record<`thousands` | `group` | `decimal`, string>, enforceGroupSize: boolean): number
export function setOptions(newOptions: Record<`thousands` | `group` | `decimal`, string>): void
export function factoryReset(): void
export function withOptions(options: Record<`thousands` | `group` | `decimal`, string>, enforceGroupSize: boolean): (value: string) => number
