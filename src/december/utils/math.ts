import { isNil } from "lodash"
import { MathJsStatic, OperatorNode, create as _create, all } from "mathjs"

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

// mark the function as "rawArgs", so it will be called with unevaluated arguments
_if.rawArgs = true

export function create() {
  const math = _create(all)

  math.import({
    AT_if: _if,
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

  // ERROR: Unimplemented replacement for string
  if (treated.match(/:/)) debugger

  return treated
}

export const ignorableSymbols = [] as string[]
