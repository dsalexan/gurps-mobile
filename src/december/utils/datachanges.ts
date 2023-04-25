import { flattenDeep, get, isEmpty, isObjectLike, isRegExp } from "lodash"
import type { RecordTree } from "./types"

function flatKeys<K extends string | number | symbol, T>(obj: RecordTree<K, T>, parent?: string): { key: string; leaf?: boolean }[][] {
  return Object.entries(obj).map(([key, value]) => {
    const fullKey = parent === undefined ? key : `${parent}.${key}`

    if (isObjectLike(value)) return [{ key: fullKey }, ...flatKeys(value as RecordTree<K, T>, fullKey)] as { key: string; leaf?: boolean }[]
    return { key: fullKey, leaf: true } as unknown as { key: string; leaf?: boolean }[]
  })
}

export type PatternChanges = ReturnType<Datachanges[`listAll`]>

export default class Datachanges {
  changes?: RecordTree<string, boolean>
  data: Record<string, boolean> = {}

  constructor(changes = {}) {
    this.compile(changes)
  }

  compile(changes?: RecordTree<string, boolean>) {
    this.changes = changes
    this.data = {}
    if (changes === undefined) return

    const _keys = flatKeys<string, boolean>(changes) as unknown as { key: string; leaf?: boolean }[]
    const keys = flattenDeep(_keys)

    for (const { key, leaf } of keys) {
      if (![`_id`, `data`].includes(key)) {
        if (leaf) {
          this.data[key] = get(changes, key) as boolean
        } else this.data[key] = true
      }
    }
  }

  has(key: string | RegExp) {
    if (key instanceof RegExp) return !!Object.keys(this.data).find(k => k.match(key))
    return !!this.data[key]
  }

  get(_key: string | RegExp) {
    return Object.keys(this.data)
      .filter(key => key.match(_key instanceof RegExp ? _key : new RegExp(_key.replaceAll(`.`, `\\.`), `i`)))
      .filter(key => key !== _key)
  }

  listAll(_key: string | RegExp) {
    const keys = Object.keys(this.data)
      .filter(key => key.match(_key instanceof RegExp ? _key : new RegExp(_key.replaceAll(`.`, `\\.`), `i`)))
      .filter(key => key !== _key)

    const pattern = isRegExp(_key) ? _key.source.replaceAll(/\\\./g, `.`) : _key

    const root = keys.includes(pattern)

    const keysWithoutPattern = keys.map(key => key.replace(pattern, ``)).map(key => (key.startsWith(`.`) ? key.substring(1) : key))
    const changes = keysWithoutPattern.filter(key => !isEmpty(key))

    if (changes.length === 0 && root) return { root }
    else if (changes.length > 0) return { changes }
    else {
      // ERROR: Untested
      debugger
    }
  }

  /**
   * Considers "state: false" when removing key from database (with -=)
   */
  getState(key: string): [boolean | undefined, string] {
    let state = this.data[key]
    let id = key.split(`.`).pop()

    if (!!id && id.substring(0, 2) === `-=`) {
      id = id.substring(2)
      state = false
    }

    return [state, id as string]
  }
}
