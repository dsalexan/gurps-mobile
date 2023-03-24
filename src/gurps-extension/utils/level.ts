/* eslint-disable no-debugger */
import { flatten, isArray, isNil, uniq, uniqBy, orderBy as _orderBy, has, orderBy } from "lodash"
import BaseFeature from "../../gurps-mobile/core/feature/base"
import type { GCS } from "../types/gcs"
import type { GCA } from "../../gurps-mobile/core/gca/types"
import { GurpsMobileActor } from "../../gurps-mobile/foundry/actor"
import { evaluate } from "mathjs"
import { isNilOrEmpty, isNumeric } from "../../december/utils/lodash"
import mathInstance, { ignorableSymbols, preprocess } from "../../december/utils/math"
import { LOGGER } from "../../mobile"
import { Logger } from "../../december/utils"
import { specializedName } from "../../gurps-mobile/core/feature/utils"
import { GURPS4th } from "../types/gurps4th"
import GenericFeature, { IGenericFeature } from "../../gurps-mobile/core/feature/variants/generic"

// #region types

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ILevelDefinition extends GCA.Expression {
  tags: string[]

  parse(feature: GenericFeature | IGenericFeature, actor: GurpsMobileActor): ILevel | null
}

// export interface Expression {
//   _raw: string
//   math: boolean
//   expression: string
//   variables?: Record<string, string>
//   targets?: Record<string, ExpressionTarget>
//   value?: never
//   text?: never
// }

// export interface ExpressionTarget {
//   _raw: string // value from Expression.variables
//   type: `unknown` | `attribute` | `skill` | `me`
//   fullName: string
//   name: TargetProperty
//   nameext?: TargetProperty
//   attribute?: string
//   value?: string | number[] // attribute name (string) | array of entry indexes (number[])
//   transform?: string | string[]
// }

export interface ILevel {
  level: number
  relative?: IRelativeLevel
}
export interface IRelativeLevel {
  expression: string
  definitions: Record<IVariableDefinition[`variable`], IVariableDefinition>
  toString(options?: object): string
}
/**
 * Builds the definition for a variable (its value, any flags that should be displayed, any live transformations, etc...)
 */
export interface IVariableDefinition {
  variable: string
  content: string | number
  value: number | null
  flags: string[]
  type?: string
  id?: string | null
  transforms?: string[]
  prefix?: string
}

// #endregion

// #region stringify

/**
 *  Parses a relative level definition into a html string
 */
export function stringifyRelativeSkillLevel({ expression, definitions }: Partial<IRelativeLevel> = {}, { skillAcronym = false } = {}): string {
  // ERROR: Unimplemented
  if (expression === undefined) {
    debugger
    return `-`
  }
  let formattedExpression = expression.replaceAll(/([-+*/])/g, `<span class="operator">$1</span>`)

  for (const definition of Object.values(definitions ?? {})) {
    const {
      viable,
      //
      variable,
      type,
      id,
      content,
      value,
      //
      transforms,
      flags,
      prefix: _prefix,
    } = definition

    const classes = flags ?? []
    let _content = content
    const prefix = _prefix ?? `∂`

    if (skillAcronym && type === `skill`) {
      _content = Handlebars.helpers[`gurpsIcon`](`skill`)?.string
      classes.push(`acronym`)
    }

    const data = {
      name: variable,
      type,
      id,
      value,
      ...Object.fromEntries(transforms?.map(transform => [`transform-${transform}`, true]) ?? []),
    }

    formattedExpression = formattedExpression.replace(
      (prefix ?? ``) + variable,
      `<span class="variable ${classes.filter(b => !!b).join(` `)}" ${Object.entries(data)
        .map(([prop, value]) => (isNil(value) ? `` : `data-${prop}="${value}"`))
        .join(` `)}>${_content}</span>`,
    )
  }

  return `<div class="roll">${formattedExpression}</div>`
}

// #endregion

// #region parsing

/**
 * Parse a object (usually a GCA.Expression or a GCS.EntryDefault) into a Level definition
 */
