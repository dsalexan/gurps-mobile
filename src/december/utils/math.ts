/* eslint-disable no-debugger */
import { isFunction, isNil, omit, set } from "lodash"
import { ConstantNode, FunctionNode, MathJsStatic, MathNode, OperatorNode, ParenthesisNode, SymbolNode, create as _create, all, typeOf } from "mathjs"
import Logger from "./logger"

import { getAssociativity, getPrecedence, isAssociativeWith, properties } from "../../../node_modules/mathjs/lib/esm/expression/operators"
import { isNode, isConstantNode, isOperatorNode, isParenthesisNode } from "../../../node_modules/mathjs/lib/esm/utils/is"
import { latexOperators, latexFunctions, defaultTemplate, toSymbol, escapeLatex } from "../../../node_modules/mathjs/lib/esm/utils/latex"
import LOGGER from "../../gurps-mobile/logger"

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

function _multiply(args: OperatorNode[], math: MathJsStatic, scope: Map<string, any>) {
  debugger
}
_multiply.rawArgs = true

// #endregion

export function create() {
  const math = _create(all)

  math.import(
    {
      AT_if: _if,
      AT_int: _int,
      AT_hasmod: _hasmod,
      multiply: _multiply,
    },
    { override: true },
  )

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
    .replaceAll(/ST:/g, `STAT_`)
    .replaceAll(/(?<!=)=(?!=)/g, `==`)
    .replaceAll(/ then /gi, `,`)
    .replaceAll(/ else /gi, `,`)
    .replaceAll(/(AT_hasmod\()([\w\d\-"'\[\] ]+)(\))/gi, `$1"$2"$3`)

  // ERROR: Unimplemented replacement for string
  if (treated.match(/:/)) debugger

  return treated
}

export function postprocess(node: MathNode) {
  const math = mathInstance()

  // index nodes
  node.traverse(function (node, path, parent) {
    if (!parent) node.path = null
    else node.path = `${parent.path ? `${parent.path}.` : ``}${path}`

    node.parent = parent
  })

  // decide which nodes to flat
  const flatOperations = [] as { path: string; node: SymbolNode }[]
  node.traverse(function (node, path, parent) {
    if (node.type === `OperatorNode` && node.op === `*` && node[`implicit`]) {
      const text = node.toString({ implicit: `hide` })
      const flatNode = new math.SymbolNode(text)

      // check if heritage is flagged for removal
      let elder = parent
      while (!isNil(elder)) {
        if (elder.removal) return
        elder = elder.parent
      }

      LOGGER.get(`math`).warn(`Flatening node (implicit multiplication)`, text, `->`, flatNode, `from`, node)
      // console.warn(`gurps-mobile`, `Flatening node (implicit multiplication)`, text, `->`, flatNode, `from`, node)

      // flag node for removal
      node.removal = true

      // add operation to list
      flatOperations.push({
        path: node.path,
        node: flatNode,
      })
    }
  })

  // ERROR: Untested >1 flat operations
  if (flatOperations.length > 1) debugger

  // propagate changes
  for (const { path, node: flatNode } of flatOperations) {
    // ERROR: Unimplemented flat operation on root
    if (!path) debugger

    set(node, path, flatNode)
  }
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

  // throw error

  return null
}

export type MathScope = Map<string, number>

/**
 * Prepare a scope for mathjs to evaluate an expression. U
 */
export function buildScope<TMe extends object = object>(
  node: MathNode,
  me?: TMe,
  baseScope?:
    | Map<string, any>
    | {
        [k: string]: number | null
      },
) {
  const math = mathInstance()
  const scope = new Map() as MathScope

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

      scope.set(symbol, _value)
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

      scope.set(symbol, _value)
    } else {
      // ERROR: Unimplemented
      throw new Error(`Unimplemented function/prefix "${symbol}"`)
    }
  }

  // @ts-ignore
  scope.set(`__me`, me)
  if (baseScope) for (const [key, value] of Object.entries(baseScope)) scope.set(key, value)

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
  const math = mathInstance()

  const expression = preprocess(stringExpression)
  const node = math.parse(expression)
  postprocess(node)

  const scope = new Map() as MathScope

  try {
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

        scope.set(symbol, _value)
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

        scope.set(symbol, _value)
      } else {
        // ERROR: Unimplemented
        throw new Error(`Unimplemented function/prefix "${symbol}"`)
      }
    }

    scope.set(`__me`, me)
    if (baseScope) for (const [key, value] of Object.entries(baseScope)) scope.set(key, value)

    return { node, expression, scope, math }
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

  const { node, expression, scope } = setup

  const code = node.compile()
  return code.evaluate(scope)
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

function toTree_helper(_node: MathNode, tabSize = 0, options: MathPrintOptions = {}) {
  const lines = [] as string[][]
  const tab = `  `

  const parenthesis = options.parenthesis ?? `keep`
  const implicit = options.implicit ?? `hide`

  if (_node.type === `OperatorNode`) {
    const node = _node as OperatorNode
    const children = node.args

    if (children.length === 1) {
      // unary operators
      let assoc = getAssociativity(node, parenthesis)

      lines.push([tab.repeat(tabSize), `[${node.type}]`, `${node.op} ${children[0].toString()}`])
      lines.push(...toTree_helper(children[0], tabSize + 1, options))
    } else if (children.length === 2) {
      // binary operatoes

      lines.push([tab.repeat(tabSize), `[${node.type}]`, `${children[0].toString()} ${node.op} ${children[1].toString()}`])
      lines.push(...toTree_helper(children[0], tabSize + 1, options))
      lines.push(...toTree_helper(children[1], tabSize + 1, options))
    } else {
      lines.push([tab.repeat(tabSize), `${node.op}`, `many`, node.type])
      lines.push([tab.repeat(tabSize), `[${node.type}]`, children.map(child => child.toString()).join(` ${node.op} `)])

      for (const child of children) {
        lines.push(...toTree_helper(child, tabSize + 1, options))
      }
    }
  } else if (_node.type === `FunctionNode`) {
    const node = _node as OperatorNode
    const children = node.args

    lines.push([tab.repeat(tabSize), `[${node.type}]`, children.map(child => child.toString()).join(` ${node.op} `)])

    for (const child of children) {
      lines.push(...toTree_helper(child, tabSize + 1, options))
    }
  } else if (_node.type === `SymbolNode`) {
    const node = _node as SymbolNode

    lines.push([tab.repeat(tabSize), `[${node.type}]`, `${node.name}`])
  } else if (_node.type === `ConstantNode`) {
    const node = _node as ConstantNode

    const value = node._toString(options)

    lines.push([tab.repeat(tabSize), `[${node.type}]`, `${value}`])
  } else if (_node.type === `ParenthesisNode`) {
    const node = _node as ParenthesisNode

    lines.push([tab.repeat(tabSize), `[${node.type}]`, `(...)`])
    lines.push(...toTree_helper(node.content, tabSize + 1, options))
  } else {
    // ERROR: Unimplemented
    debugger
  }

  return lines
}

export function toTree(node: MathNode, tabSize = 0, options: MathPrintOptions = {}): string {
  const lines = toTree_helper(node, tabSize, options)

  return lines.map(line => line.join(` `)).join(`\n`)
}

export interface MathPrintOptions {
  parenthesis?: `keep` | `auto` | `all`
  implicit?: `hide`
  handler?: (node: MathNode, options: Omit<MathPrintOptions, `handler`>) => string | undefined
  html?: (node: MathNode, options: Omit<MathPrintOptions, `handler`>) => (Record<string, true | string> & { classes?: string[] }) | undefined | void
  tex?: (node: MathNode, options: Omit<MathPrintOptions, `handler`>) => string | undefined | void
}

export function toHTML(_node: MathNode, options: MathPrintOptions = {}) {
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

      if (children.length > 2 && (node.getIdentifier() === `OperatorNode:add` || node.getIdentifier() === `OperatorNode:multiply`)) {
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
    const node = _node as FunctionNode
    const children = node.args

    const html = children.map(function (arg) {
      return toHTML(arg, options)
    })

    if (node.fn.name === `AT_int`) {
      return (
        `<span class="math-paranthesis math-round-parenthesis math-floor math-floor-open">⌊</span>` +
        html.join(`<span class="math-separator">,</span>`) +
        `<span class="math-paranthesis math-round-parenthesis math-floor math-floor-close">⌋</span>`
      )
    }

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

    const html = options?.html?.(_node, options) ?? {}

    const classes = (html.classes ?? []).filter(b => !!b).join(` `)
    const props = Object.entries(omit(html, [`classes`, `content`]))
      .map(([prop, value]) => (isNil(value) ? false : `data-${prop}="${value}"`))
      .filter(b => !!b)
      .join(` `)

    return `<span class="math-symbol ${classes}" data-name="${name}" ${props}>` + (html.content ?? name) + `</span>`
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
  } else if (_node.type === `ParenthesisNode`) {
    const node = _node as ParenthesisNode

    if (!options || (options && !options.parenthesis) || (options && options.parenthesis === `keep`)) {
      return `<span class="math-parenthesis math-round-parenthesis">(</span>` + toHTML(node.content, options) + `<span class="math-parenthesis math-round-parenthesis">)</span>`
    }

    return toHTML(node.content, options)
  } else {
    // ERROR: Unimplemented
    debugger
  }
}

/*
 * Expand a LaTeX template
 *
 * @param {string} template
 * @param {Node} node
 * @param {Object} options
 * @private
 **/
function expandTemplate(template, node, options) {
  let latex = ``

  // Match everything of the form ${identifier} or ${identifier[2]} or $$
  // while submatching identifier and 2 (in the second case)
  const regex = /\$(?:\{([a-z_][a-z_0-9]*)(?:\[([0-9]+)\])?\}|\$)/gi

  let inputPos = 0 // position in the input string
  let match
  while ((match = regex.exec(template)) !== null) {
    // go through all matches
    // add everything in front of the match to the LaTeX string
    latex += template.substring(inputPos, match.index)
    inputPos = match.index

    if (match[0] === `$$`) {
      // escaped dollar sign
      latex += `$`
      inputPos++
    } else {
      // template parameter
      inputPos += match[0].length
      const property = node[match[1]]
      if (!property) {
        throw new ReferenceError(`Template: Property ` + match[1] + ` does not exist.`)
      }
      if (match[2] === undefined) {
        // no square brackets
        switch (typeof property) {
          case `string`:
            latex += property
            break
          case `object`:
            if (isNode(property)) {
              latex += toTex(property, options)
            } else if (Array.isArray(property)) {
              // make array of Nodes into comma separated list
              latex += property
                .map(function (arg, index) {
                  if (isNode(arg)) {
                    return toTex(arg, options)
                  }
                  throw new TypeError(`Template: ` + match[1] + `[` + index + `] is not a Node.`)
                })
                .join(`,`)
            } else {
              throw new TypeError(`Template: ` + match[1] + ` has to be a Node, String or array of Nodes`)
            }
            break
          default:
            throw new TypeError(`Template: ` + match[1] + ` has to be a Node, String or array of Nodes`)
        }
      } else {
        // with square brackets
        if (isNode(property[match[2]] && property[match[2]])) {
          latex += toTex(property[match[2]], options)
        } else {
          throw new TypeError(`Template: ` + match[1] + `[` + match[2] + `] is not a Node.`)
        }
      }
    }
  }
  latex += template.slice(inputPos) // append rest of the template

  return latex
}

/**
 * Check whether some name is a valueless unit like "inch".
 * @param {string} name
 * @return {boolean}
 */
function isValuelessUnit(name) {
  const Unit = mathInstance().Unit
  return Unit ? Unit.isValuelessUnit(name) : false
}

export function toTex(_node: MathNode, options: MathPrintOptions = {}) {
  const custom = options?.handler?.(_node, options)
  if (typeof custom !== `undefined`) return custom

  const parenthesis = options && options.parenthesis ? options.parenthesis : `keep`
  const implicit = options && options.implicit ? options.implicit : `hide`

  if (_node.type === `OperatorNode`) {
    const node = _node as OperatorNode
    const children = node.args

    const parens = calculateNecessaryParentheses(node, parenthesis, implicit, children, true)

    let op = latexOperators[node.fn]
    op = typeof op === `undefined` ? node.op : op // fall back to using node.op

    if (children.length === 1) {
      const assoc = getAssociativity(node, parenthesis)

      let operand = toTex(children[0], options)
      if (parens[0]) operand = `\\left(${operand}\\right)`

      // prefix operator
      if (assoc === `right`) return op + operand

      // postfix operator
      if (assoc === `left`) return operand + op

      // fall back to postfix
      return operand + op
    } else if (children.length === 2) {
      const lhs = children[0] // left hand side
      let lhsTex = toTex(lhs, options)
      if (parens[0]) lhsTex = `\\left(${lhsTex}\\right)`

      const rhs = children[1] // right hand side
      let rhsTex = toTex(rhs, options)
      if (parens[1]) rhsTex = `\\left(${rhsTex}\\right)`

      // handle some exceptions (due to the way LaTeX works)
      //    Ignore ParenthesisNodes if in 'keep' mode
      let lhsIdentifier = parenthesis === `keep` ? lhs.getIdentifier() : lhs.getContent().getIdentifier()

      switch (node.getIdentifier()) {
        case `OperatorNode:divide`:
          // op contains '\\frac' at this point
          return op + `{` + lhsTex + `}` + `{` + rhsTex + `}`
        case `OperatorNode:pow`:
          lhsTex = `{` + lhsTex + `}`
          rhsTex = `{` + rhsTex + `}`
          switch (lhsIdentifier) {
            case `ConditionalNode`: //
            case `OperatorNode:divide`:
              lhsTex = `\\left(${lhsTex}\\right)`
          }
          break
        case `OperatorNode:multiply`:
          if (node.implicit && implicit === `hide`) {
            return lhsTex + `~` + rhsTex
          }
      }

      return lhsTex + op + rhsTex
    } else if (children.length > 2 && (node.getIdentifier() === `OperatorNode:add` || node.getIdentifier() === `OperatorNode:multiply`)) {
      const texifiedArgs = children.map(function (arg, index) {
        let tex = toTex(arg, options)

        if (parens[index]) tex = `\\left(${arg}\\right)`

        return tex
      })

      if (node.getIdentifier() === `OperatorNode:multiply` && node.implicit && implicit === `hide`) {
        return texifiedArgs.join(`~`)
      }

      return texifiedArgs.join(op)
    } else {
      // fall back to formatting as a function call
      // as this is a fallback, it doesn't use
      // fancy function names
      const texChildren = children.map(child => toTex(child, options))
      return `\\mathrm{${node.fn}}\\left(${texChildren.join(`,`)})\\right)`
    }
  } else if (_node.type === `FunctionNode`) {
    const node = _node as FunctionNode
    const children = node.args

    const math = mathInstance()

    // get LaTeX of the arguments
    const texChildren = children.map(child => toTex(child, options))

    if (node.fn.name === `AT_int`) return expandTemplate(`\\lfloor\${args}\\rfloor`, node, options)

    let latexConverter
    if (latexFunctions[node.name]) latexConverter = latexFunctions[node.name]

    // toTex property on the function itself
    //    .toTex is a callback function
    if (math[node.name] && (typeof math[node.name].toTex === `function` || typeof math[node.name].toTex === `object` || typeof math[node.name].toTex === `string`)) {
      latexConverter = math[node.name].toTex
    }

    let customToTex
    switch (typeof latexConverter) {
      case `function`: // a callback function
        customToTex = latexConverter(node, options)
        break
      case `string`: // a template string
        customToTex = expandTemplate(latexConverter, node, options)
        break
      case `object`:
        // an object with different "converters" for different
        // numbers of arguments
        switch (typeof latexConverter[texChildren.length]) {
          case `function`:
            customToTex = latexConverter[texChildren.length](node, options)
            break
          case `string`:
            customToTex = expandTemplate(latexConverter[texChildren.length], node, options)
            break
        }
    }

    if (typeof customToTex !== `undefined`) return customToTex

    return expandTemplate(defaultTemplate, node, options)
  } else if (_node.type === `SymbolNode`) {
    const node = _node as SymbolNode

    const math = mathInstance()

    let isUnit = false
    if (typeof math[node.name] === `undefined` && isValuelessUnit(node.name)) isUnit = true

    const tex = options?.tex?.(_node, options) ?? {}
    if (tex) return tex

    // no space needed if the symbol starts with '\'
    const symbol = toSymbol(html.content ?? node.name, isUnit)
    const space = symbol[0] === `\\` ? `` : ` `

    // the space prevents symbols from breaking stuff like '\cdot'
    // if it's written right before the symbol
    return space + symbol
  } else if (_node.type === `ConstantNode`) {
    const node = _node as ConstantNode

    const value = node._toString(options)

    switch (typeOf(node.value)) {
      case `string`:
        return `\\mathtt{` + escapeLatex(value) + `}`

      case `number`:
      case `BigNumber`:
        {
          if (!isFinite(node.value)) return node.value.valueOf() < 0 ? `-\\infty` : `\\infty`

          const index = value.toLowerCase().indexOf(`e`)
          if (index !== -1) return value.substring(0, index) + `\\cdot10^{` + value.substring(index + 1) + `}`
        }

        return value
      case `Fraction`:
        debugger
        return node.value.toLatex()

      default:
        return value
    }
  } else if (_node.type === `ParenthesisNode`) {
    const node = _node as ParenthesisNode

    if (!options || (options && !options.parenthesis) || (options && options.parenthesis === `keep`)) {
      return `\\left(${toTex(node.content, options)}\\right)`
    }
    return toTex(node.content, options)
  } else {
    // ERROR: Unimplemented
    debugger
  }
}

// #endregion
