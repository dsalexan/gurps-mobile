/* eslint-disable no-debugger */
import { flatten, isArray, isNil, uniq, uniqBy, orderBy as _orderBy, has, orderBy, sum, groupBy, intersection, unzip } from "lodash"
import BaseFeature from "../../gurps-mobile/core/feature/base"
import type { GCS } from "../types/gcs"
import type { GCA } from "../../gurps-mobile/core/gca/types"
import { GurpsMobileActor } from "../../gurps-mobile/foundry/actor"
import { MathNode, evaluate } from "mathjs"
import { isNilOrEmpty, isNumeric } from "../../december/utils/lodash"
import mathInstance, {
  MathPrintOptions,
  MathScope,
  ignorableSymbols,
  mathError,
  parseExpression,
  prepareScope,
  preprocess,
  setupExpression,
  toHTML,
} from "../../december/utils/math"
import { LOGGER } from "../../mobile"
import { Logger } from "../../december/utils"
import { specializedName } from "../../gurps-mobile/core/feature/utils"
import { GURPS4th } from "../types/gurps4th"
import GenericFeature from "../../gurps-mobile/foundry/actor/feature/generic"

// #region types

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ILevelDefinition extends GCA.Expression {
  math: never
  tags: string[]

  parse(feature: GenericFeature, actor: GurpsMobileActor): ILevel | null
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
  relative: IRelativeLevel
}