export function parseLevelDefinition(object: GCA.Expression | GCS.EntryDefault): ILevelDefinition {
  // GCA.Expression
  if (has(object, `_raw`) && (has(object, `expression`) || has(object, `math`))) {
    object.tags = [] as string[]
    object.parse = (feature: GenericFeature | IGenericFeature, actor: GurpsMobileActor) => parseLevel(object as any, feature, actor)
    return object as ILevelDefinition
  }

  // GCS.EntryDefault
  const _default = object as GCS.EntryDefault
  let roll = {
    _raw: JSON.stringify(_default),
    math: true,
    tags: [] as string[],
  } as ILevelDefinition

  if ([`dx`, `st`, `iq`, `ht`].includes(_default.type)) {
    const attribute = _default.type.toUpperCase()

    if (_default.name !== undefined) debugger
    if (_default.specialization !== undefined) debugger
    // ERROR: Unimplemented non-numeric modifier
    if (!isNil(_default.modifier) && !isNumeric(_default.modifier) && typeof _default.modifier !== `number`) debugger

    roll.expression = `∂A ${_default.modifier ?? ``}`.trim()
    roll.variables = {
      [`A`]: attribute,
    }
    roll.targets = {
      [`A`]: {
        _raw: attribute,
        type: `attribute`,
        fullName: attribute,
        name: attribute,
        value: attribute,
      },
    }
  } else if (_default.type === `skill`) {
    // ERROR: Unimplemented
    if (isNil(_default.name)) debugger
    const fullName = specializedName(_default.name as string, _default.specialization)
    const skillIndexes = isNil(_default.specialization) ? GCA.index.bySection.SKILLS.byName[_default.name as string] : GCA.index.bySection.SKILLS.byNameExt[fullName]

    if (skillIndexes === undefined) debugger
    // ERROR: Unimplemented non-numeric modifier
    if (!isNil(_default.modifier) && !isNumeric(_default.modifier) && typeof _default.modifier !== `number`) debugger

    roll.expression = `∂A ${_default.modifier ?? ``}`.trim()
    roll.variables = {
      [`A`]: fullName,
    }
    roll.targets = {
      [`A`]: {
        _raw: fullName,
        type: `skill`,
        fullName,
        name: _default.name as string,
        nameext: _default.specialization,
        value: skillIndexes,
      },
    }
  } else {
    // ERROR: Unimplemented
    debugger
  }

  roll.parse = (feature: GenericFeature | IGenericFeature, actor: GurpsMobileActor) => parseLevel(roll as any, feature, actor)
  return roll
}

/**
 * Parses a level definition into level object (level and relative level)
 */
export function parseLevel(expression: ILevelDefinition, feature: GenericFeature | IGenericFeature, actor: GurpsMobileActor): ILevel | null {
  const definitions = Object.entries(expression.targets ?? {}).map(([variable, target]) => parseExpressionTarget(variable, target, feature as GenericFeature, actor))

  const scope = Object.fromEntries(definitions.map(definition => [definition.variable, definition.value]))
  let level: number

  const viable = Object.values(scope).every(value => !isNil(value))
  if (viable) {
    level = evaluate(expression.expression.replaceAll(/∂/g, ``), scope)

    return {
      level,
      relative: {
        expression: expression.expression,
        definitions: Object.fromEntries(definitions.map(definition => [definition.variable, definition])),
        toString(options) {
          return stringifyRelativeSkillLevel(this, options)
        },
      },
    }
  }

  return null
}

/**
 * Parses a expression target (from a roll definition) into a variable definition (with numeric values and shit)
 */
