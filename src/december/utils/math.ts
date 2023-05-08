/* eslint-disable no-debugger */
import { isFunction, isNil } from "lodash"
import { ConstantNode, MathJsStatic, MathNode, OperatorNode, SymbolNode, create as _create, all, typeOf } from "mathjs"
import Logger from "./logger"

import { getAssociativity, getPrecedence, isAssociativeWith, properties } from "../../../node_modules/mathjs/lib/esm/expression/operators"
import { isNode, isConstantNode, isOperatorNode, isParenthesisNode } from "../../../node_modules/mathjs/lib/esm/utils/is"

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

export const ignorableSymbols = [] as string[]

export function preprocess(expression: string) {
  const treated = expression
    .replaceAll(/∂/g, `VAR_`)
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

export function mathError(originalExpression: string, scope: object, error: Error) {
  const preparedExpression = preprocess(originalExpression)

  const logger = Logger.get(`math`)
  logger.warn(`Could not parse expression`, originalExpression, `→`, preparedExpression, [
    `font-style: italic; color: rgba(92, 60, 0, 0.65);`,
    `font-style: regular; color: rgba(92, 60, 0); font-weight: bold;`,
    `font-weight: regular; color: rgba(92, 60, 0, 0.75);`,
    `font-weight: bold; color: black;`,
  ])

  const _debug = preparedExpression.split(``)
  logger.info(preparedExpression)
  logger.info(`scope`, scope)
  logger.info(` `)
  logger.info(_debug.map((char, index) => `${char}`.padEnd(2, ` `)).join(` `))
  logger.info(_debug.map((char, index) => `${index + 1}`.padEnd(2, ` `)).join(` `))
  logger.info(` `)
  logger.info(error)

  debugger

  return null
}

export type MathScope = Record<string, number>

/**
 * Prepare a scope for mathjs to evaluate an expression. U
 */
export function prepareScope<TMe extends object = object>(
  node: MathNode,
  me?: TMe,
  baseScope?:
    | Map<string, any>
    | {
        [k: string]: number | null
      },
) {
  const math = mathInstance()
  const scope = {} as MathScope<TMe>

  const symbols = node.filter((node: any) => node.isSymbolNode).map((node: any) => node.name)

  for (const symbol of symbols) {
    if (ignorableSymbols.some(s => s.toUpperCase() === symbol.toUpperCase())) continue
    if (math[symbol] !== undefined) continue
    if (baseScope?.[symbol] !== undefined) continue

    const ui = symbol.indexOf(`_`)
    const prefix = symbol.substring(0, ui).toLowerCase()
    const name = symbol.substring(ui + 1)

    if (prefix === `me`) {
      if (me === undefined) throw new Error(`"me" was not informed, but expression tries to access its property "${name}".\n\n(${expression})`)
      let _value = me.data[name]

      if (name === `tl`) _value = me.data.tl.level

      // ERROR: Unimplemented
      if (isNil(_value)) debugger

      scope[symbol] = _value
    } else if (prefix === `p`) {
      if (me === undefined) throw new Error(`"me" was not informed, but expression tries to access its property "${name}".\n\n(${expression})`)
      const property = me[name]
      let _value

      // CUSTOM IMPLEMENTATIONS
      //  TODO: Remove from here
      if (name === `level`) {
        debugger
        _value = me.data.level?.level ?? me.data.level ?? 0
      } else {
        // ERROR: Unimplemented
        if (property === undefined) debugger

        _value = isFunction(property) ? property.call(me) : property
      }

      // ERROR: Unimplemented
      if (isNil(_value)) debugger

      scope[symbol] = _value
    } else {
      // ERROR: Unimplemented
      throw new Error(`Unimplemented function/prefix "${symbol}"`)
    }
  }

  scope[`__me`] = me
  if (baseScope) for (const [key, value] of Object.entries(baseScope)) scope[key] = value

  return scope
}

//

export function setupExpression(
  stringExpression: string,
  me?: object,
  baseScope?:
    | Map<string, any>
    | {
        [k: string]: number | null
      },
) {
  const expression = preprocess(stringExpression)
  const math = mathInstance()
  const scope = {} as any
  const parser = math.parser()

  try {
    const node = math.parse(expression)
    const symbols = node.filter((node: any) => node.isSymbolNode).map((node: any) => node.name)

    for (const symbol of symbols) {
      if (ignorableSymbols.some(s => s.toUpperCase() === symbol.toUpperCase())) continue
      if (math[symbol] !== undefined) continue
      if (baseScope?.[symbol] !== undefined) continue

      const ui = symbol.indexOf(`_`)
      const prefix = symbol.substring(0, ui).toLowerCase()
      const name = symbol.substring(ui + 1)

      if (prefix === `me`) {
        if (me === undefined) throw new Error(`"me" was not informed, but expression tries to access its property "${name}".\n\n(${expression})`)
        let _value = me.data[name]

        if (name === `tl`) _value = me.data.tl.level

        // ERROR: Unimplemented
        if (isNil(_value)) debugger

        scope[symbol] = _value
        parser.set(symbol, _value)
      } else if (prefix === `p`) {
        if (me === undefined) throw new Error(`"me" was not informed, but expression tries to access its property "${name}".\n\n(${expression})`)
        const property = me[name]
        let _value

        // CUSTOM IMPLEMENTATIONS
        //  TODO: Remove from here
        if (name === `level`) {
          _value = me.data.level?.level ?? 0
        } else {
          // ERROR: Unimplemented
          if (property === undefined) debugger

          _value = isFunction(property) ? property.call(me) : property
        }

        // ERROR: Unimplemented
        if (isNil(_value)) debugger

        scope[symbol] = _value
        parser.set(symbol, _value)
      } else {
        // ERROR: Unimplemented
        throw new Error(`Unimplemented function/prefix "${symbol}"`)
      }
    }

    scope[`__me`] = me
    if (baseScope) for (const [key, value] of Object.entries(baseScope)) scope[key] = value

    parser.set(`__me`, me)
    if (baseScope) for (const [key, value] of Object.entries(baseScope)) parser.set(key, value)

    return { parser, expression, scope, math }
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
    logger.info(`scope`, parser.scope, `x`, scope)
    logger.info(` `)
    logger.info(_debug.map((char, index) => `${char}`.padEnd(2, ` `)).join(` `))
    logger.info(_debug.map((char, index) => `${index + 1}`.padEnd(2, ` `)).join(` `))
    logger.info(` `)
    logger.info(error)

    debugger

    return null
  }
}

export function parseExpression(
  stringExpression: string,
  me?: object,
  baseScope?:
    | Map<string, any>
    | {
        [k: string]: number | null
      },
) {
  const setup = setupExpression(stringExpression, me, baseScope)
  if (!setup) return null

  const { parser, expression } = setup

  return parser.evaluate(expression)
}

// #region HTML Parsing

/**
 * Returns true if the expression starts with a constant, under
 * the current parenthesization:
 * @param {Node} expression
 * @param {string} parenthesis
 * @return {boolean}
 */
function startsWithConstant(expr, parenthesis) {
  let curNode = expr
  if (parenthesis === `auto`) {
    while (isParenthesisNode(curNode)) {
      curNode = curNode.content
    }
  }
  if (isConstantNode(curNode)) return true
  if (isOperatorNode(curNode)) {
    return startsWithConstant(curNode.args[0], parenthesis)
  }
  return false
}

/**
 * Calculate which parentheses are necessary. Gets an OperatorNode
 * (which is the root of the tree) and an Array of Nodes
 * (this.args) and returns an array where 'true' means that an argument
 * has to be enclosed in parentheses whereas 'false' means the opposite.
 *
 * @param {OperatorNode} root
 * @param {string} parenthesis
 * @param {Node[]} args
 * @param {boolean} latex
 * @return {boolean[]}
 * @private
 */
function calculateNecessaryParentheses(root, parenthesis, implicit, args, latex) {
  // precedence of the root OperatorNode
  let precedence = getPrecedence(root, parenthesis, implicit)
  let associativity = getAssociativity(root, parenthesis)
  if (parenthesis === `all` || (args.length > 2 && root.getIdentifier() !== `OperatorNode:add` && root.getIdentifier() !== `OperatorNode:multiply`)) {
    return args.map(function (arg) {
      switch (arg.getContent().type) {
        // Nodes that don't need extra parentheses
        case `ArrayNode`:
        case `ConstantNode`:
        case `SymbolNode`:
        case `ParenthesisNode`:
          return false
        default:
          return true
      }
    })
  }
  let result
  switch (args.length) {
    case 0:
      result = []
      break
    case 1:
      // unary operators
      {
        // precedence of the operand
        let operandPrecedence = getPrecedence(args[0], parenthesis, implicit, root)

        // handle special cases for LaTeX, where some of the parentheses aren't needed
        if (latex && operandPrecedence !== null) {
          let operandIdentifier
          let rootIdentifier
          if (parenthesis === `keep`) {
            operandIdentifier = args[0].getIdentifier()
            rootIdentifier = root.getIdentifier()
          } else {
            // Ignore Parenthesis Nodes when not in 'keep' mode
            operandIdentifier = args[0].getContent().getIdentifier()
            rootIdentifier = root.getContent().getIdentifier()
          }
          if (properties[precedence][rootIdentifier].latexLeftParens === false) {
            result = [false]
            break
          }
          if (properties[operandPrecedence][operandIdentifier].latexParens === false) {
            result = [false]
            break
          }
        }
        if (operandPrecedence === null) {
          // if the operand has no defined precedence, no parens are needed
          result = [false]
          break
        }
        if (operandPrecedence <= precedence) {
          // if the operands precedence is lower, parens are needed
          result = [true]
          break
        }

        // otherwise, no parens needed
        result = [false]
      }
      break
    case 2:
      // binary operators
      {
        let lhsParens // left hand side needs parenthesis?
        // precedence of the left hand side
        let lhsPrecedence = getPrecedence(args[0], parenthesis, implicit, root)
        // is the root node associative with the left hand side
        let assocWithLhs = isAssociativeWith(root, args[0], parenthesis)
        if (lhsPrecedence === null) {
          // if the left hand side has no defined precedence, no parens are needed
          // FunctionNode for example
          lhsParens = false
        } else if (lhsPrecedence === precedence && associativity === `right` && !assocWithLhs) {
          // In case of equal precedence, if the root node is left associative
          // parens are **never** necessary for the left hand side.
          // If it is right associative however, parens are necessary
          // if the root node isn't associative with the left hand side
          lhsParens = true
        } else if (lhsPrecedence < precedence) {
          lhsParens = true
        } else {
          lhsParens = false
        }
        let rhsParens // right hand side needs parenthesis?
        // precedence of the right hand side
        let rhsPrecedence = getPrecedence(args[1], parenthesis, implicit, root)
        // is the root node associative with the right hand side?
        let assocWithRhs = isAssociativeWith(root, args[1], parenthesis)
        if (rhsPrecedence === null) {
          // if the right hand side has no defined precedence, no parens are needed
          // FunctionNode for example
          rhsParens = false
        } else if (rhsPrecedence === precedence && associativity === `left` && !assocWithRhs) {
          // In case of equal precedence, if the root node is right associative
          // parens are **never** necessary for the right hand side.
          // If it is left associative however, parens are necessary
          // if the root node isn't associative with the right hand side
          rhsParens = true
        } else if (rhsPrecedence < precedence) {
          rhsParens = true
        } else {
          rhsParens = false
        }

        // handle special cases for LaTeX, where some of the parentheses aren't needed
        if (latex) {
          let _rootIdentifier
          let lhsIdentifier
          let rhsIdentifier
          if (parenthesis === `keep`) {
            _rootIdentifier = root.getIdentifier()
            lhsIdentifier = root.args[0].getIdentifier()
            rhsIdentifier = root.args[1].getIdentifier()
          } else {
            // Ignore ParenthesisNodes when not in 'keep' mode
            _rootIdentifier = root.getContent().getIdentifier()
            lhsIdentifier = root.args[0].getContent().getIdentifier()
            rhsIdentifier = root.args[1].getContent().getIdentifier()
          }
          if (lhsPrecedence !== null) {
            if (properties[precedence][_rootIdentifier].latexLeftParens === false) {
              lhsParens = false
            }
            if (properties[lhsPrecedence][lhsIdentifier].latexParens === false) {
              lhsParens = false
            }
          }
          if (rhsPrecedence !== null) {
            if (properties[precedence][_rootIdentifier].latexRightParens === false) {
              rhsParens = false
            }
            if (properties[rhsPrecedence][rhsIdentifier].latexParens === false) {
              rhsParens = false
            }
          }
        }
        result = [lhsParens, rhsParens]
      }
      break
    default:
      if (root.getIdentifier() === `OperatorNode:add` || root.getIdentifier() === `OperatorNode:multiply`) {
        result = args.map(function (arg) {
          let argPrecedence = getPrecedence(arg, parenthesis, implicit, root)
          let assocWithArg = isAssociativeWith(root, arg, parenthesis)
          let argAssociativity = getAssociativity(arg, parenthesis)
          if (argPrecedence === null) {
            // if the argument has no defined precedence, no parens are needed
            return false
          } else if (precedence === argPrecedence && associativity === argAssociativity && !assocWithArg) {
            return true
          } else if (argPrecedence < precedence) {
            return true
          }
          return false
        })
      }
      break
  }

  // Handles an edge case of parentheses with implicit multiplication
  // of ConstantNode.
  // In that case, parenthesize ConstantNodes that follow an unparenthesized
  // expression, even though they normally wouldn't be printed.
  if (args.length >= 2 && root.getIdentifier() === `OperatorNode:multiply` && root.implicit && parenthesis !== `all` && implicit === `hide`) {
    for (let i = 1; i < result.length; ++i) {
      if (startsWithConstant(args[i], parenthesis) && !result[i - 1] && (parenthesis !== `keep` || !isParenthesisNode(args[i - 1]))) {
        result[i] = true
      }
    }
  }
  return result
}

export interface MathPrintOptions {
  parenthesis?: `keep` | `auto` | `all`
  implicit?: `hide`
  handler?: (node: MathNode, options: Omit<MathPrintOptions, `handler`>) => string | undefined
}

export function toHTML(_node: MathNode, scope: object, options: MathPrintOptions = {}) {
  const custom = options?.handler?.(_node, options)
  if (typeof custom !== `undefined`) return custom

  const parenthesis = options.parenthesis ?? `keep`
  const implicit = options.implicit ?? `hide`

  // return specific functions by type
  if (_node.type === `OperatorNode`) {
    const node = _node as OperatorNode
    const children = node.args

    const parens = calculateNecessaryParentheses(node, parenthesis, implicit, children, false)

    if (children.length === 1) {
      // unary operators
      let assoc = getAssociativity(node, parenthesis)
      let operand = toHTML(children[0], options)

      if (parens[0]) {
        operand = `<span class="math-parenthesis math-round-parenthesis">(</span>` + operand + `<span class="math-parenthesis math-round-parenthesis">)</span>`
      }

      if (assoc === `right`) {
        // prefix operator
        return `<span class="math-operator math-unary-operator ` + `math-lefthand-unary-operator">` + escape(node.op) + `</span>` + operand
      } else {
        // postfix when assoc === 'left' or undefined
        return operand + `<span class="math-operator math-unary-operator ` + `math-righthand-unary-operator">` + escape(node.op) + `</span>`
      }
    } else if (children.length === 2) {
      // binary operatoes
      let lhs = toHTML(children[0], options) // left hand side
      let rhs = toHTML(children[1], options) // right hand side

      if (parens[0]) {
        // left hand side in parenthesis?
        lhs = `<span class="math-parenthesis math-round-parenthesis">(</span>` + lhs + `<span class="math-parenthesis math-round-parenthesis">)</span>`
      }

      if (parens[1]) {
        // right hand side in parenthesis?
        rhs = `<span class="math-parenthesis math-round-parenthesis">(</span>` + rhs + `<span class="math-parenthesis math-round-parenthesis">)</span>`
      }

      if (node.implicit && node.getIdentifier() === `OperatorNode:multiply` && implicit === `hide`) {
        return lhs + `<span class="math-operator math-binary-operator ` + `math-implicit-binary-operator"></span>` + rhs
      }

      return lhs + `<span class="math-operator math-binary-operator ` + `math-explicit-binary-operator">` + escape(node.op) + `</span>` + rhs
    } else {
      let stringifiedArgs = children.map(function (arg, index) {
        let html = arg.toHTML(options)
        if (parens[index]) {
          // put in parenthesis?
          html = `<span class="math-parenthesis math-round-parenthesis">(</span>` + html + `<span class="math-parenthesis math-round-parenthesis">)</span>`
        }

        return html
      })

      if (children.length > 2 && (this.getIdentifier() === `OperatorNode:add` || node.getIdentifier() === `OperatorNode:multiply`)) {
        if (node.implicit && node.getIdentifier() === `OperatorNode:multiply` && implicit === `hide`) {
          return stringifiedArgs.join(`<span class="math-operator math-binary-operator ` + `math-implicit-binary-operator"></span>`)
        }

        return stringifiedArgs.join(`<span class="math-operator math-binary-operator ` + `math-explicit-binary-operator">` + escape(node.op) + `</span>`)
      } else {
        // fallback to formatting as a function call
        return (
          `<span class="math-function">` +
          escape(node.fn) +
          `</span><span class="math-paranthesis math-round-parenthesis">` +
          `(</span>` +
          stringifiedArgs.join(`<span class="math-separator">,</span>`) +
          `<span class="math-paranthesis math-round-parenthesis">)</span>`
        )
      }
    }
  } else if (_node.type === `FunctionNode`) {
    const node = _node as OperatorNode
    const children = node.args

    const html = children.map(function (arg) {
      return toHTML(arg, options)
    })

    // format the arguments like "add(2, 4.2)"
    return (
      `<span class="math-function">` +
      escape(node.fn) +
      `</span><span class="math-paranthesis math-round-parenthesis">(</span>` +
      html.join(`<span class="math-separator">,</span>`) +
      `<span class="math-paranthesis math-round-parenthesis">)</span>`
    )
  } else if (_node.type === `SymbolNode`) {
    const node = _node as SymbolNode
    const name = escape(node.name)

    if (name === `true` || name === `false`) {
      return `<span class="math-symbol math-boolean">` + name + `</span>`
    } else if (name === `i`) {
      return `<span class="math-symbol math-imaginary-symbol">` + name + `</span>`
    } else if (name === `Infinity`) {
      return `<span class="math-symbol math-infinity-symbol">` + name + `</span>`
    } else if (name === `NaN`) {
      return `<span class="math-symbol math-nan-symbol">` + name + `</span>`
    } else if (name === `null`) {
      return `<span class="math-symbol math-null-symbol">` + name + `</span>`
    } else if (name === `undefined`) {
      return `<span class="math-symbol math-undefined-symbol">` + name + `</span>`
    }

    return `<span class="math-symbol">` + name + `</span>`
  } else if (_node.type === `ConstantNode`) {
    const node = _node as ConstantNode

    const value = node._toString(options)

    switch (typeOf(node.value)) {
      case `number`:
      case `BigNumber`:
      case `Fraction`:
        return `<span class="math-number">` + value + `</span>`
      case `string`:
        return `<span class="math-string">` + value + `</span>`
      case `boolean`:
        return `<span class="math-boolean">` + value + `</span>`
      case `null`:
        return `<span class="math-null-symbol">` + value + `</span>`
      case `undefined`:
        return `<span class="math-undefined">` + value + `</span>`
      default:
        return `<span class="math-symbol">` + value + `</span>`
    }
  } else {
    // ERROR: Unimplemented
    debugger
  }
}

// #endregion