export interface IRelativeLevel {
  expression: string
  scope: MathScope<object>
  //
  getNode(): {
    node: MathNode
    scope: MathScope<object>
  }
  toString(): string
  toHTML(options?: MathPrintOptions): string
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
export function stringifyRelativeSkillLevel({ expression, definitions }: Partial<IRelativeLevel> = {}, { showZero = true, acronym = false } = {}): string {
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

    if (value === 0 && !showZero) continue

    const classes = flags ?? []
    let _content = content
    const prefix = _prefix ?? `∂`

    if (acronym) {
      _content = Handlebars.helpers[`gurpsIcon`](type)?.string
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
        .join(` `)}>${_content ?? value}</span>`,
    )
  }

  return `${formattedExpression}`
}

// #endregion

// #region parsing

/**
 * Parse a object (usually a GCA.Expression or a GCS.EntryDefault) into a Level definition
 */
export function parseLevelDefinition(object: GCA.Expression | GCS.EntryDefault): ILevelDefinition {
  if (object.type === `flat`) debugger

  // GCA.Expression
  if (has(object, `_raw`) && (has(object, `expression`) || has(object, `math`))) {
    object.tags = [] as string[]
    object.parse = (feature: GenericFeature, actor: GurpsMobileActor) => parseLevel(object as any, feature, actor)
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
    const skillIndexes = isNil(_default.specialization) ? GCA.index.bySection.SKILLS.byName[_default.name as string] : GCA.index.bySection.SKILLS.byFullname[fullName]

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

  roll.parse = (feature: GenericFeature, actor: GurpsMobileActor) => parseLevel(roll as any, feature, actor)
  return roll
}

/**
 * Get scope for a level definition
 */
export function parseScope(levelDefinition: ILevelDefinition, feature: GenericFeature, actor: GurpsMobileActor) {
  const { entries, targetsByType, types } = setupCheck(levelDefinition)

  const variables = [] as IVariableDefinition[]
  for (const [variable, target] of entries) {
    const definition = parseExpressionTarget(variable, target, feature, actor)

    variables.push(definition)
  }

  const variableScope = Object.fromEntries(variables.map(definition => [definition.variable, definition.value]))

  return variableScope
}

export function parseNode(expression: string, baseScope: object, me?: object) {
  const math = mathInstance()
  const node = math.parse(expression)

  let scope = undefined as any as ReturnType<typeof prepareScope>
  try {
    scope = prepareScope(node, me, baseScope as any)
  } catch (error) {
    mathError(expression, baseScope, error)
    debugger
  }

  return { node, scope }
}

/**
 * Parses a level definition into level object (level and relative level)
 */
export function parseLevel(levelDefinition: ILevelDefinition, feature: GenericFeature, actor: GurpsMobileActor): ILevel | null {
  let level: number
  const variableScope = parseScope(levelDefinition, feature, actor)
  const viable = Object.values(variableScope).every(value => !isNil(value))

  if (!viable) return null

  const expression = preprocess(levelDefinition.expression.replaceAll(/∂/g, ``))
  const calculation = parseNode(expression, variableScope, feature)

  const code = calculation.node.compile()
  level = code.evaluate(calculation.scope)

  return {
    level,
    relative: {
      expression,
      getNode() {
        return parseNode(this.expression)
      },
      toString() {
        return calculation
      },
    },
  }
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
      value = (me.sources.gca?.[variable] as any).toString()

      if (isNil(value.match(/[@%]\w+\(/i))) {
        // ERROR: Unimplemented transform
        debugger
      } else {
        value = parseExpression(value, me)
        if (value !== null) {
          content = value
        } else {
          content = `!!`
          flags.push(`error`)
        }
      }
    }
  } else if (target.type === `skill`) {
    // SKILL
    //    get skill level from another skill
    id = null
    let skillIndexes = target.value as number[]

    if (dynamic) skillIndexes = [] // TODO: Deal with dynamic shit

    // ERROR: Unimplemented for undefined list of skills (target.value === undefined)
    if (skillIndexes?.length === undefined) debugger

    // list all trained skills in skills
    //    remove duplicates by id
    const skillEntries = skillIndexes.map(index => GCA.entries[index])
    const skillFeatures = skillIndexes.map(index => actor.cache.gca?.skill?.[index]).filter(skill => !isNil(skill))
    const trainedSkills = skillFeatures.filter(skill => skill.data.training === `trained`)

    if (trainedSkills.length > 0) {
      // transform if needed
      const trainedSkill = trainedSkills[0]
      const level = trainedSkill.data.level === undefined ? trainedSkill.data.attributeBasedLevel : trainedSkill.data.level
      value = level?.level
      content = trainedSkill.specializedName

      // ERROR: Unimplemented
      if (isNil(value)) debugger

      for (const transform of transforms) {
        // if (transform === `level`) // do nothing, "level" for skill is already sl

        // ERROR: Unimplemented
        if (transform !== `level`) debugger
      }

      id = trainedSkill.id
    } else {
      // untrained skill
      value = null
    }
  } else if (target.type === `attribute`) {
    // ERROR: Unimplemented
    if (transforms.length > 0) debugger
    if (dynamic) debugger

    const attribute = target.fullName as GURPS4th.Attributes
    value = (actor.system.attributes[attribute.toUpperCase()] ?? actor.system[attribute.toLowerCase().replaceAll(/ +/g, ``)]).value

    // WARN: Checking UNTESTED attributes
    if (![`ST`, `DX`, `IQ`, `HT`, `PER`, `WILL`, `DODGE`, `BASIC SPEED`].includes(attribute.toUpperCase())) debugger

    // The Rule of 20 (B 173) applies only to defaulting skills to attributes (not every level math is about skills m8)
  } else if (target.type === `flat`) {
    // ERROR: CANNOT BE
    if (target.value === undefined) debugger

    value = target.value as number
    content = target.value!.toString()

    flags.push(`constant`)
  } else if (target.type === `unknown`) {
    LOGGER.warn(`Unimplemented "${target.type}" target`, target)

    content = `??`
    flags.push(`unknown`)
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
  if (viable) return parseExpression(relative.expression.replaceAll(/∂/g, ``), undefined, scope)

  return null
}

// #endregion

export function buildLevel(baseLevel: number, bonus: number, { attribute, skill, flat, flags }: { flags?: string[]; attribute?: string; skill?: string; flat?: string }) {
  const level = baseLevel + bonus
  const sign = bonus > 0 ? `+` : bonus < 0 ? `-` : ``

  const definition: IVariableDefinition = {
    variable: `A`,
    value: baseLevel,
  } as any

  if (flags) definition.flags = flags

  if (attribute !== undefined) {
    definition.type = `attribute`
    definition.content = attribute
  }

  if (skill !== undefined) {
    definition.type = `skill`
    definition.content = skill
  }

  if (flat !== undefined) {
    definition.type = `flat`
    definition.content = flat
  }

  const relative: IRelativeLevel = {
    expression: `∂A${bonus !== 0 ? ` ${sign} ${Math.abs(bonus)}` : ``}`,
    definitions: { A: definition },
  }

  const levelDefinition: ILevel = { level, relative }
  relative.toString = function (options) {
    return stringifyRelativeSkillLevel(relative, options)
  }

  return levelDefinition
}

export function orderLevels(levelDefinitions: ILevelDefinition[], feature: GenericFeature, actor: GurpsMobileActor) {
  let levels = levelDefinitions.map(level => level.parse(feature, actor)) as ILevel[]

  levels = orderBy(
    levels.filter(l => !isNil(l)),
    def => def.level,
    `desc`,
  )

  return levels
}

// #region TARGETS

export function setupCheck(definition: ILevelDefinition) {
  const entries = Object.entries(definition.targets ?? {})
  const [variables, targets] = unzip(entries) as [string[], GCA.ExpressionTarget[]]
  const targetsByType = groupBy(targets, `type`)
  const types = Object.keys(targetsByType)

  // ERROR: Untested viability of targetless definitions (if they really exist)  // COMMENT
  if (!definition.targets) debugger // COMMENT

  // ERROR: Untested, other types then skill/atribute // COMMENT
  if (!types.includes(`skill`) && !types.includes(`attribute`)) debugger // COMMENT

  // ERROR: Untested, multiple attributes in definition // COMMENT
  if (types.length === 1 && types[0] === `attribute` && targetsByType[`attribute`].length > 1) debugger // COMMENT

  return { entries, targets, variables, targetsByType, types }
}

export function allowedSkillTargets(definition: ILevelDefinition, allowedSkillList: number[], cachedSetup?: ReturnType<typeof setupCheck>) {
  let setup = cachedSetup
  if (!setup) setup = setupCheck(definition)
  const { targetsByType, types } = setup

  const skillTargets = targetsByType[`skill`] ?? []

  const allowedSkillTargets = skillTargets.filter(target => intersection((target.value as number[]) ?? [], allowedSkillList).length >= 1)

  return allowedSkillTargets
}

export function nonSkillOrAllowedSkillTargets(definition: ILevelDefinition, allowedSkillList: number[], cachedSetup?: ReturnType<typeof setupCheck>) {
  let setup = cachedSetup
  if (!setup) setup = setupCheck(definition)
  const { targets: targetList, targetsByType, types } = setup

  const targets = [] as GCA.ExpressionTarget[]

  // non-skills
  targets.push(...targetList.filter(target => target.type !== `skill`))

  // trained skills
  targets.push(...allowedSkillTargets(definition, allowedSkillList, setup))

  return targets
}

export function getFeaturesFromTarget(actor: GurpsMobileActor, target: GCA.ExpressionTarget) {
  if (target.type === `skill`) {
    const GCAIndexes = (target.value as number[]) ?? []
    const features = GCAIndexes.map(index => actor.cache.gca?.skill?.[index]).filter(skill => !isNil(skill))

    return features
  } else if (target.type === `attribute`) {
    debugger
  } else if (target.type === `me`) {
    debugger
  } else if (target.type === `unknown`) {
    debugger
  }

  // ERROR: Unimplemented
  debugger
  return []
}

// #endregion