export function parseExpressionTarget(variable: string, target: GCA.ExpressionTarget, feature: GenericFeature, actor: GurpsMobileActor): IVariableDefinition {
  const me = feature
  const transforms = isNil(target.transform) ? [] : isArray(target.transform) ? target.transform : [target.transform]

  // ERROR: There should be no "specialization" in target
  // eslint-disable-next-line no-debugger
  if ((target as any).specialization !== undefined) debugger

  const dynamic = target.name?.type === `dynamic` || target.nameext?.type === `dynamic`

  // relative definition
  let value: null | any = null
  let flags: [boolean | string] = [dynamic && `dynamic`]
  let type = target.type
  let id: null | string = target.fullName
  let content: string | number = target.fullName

  if (target.fullName === `me` || target.type === `me`) {
    // ME
    //    usually when some value is attached to the entry in GCA

    // TODO: check here when IF EXPRESSION goes online

    // ERROR: Unimplemented
    if (transforms.length !== 1) debugger
    if (dynamic) debugger

    id = `me`
    value = me[transforms[0]]
    if (isNumeric(value)) {
      content = value = parseFloat(value)
      flags.push(`constant`)
    } else if (isNil(transforms[0])) {
      // ERROR: Unimplemented
      debugger
    } else {
      const variable = transforms[0]
      value = me.__compilation.sources.gca?.[variable].toString()

      if (isNil(value.match(/[@%]\w+\(/i))) {
        // ERROR: Unimplemented transform
        debugger
      } else {
        const expression = preprocess(value)
        const math = mathInstance()
        const parser = math.parser()

        try {
          const node = math.parse(expression)
          const symbols = node.filter((node: any) => node.isSymbolNode).map((node: any) => node.name)

          // scope = fillScope(parser, symbols)
          for (const symbol of symbols) {
            if (ignorableSymbols.some(s => s.toUpperCase() === symbol.toUpperCase())) continue
            if (math[symbol] !== undefined) continue

            const ui = symbol.indexOf(`_`)
            const prefix = symbol.substring(0, ui).toLowerCase()
            const name = symbol.substring(ui + 1)

            if (prefix === `me`) {
              const _value = me[name]

              // ERROR: Unimplemented
              if (isNil(_value)) debugger

              // scope[symbol] = _value
              parser.set(symbol, _value)
            } else {
              // ERROR: Unimplemented
              debugger
            }
          }

          value = parser.evaluate(expression)
          content = value
        } catch (error) {
          Logger.get(`roll`).warn(`Could not parse expression`, variable, `→`, expression, [
            `font-style: italic; color: rgba(92, 60, 0, 0.65);`,
            `font-style: regular; color: rgba(92, 60, 0); font-weight: bold;`,
            `font-weight: regular; color: rgba(92, 60, 0, 0.75);`,
            `font-weight: bold; color: black;`,
          ])

          const _debug = expression.split(``)
          console.log(expression)
          console.log(` `)
          console.log(_debug.map((char, index) => `${char}`.padEnd(2, ` `)).join(` `))
          console.log(_debug.map((char, index) => `${index + 1}`.padEnd(2, ` `)).join(` `))
          console.log(` `)
          console.log(error)

          debugger

          value = null
          content = `!!`
          flags.push(`error`)
        }
      }
    }
  } else if (target.type === `skill`) {
    // SKILL
    //    get skill level from another skill
    id = null
    let skills = target.value as number[]

    if (dynamic) skills = [] // TODO: Deal with dynamic shit

    // ERROR: Unimplemented for undefined list of skills (target.value === undefined)
    if (skills?.length === undefined) debugger

    // list all trained skills in skills
    //    remove duplicates by id
    const trainedSkills = uniqBy(
      flatten(
        skills.map(skillIndex => {
          const entry = GCA.entries[skillIndex]
          const skillsByName = actor.cache._skill?.[specializedName(entry.name, entry.nameext)]

          if (!skillsByName) return []
          return Object.values(skillsByName).filter(skill => !skill.untrained)
        }),
      ),
      `id`,
    )

    if (trainedSkills.length > 0) {
      // transform if needed
      const trainedSkill = trainedSkills[0]
      value = trainedSkill.sl
      for (const transform of transforms) {
        // if (transform === `level`) // do nothing, "level" for skill is already sl

        // ERROR: Unimplemented
        if (transform !== `level`) debugger
      }

      id = trainedSkill.id
    }
  } else if (target.type === `attribute`) {
    // ERROR: Unimplemented
    if (transforms.length > 0) debugger
    if (dynamic) debugger

    const attribute = target.fullName as GURPS4th.Attributes
    value = (actor.system.attributes[attribute] ?? actor.system[attribute]).value

    // The Rule of 20, B 173
    value = Math.min(20, value)
  } else {
    debugger

    content = `??`
    flags.push(`unknown`)
  }

  // ERROR: Noo dawg
  if (isNaN(value)) debugger

  return {
    variable,
    type,
    id,
    content,
    value,
    //
    transforms,
    flags: uniq(flags).filter(b => !!b && !isNilOrEmpty(b)) as string[],
  }
}

export function calculateLevel(relative: IRelativeLevel) {
  const scope = Object.fromEntries(Object.values(relative.definitions).map(definition => [definition.variable, definition.value]))

  const viable = Object.values(scope).every(value => !isNil(value))
  if (viable) return evaluate(relative.expression.replaceAll(/∂/g, ``), scope)

  return null
}

// #endregion

export function orderLevels(levelDefinitions: ILevelDefinition[], feature: GenericFeature | IGenericFeature, actor: GurpsMobileActor) {
  let levels = levelDefinitions.map(level => level.parse(feature, actor)) as ILevel[]

  levels = orderBy(
    levels.filter(l => !isNil(l)),
    def => def.level,
    `desc`,
  )

  return levels
}
