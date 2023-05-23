import { Flat, cloneDeep, findLastIndex, flatten, flattenDeep, get, isArray, isEmpty, isNil, isString } from "lodash"

import { FastDisplayable, ITag } from "./feature/interfaces"
import { Displayable } from "./feature/interfaces"

/**
 *
 */
function flatArray<TValue>(couldBeArray: TValue): Flat<TValue>[] {
  return flattenDeep([couldBeArray])
}

export type TagArguments = [string, string | string[], object[]]
export type Tag = ITag | TagArguments

export interface PartialTag {
  type?: string | string[]
  classes?: string | string[]
  children?: FastDisplayable | FastDisplayable[]
}

export type IncompleteTag = string | [string | string[], string | string[], FastDisplayable | FastDisplayable[]] | PartialTag
export type FastTag = IncompleteTag | ITag

export default class TagBuilder {
  tags: ITag[]

  constructor(tags: FastTag[] = []) {
    this.tags = tags.map(tag => this.rebuild(tag))
  }

  /**
   * Takes a incomplete version of a tag and rebuilds it following the schema
   */
  rebuild(raw: FastTag) {
    if (isArray(raw)) {
      raw = {
        type: raw[0],
        classes: raw[1],
        children: raw[2],
      }
    } else if (isString(raw)) {
      raw = {
        children: { label: raw },
      }
    }

    const tag: ITag = {
      type: flatArray([get(raw, `type`, [] as string[])]),
      classes: flatArray([get(raw, `classes`, [] as string[])]),
      children: flatArray([get(raw, `children`, [] as FastDisplayable[])]).map((child: FastDisplayable) => {
        const c: Displayable = {
          classes: flatArray([get(child, `classes`, [] as string[])]),
          label: isString(child) ? child : get(child, `label`),
          icon: get(child, `icon`),
        }

        if (c.icon === undefined) delete c.icon
        if (c.label !== undefined) {
          const match = c.label.match(/^https?:\/\//i)
          if (match) {
            const components = c.label.replace(match[0], ``).split(`.`)
            c.label = components[0] !== `www` ? components[0] : components[1]
            c.classes?.push(`external-link`)
          }
        }

        return c
      }),
    }

    if (tag.type === undefined) tag.type = []

    return tag
  }

  /**
   * Adds tags to collection
   */
  add(...tag: FastTag[]): this {
    this.tags.push(...tag.map(this.rebuild))
    return this
  }

  /**
   * Update tag at index
   */
  update(index: number, callback: (tag: ITag, tags: ITag[]) => FastTag): this {
    this.tags.splice(index, 1, this.rebuild(callback(this.tags[index], this.tags)))
    return this
  }

  /**
   * Remove tag at index
   */
  remove(index: number): this {
    this.tags.splice(index, 1)
    return this
  }

  /**
   * Performs operations at index
   */

  //  * @returns {{add: (tag: Tag) => this, update: (callback: any) => this, remove: () => this}}
  at(_index: number) {
    const index = _index < 0 ? this.tags.length + _index : _index
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this

    /**
     * Adds tags to collection after index
     */
    function add(...tag: FastTag[]): typeof self {
      self.tags.splice(index, 0, ...tag.map(self.rebuild))
      return self
    }

    /**
     * Update tag at index
     */
    function update(index: number, callback: (tag: ITag, tags: ITag[]) => FastTag): typeof self {
      return self.update(index, callback)
    }

    /**
     * Removes tag at index
     */
    function remove(): typeof self {
      return self.remove(index)
    }

    return { add, update, remove }
  }

  /**
   * Performs operations on first match of type
   */
  type(...types: string[]) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this

    // finds the index of first tag with specific type
    // its a function in case some tag item has its type changed in between
    const index = () => {
      for (const type of types) {
        let i = self.tags.findIndex(tag => tag.type?.includes(type))
        if (i > -1) return i
      }

      return -1
    }
    const lastIndex = () => {
      for (const type of types) {
        let i = findLastIndex(self.tags, tag => tag.type?.includes(type))
        if (i > -1) return i
      }

      return -1
    }

    /**
     *  Adds tags before first match of type
     */
    function add(...tag: FastTag[]): typeof self {
      self.tags.splice(index(), 0, ...tag.map(self.rebuild))
      return self
    }

    /**
     * Pushes tags after last match of type
     */
    function push(...tag: FastTag[]): typeof self {
      self.tags.splice(lastIndex() + 1, 0, ...tag.map(self.rebuild))
      return self
    }

    /**
     * Updates first tag that matches type
     */
    function update(callback: (tag: ITag, tags: ITag[]) => FastTag): typeof self {
      return self.update(index(), callback)
    }

    /**
     * Removes all tags from a certain type
     */
    function remove() {
      self.tags = self.tags.filter(tag => !tag.type?.some(type => types.includes(type)))
    }

    return { add, push, update, remove }
  }
}
