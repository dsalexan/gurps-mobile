import { zip } from "lodash"
import { compareTwoStrings } from "string-similarity"
import { getType } from "utils/lodash"

export function equals(a: unknown, b: unknown, { strict = true, e = 0 } = {}): boolean {
  if (typeof a === typeof b) {
    if (typeof a === `string`) {
      if (e === 0 && a === b) return true
      else if (e > 0) {
        const similarity = compareTwoStrings(a.toLowerCase(), (b as string).toLowerCase())
        const score = 1 - similarity
        if (!(score <= e)) {
          // debugger
        }

        return score <= e
      }
    } else if (typeof a === `number`) a === b
    else if (typeof a === `object`) {
      const type = getType(a)
      if (type === getType(b)) {
        if (type === `array`)
          return zip(a as any[], b as any[])
            .map(([_a, _b]) => equals(_a, _b, { strict, e }))
            .every(comparison => !!comparison)
        else if (type === `object`) {
          const allKeys = [...new Set([...Object.keys(a as object), ...Object.keys(b as object)])]

          return allKeys.map(key => equals((a as object)[key], (b as object)[key], { strict, e })).every(comparison => !!comparison)
        }
      }
    }
    // eslint-disable-next-line eqeqeq
  } else if (!strict) return a == b

  return a === b
}
