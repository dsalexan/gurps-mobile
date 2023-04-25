import { get, intersection, isArray, isEmpty, isNil, isObjectLike, isString } from "lodash-es"
import { MODULE_ID } from "config"

export class TemplatePreloader {
  /**
   * Preload a set of templates to compile and cache them for fast access during rendering
   */
  static preloadHandlebarsTemplates() {
    const paths = [`__WEBPACK__ALL_TEMPLATES__`]
    const templatePaths = paths.filter(path => !path.includes(`partials`))
    const partialPaths = paths.filter(path => path.includes(`partials`))

    partialPaths.forEach(filename => {
      const name = filename.substr(filename.indexOf(`partials`) + `partials`.length + 1).replace(/(.*)\.hbs/, `$1`)
      fetch(filename)
        .then(content => content.text())
        .then(text => {
          Handlebars.registerPartial(name, text)
        })
    })

    return loadTemplates(templatePaths)
  }

  /**
   * Preload generic handlebars helpers
   */
  static preloadHandlebarsHelpers() {
    Handlebars.registerHelper(`info`, function (...args) {
      console.log(...args)
    })

    Handlebars.registerHelper(`prop`, ({ hash }: { hash: { name: string; value: string } }) => {
      const { name, value } = hash
      if (value === undefined) return ``
      return `${name}="${value}"`
    })

    Handlebars.registerHelper(`for`, function (from, to, incr, block) {
      let accum = ``
      for (let i = from; i < to; i += incr) accum += block.fn(i)
      return accum
    })

    Handlebars.registerHelper(`some`, function (array, value, ifTrue, ifFalse = ``) {
      if (isNil(array)) return ifFalse
      return array.some(item => item === value) ? ifTrue : ifFalse
    })

    Handlebars.registerHelper(`equals`, function (a, b, c) {
      if (isArray(b) ? b?.includes(a) : a === b) return c
      return ``
    })

    Handlebars.registerHelper(`contains`, function (list, a, c) {
      const a_list = isArray(a) ? a : [a]
      if (intersection(list as any[], a_list).length > 0) return c
      return ``
    })

    Handlebars.registerHelper(`get`, function (object, path, defaultValue) {
      const _default = { array: [], object: {} }[defaultValue] ?? defaultValue
      return get(object, path, _default)
    })

    Handlebars.registerHelper(`keys`, a => Object.keys(a))

    Handlebars.registerHelper(`isTrue`, (a, b) => (a ? b : ``))
    Handlebars.registerHelper(`isArray`, a => isArray(a))
    Handlebars.registerHelper(`nullishCoalescing`, (a, b = ``) => a ?? b)

    Handlebars.registerHelper(`percentage`, (value, max) => (value / max) * 100)
    Handlebars.registerHelper(`join`, array => (array === undefined ? `` : array.join(` `)))
    Handlebars.registerHelper(`slice`, (array, a, b) => (isArray(array) ? array.slice(a, b) : array))

    Handlebars.registerHelper(`isEqual`, (a, b) => a === b)
    Handlebars.registerHelper(`isString`, a => isString(a))
    Handlebars.registerHelper(`isObjectLike`, a => isObjectLike(a))
    Handlebars.registerHelper(`isArray`, a => isArray(a))

    Handlebars.registerHelper(`isNil`, function (a, b, c = ``) {
      return isNil(a) ? b : c
    })
    Handlebars.registerHelper(`isNilOrEmpty`, function (a, b, c = ``) {
      return isNil(a) || isEmpty(a) || (isArray(a) && a.length === 0) ? b : c
    })

    Handlebars.registerHelper(`sum`, (a, b) => a + b)
  }
}
