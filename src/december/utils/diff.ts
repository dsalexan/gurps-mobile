import { entries, get, has, isUndefined, keys, isObjectLike, isEqual } from "lodash"

/**
 * Deep diff between two object-likes
 * @param  {Object} fromObject the original object
 * @param  {Object} toObject   the updated object
 * @return {Object}            a new object which represents the diff
 */
export function deepDiff(fromObject, toObject) {
  const changes = {}

  const buildPath = (path, obj, key) => (isUndefined(path) ? key : `${path}.${key}`)

  const walk = (fromObject, toObject, path) => {
    for (const key of keys(fromObject)) {
      const currentPath = buildPath(path, fromObject, key)
      if (!has(toObject, key)) {
        changes[currentPath] = { from: get(fromObject, key) }
      }
    }

    for (const [key, to] of entries(toObject)) {
      const currentPath = buildPath(path, toObject, key)
      if (!has(fromObject, key)) {
        changes[currentPath] = { to }
      } else {
        const from = get(fromObject, key)
        if (!isEqual(from, to)) {
          if (isObjectLike(to) && isObjectLike(from)) {
            walk(from, to, currentPath)
          } else {
            changes[currentPath] = { from, to }
          }
        }
      }
    }
  }

  walk(fromObject, toObject)

  return changes
}
