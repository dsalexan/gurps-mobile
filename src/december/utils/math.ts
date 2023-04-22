import { isFunction, isNil } from "lodash"
import { MathJsStatic, OperatorNode, create as _create, all } from "mathjs"
import Logger from "./logger"

// #region functions
function _if(args: OperatorNode[], math: MathJsStatic, scope: Map<string, any>) {
  const expressions = args.map(arg => arg.toString())

  // ERROR: Unimplemented
  if (expressions.length !== 3) debugger

  // const pattern = condition.match(/(.*) ?THEN ?(.*) ?ELSE ?(.*)/i) as RegExpMatchArray
  const condition = expressions[0]
  const _then = expressions[1]
  const _else = expressions[2]

  // ERROR: Unimplemented
  if (!condition) debugger

  const ternary = math.evaluate(condition, scope)

  let result: any
  if (ternary) {
    result = math.evaluate(_then, scope)
  } else {
    result = math.evaluate(_else, scope)
  }

  return result
}
_if.rawArgs = true // mark the function as "rawArgs", so it will be called with unevaluated arguments

function _int(x: number) {
  return Math.floor(x)
}

function _hasmod(args: OperatorNode[], math: MathJsStatic, scope: Map<string, any>) {
  const expressions = args.map(arg => arg.toString())

  // ERROR: Untested
  if (expressions.length > 1) debugger

  const modifier = expressions[0].replace(/"([^"])"/g, `$1`)
  const feature = scope.get(`__me`)
  // TODO: Implement modifiers in feature
  const modifiers = [] as string[] // feature.data.modifier

  return modifiers.includes(modifier) ? 1 : 0
}
_hasmod.rawArgs = true // mark the function as "rawArgs", so it will be called with unevaluated arguments

// #endregion

export function create() {
  const math = _create(all)

  math.import({
    AT_if: _if,
    AT_int: _int,
    AT_hasmod: _hasmod,
  })

  return math
}

export default function mathInstance() {
  if (window.MATHJS_INSTANCE === undefined) {
    window.MATHJS_INSTANCE = create()
  }

  return window.MATHJS_INSTANCE as MathJsStatic
}

export function preprocess(expression: string) {
  const treated = expression
    .replaceAll(/@/g, `AT_`)
    .replaceAll(/%/g, `P_`)
    .replaceAll(/me::/g, `ME_`)
    .replaceAll(/(?<!=)=(?!=)/g, `==`)
    .replaceAll(/ then /gi, `,`)
    .replaceAll(/ else /gi, `,`)
    .replaceAll(/(AT_hasmod\()([\w\d\-"'\[\] ]+)(\))/gi, `$1"$2"$3`)

  // ERROR: Unimplemented replacement for string
  if (treated.match(/:/)) debugger

  return treated
}

export const ignorableSymbols = [] as string[]

export function parseExpression(stringExpression: string, me?: object) {
  const expression = preprocess(stringExpression)
  const math = mathInstance()
  const parser = math.parser()

  try {
    const node = math.parse(expression)
    const symbols = node.filter((node: any) => node.isSymbolNode).map((node: any) => node.name)

    for (const symbol of symbols) {
      if (ignorableSymbols.some(s => s.toUpperCase() === symbol.toUpperCase())) continue
      if (math[symbol] !== undefined) continue

      const ui = symbol.indexOf(`_`)
      const prefix = symbol.substring(0, ui).toLowerCase()
      const name = symbol.substring(ui + 1)

      if (prefix === `me`) {
        if (me === undefined) throw new Error(`"me" was not informed, but expression tries to access its property "${name}".\n\n(${expression})`)
        let _value = me.data[name]

        if (name === `tl`) _value = me.data.tl.level

        // ERROR: Unimplemented
        if (isNil(_value)) debugger

        // scope[symbol] = _value
        parser.set(symbol, _value)
      } else if (prefix === `p`) {
        if (me === undefined) throw new Error(`"me" was not informed, but expression tries to access its property "${name}".\n\n(${expression})`)
        const property = me[name]

        // ERROR: Unimplemented
        if (property === undefined) debugger

        let _value = isFunction(property) ? property.call(me) : property

        // ERROR: Unimplemented
        if (isNil(_value)) debugger

        // CUSTOM IMPLEMENTATIONS
        //  TODO: Remove from here
        if (name === `level`) _value = _value.level

        parser.set(symbol, _value)
      } else {
        // ERROR: Unimplemented
        throw new Error(`Unimplemented function/prefix "${symbol}"`)
      }
    }

    parser.set(`__me`, me)

    return parser.evaluate(expression)
  } catch (error) {
    const logger = Logger.get(`math`)
    logger.warn(`Could not parse expression`, stringExpression, `→`, expression, [
      `font-style: italic; color: rgba(92, 60, 0, 0.65);`,
      `font-style: regular; color: rgba(92, 60, 0); font-weight: bold;`,
      `font-weight: regular; color: rgba(92, 60, 0, 0.75);`,
      `font-weight: bold; color: black;`,
    ])

    const _debug = expression.split(``)
    logger.info(expression)
    logger.info(`scope`, parser.scope)
    logger.info(` `)
    logger.info(_debug.map((char, index) => `${char}`.padEnd(2, ` `)).join(` `))
    logger.info(_debug.map((char, index) => `${index + 1}`.padEnd(2, ` `)).join(` `))
    logger.info(` `)
    logger.info(error)

    debugger

    return null
  }
}
