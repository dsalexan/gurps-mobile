/* eslint-disable no-debugger */
import { flatten, isArray, isNil, uniq, uniqBy, orderBy as _orderBy, has, orderBy, sum, groupBy, intersection, unzip, omit, isFunction, isString, mapValues } from "lodash"
import BaseFeature from "../../gurps-mobile/core/feature/base"
import type { GCS } from "../types/gcs"
import type { GCA } from "../../gurps-mobile/core/gca/types"
import { GurpsMobileActor } from "../../gurps-mobile/foundry/actor"
import { MathNode, evaluate } from "mathjs"
import { isNilOrEmpty, isNumeric } from "../../december/utils/lodash"
import mathInstance, { MathPrintOptions, MathScope, ignorableSymbols, mathError, parseExpression, preprocess, setupExpression, toHTML } from "../../december/utils/math"
import { LOGGER } from "../../mobile"
import { Logger } from "../../december/utils"
import { specializedName } from "../../gurps-mobile/core/feature/utils"
import { GURPS4th } from "../types/gurps4th"
import GenericFeature from "../../gurps-mobile/foundry/actor/feature/generic"

// #region Final level representation

/**
 * A level object (with its algebraic source)
 */
export interface ILevel<THandle extends string = string> {
  value: number
  expression: string
  scope: CompoundMathScope // holds many types for each variable, but usually numeric and string
  definition: ILevelDefinition<THandle>
}

export type CompoundMathScope = Record<string, { number: number; string?: string }>

/**
 * Get scope for a level definition (based on its variables)
 */
export function prepareScope<TMe extends GenericFeature = GenericFeature>(
  node: MathNode,
  definition: ILevelDefinition,
  me: TMe,
  actor: GurpsMobileActor,
  options: { ignore?: string[] } = {},
) {
  const scope = {} as CompoundMathScope
  const math = mathInstance()

  const symbols = node.filter((node: any) => node.isSymbolNode).map((node: any) => node.name)

  for (const symbol of symbols) {
    if (options.ignore?.some(s => s.toUpperCase() === symbol.toUpperCase())) continue
    if (math[symbol] !== undefined) continue

    const firstUnderscoreIndex = symbol.indexOf(`_`)
    const prefix = symbol.substring(0, firstUnderscoreIndex).toUpperCase()
    const name = symbol.substring(firstUnderscoreIndex + 1)

    let symbolValue: { number: number; string?: string } = { number: null } as any

    if (prefix === `ME`) {
      if (me === undefined) throw new Error(`"me" was not informed, but expression tries to access its property "me::${name}".`)
      debugger

      symbolValue.number = me.data[name]
      if (name === `tl`) symbolValue.number = me.data.tl.level

      debugger
    } else if (prefix === `P`) {
      if (me === undefined) throw new Error(`"me" was not informed, but expression tries to access its property "%${name}".`)

      debugger

      const property = me[name]

      // CUSTOM IMPLEMENTATIONS
      if (name === `level`) {
        //  TODO: There should be an accessor for level like %level instead of me::level???
        debugger
        symbolValue.number = me.data.level?.level ?? me.data.level ?? 0
      } else {
        // ERROR: Unimplemented
        if (property === undefined) debugger

        symbolValue.number = isFunction(property) ? property.call(me) : property
      }
    } else if (prefix === `VAR`) {
      debugger
      const multiValue = parseVariable(definition.variables[name], me, actor)

      symbolValue = multiValue
    } else {
      // ERROR: Unimplemented
      debugger
      throw new Error(`Unimplemented function/prefix "${symbol}"`)
    }

    // ERROR: Unimplemented
    if (isNil(symbolValue.number)) debugger

    scope[symbol] = symbolValue
    debugger
  }

  return scope
}

/**
 * Calculate numeric value from a level definition
 */
export function calculateLevel<TMe extends GenericFeature = GenericFeature>(definition: ILevelDefinition, me: TMe, actor: GurpsMobileActor): ILevel | null {
  const math = mathInstance()

  const expression = preprocess(definition.expression)
  const node = math.parse(expression)

  let scope = {} as CompoundMathScope
  try {
    scope = prepareScope(node, {} as any, me, actor)
  } catch (error) {
    mathError(expression, scope, error)
    debugger
  }

  const numericScope = mapValues(scope, value => value.number)

  const viable = Object.values(numericScope).every(value => !isNil(value))
  if (!viable) return null

  const code = node.compile()
  const value = code.evaluate(numericScope)

  const level = {
    value,
    expression,
    scope,
    definition,
  } as ILevel

  return level
}

export function levelToHTML(level: ILevel, options: MathPrintOptions & { simplify?: boolean | string[] } = {}) {
  const math = mathInstance()
  const completeNode = math.parse(level.expression)

  let node = completeNode
  if (options.simplify) {
    const simplifyScope = options.simplify === true ? level.scope : Object.fromEntries(options.simplify.map(symbol => [symbol, level.scope[symbol]]))
    node = math.simplify(completeNode, simplifyScope)
  }

  // TODO: Acronym
  // TODO: Transforms and flags
  // TODO: Take label from variable into consideration
  // TODO: Add variable.value from definition into a data-tag in HTML
  return toHTML(node, options)
}

export function levelToString(level: ILevel, options: MathPrintOptions & { simplify?: boolean | string[] } = {}) {
  const math = mathInstance()
  const completeNode = math.parse(level.expression)

  let node = completeNode
  if (options.simplify) {
    const simplifyScope = options.simplify === true ? level.scope : Object.fromEntries(options.simplify.map(symbol => [symbol, level.scope[symbol]]))
    node = math.simplify(completeNode, simplifyScope)
  }

  return node.toString(options)
}

// #endregion

// #region Variable definition

/**
 * Describes the base of a variable object
 */
export interface IBaseVariable<THandle extends string = string> {
  _raw: string // raw expression, before any preprocessing
  meta?: unknown // metadata from GCA/GCS source
  handle: THandle // variable handle (usually a letter)
  //
  type: `attribute` | `skill` | `me` // type of variable, indicates which algorithm to use to acquire numeric value
  value?: unknown // arguments to supply numeric acquiring algorithm
  transforms?: string[] // any transforms to apply to numeric value
  //
  label: string // printable string to show in place of numeric variable
  flags?: string[]
}

export interface IAttributeVariable<THandle extends string = string> extends IBaseVariable<THandle> {
  type: `attribute`
  meta?: {
    name: string
  }
  //
  value: string
}

export interface ISkillVariable<THandle extends string = string> extends IBaseVariable<THandle> {
  type: `skill`
  meta?: {
    fullName: string
    name: GCA.TargetProperty | string
    nameext?: GCA.TargetProperty | string
  }
  //
  value: number[]
}

export interface IMeVariable<THandle extends string = string> extends IBaseVariable<THandle> {
  type: `me`
  //
  value: string
}

export type IVariable<THandle extends string = string> = IAttributeVariable<THandle> | ISkillVariable<THandle> | IMeVariable<THandle>

export function createVariable<THandle extends string = string, TVariable extends IVariable<THandle> = IVariable<THandle>>(
  handle: THandle,
  type: TVariable[`type`],
  value: TVariable[`value`],
  options: { _raw?: string; meta?: TVariable[`meta`]; label?: TVariable[`label`]; transforms?: TVariable[`transforms`]; flags?: TVariable[`flags`] } = {},
): TVariable {
  const variable = {
    _raw: options._raw ?? `∂${handle}`,
    handle,
    //
    type,
    value,
  } as TVariable

  // ERROR: Checks
  if (type === `me`) {
    if (!isString(value)) debugger
  } else if (type === `skill`) {
    if (!isArray(value)) debugger
  }

  if (options.meta) variable.meta
  if (options.label) variable.label
  if (options.transforms) variable.transforms
  if (options.flags) variable.flags

  return variable
}

export function parseVariable<TMe extends GenericFeature = GenericFeature, THandle extends string = string>(variable: IVariable<THandle>, me: TMe, actor: GurpsMobileActor) {
  const transforms = variable.transforms ?? []

  // TODO: Deal with dynamic
  const dynamicMeta = Object.values(variable.meta ?? {}).some(value => value?.type === `dynamic`)
  if (dynamicMeta) LOGGER.get(`level`).warn(`Found dynamic metadata in variable`, `"${variable.label ?? `${variable.type}:${variable.value}`}"`, `from`, variable._raw, variable)

  // ERROR: Unimplemented
  if (transforms.length !== 0) debugger
  if (dynamicMeta) debugger

  let value: { number: number; string?: string } = { number: null } as any

  if (variable.type === `me`) {
    const _value = me[variable.value as keyof TMe]

    if (isNumeric(_value)) {
      value.number = parseFloat(_value)
    } else {
      value.string = (me.sources.gca?.[variable.value] as any).toString()

      debugger
    }
    debugger
  } else if (variable.type === `attribute`) {
    const attribute = variable.value as GURPS4th.Attributes
    const _value = (actor.system.attributes[attribute.toUpperCase()] ?? actor.system[attribute.toLowerCase().replaceAll(/ +/g, ``)]).value
    value.number = parseFloat(_value)

    // WARN: Checking UNTESTED attributes
    if (![`ST`, `DX`, `IQ`, `HT`, `PER`, `WILL`, `DODGE`, `BASIC SPEED`].includes(attribute.toUpperCase())) debugger

    // The Rule of 20 (B 173) applies only to defaulting skills to attributes (not every level math is about skills m8)
    debugger
  } else if (variable.type === `skill`) {
    let skillIndexes = variable.value

    // TODO: Deal with dynamic shit
    if (dynamicMeta) skillIndexes = []

    // ERROR: Unimplemented for undefined list of skills (target.value === undefined)
    if (skillIndexes?.length === undefined) debugger

    debugger
    // TODO: Should send level FOR ANY SKILL, trained or not. If the caller has a preference for any training, he should be able to specify on call

    // list all trained skills in skills
    //    remove duplicates by id
    const skillEntries = skillIndexes.map(index => GCA.entries[index])
    const skillFeatures = skillIndexes.map(index => actor.cache.gca?.skill?.[index]).filter(skill => !isNil(skill))
    const trainedSkills = skillFeatures.filter(skill => skill.data.training === `trained`)

    if (trainedSkills.length > 0) {
      // transform if needed
      const trainedSkill = trainedSkills[0]
      const level = trainedSkill.data.level === undefined ? trainedSkill.data.attributeBasedLevel : trainedSkill.data.level

      value.number = level?.level
      value.string = trainedSkill.specializedName

      // ERROR: Unimplemented
      if (isNil(value.number)) debugger

      for (const transform of transforms) {
        // if (transform === `level`) // do nothing, "level" for skill is already sl

        // ERROR: Unimplemented
        if (transform !== `level`) debugger
      }
    } else {
      // untrained skill
      value = null
    }

    debugger
  } else {
    // ERROR: Unimplemented
    debugger
  }

  // ERROR: Noo dawg
  if (isNil(value.number)) debugger

  return value
}

// #endregion

// #region Level definition

/**
 * Describes how to calculate a level
 */
export interface ILevelDefinition<THandle extends string = string> {
  _raw?: string // raw expression, before any preprocessing
  expression: string
  variables: Record<THandle, IVariable<THandle>>
  flags: string[] // any necessary flags (like 'other-based' for skill levels with different attribute bases then regular)
}

/**
 * Parse a object (usually a GCA.Expression or a GCS.EntryDefault) into a Level definition (a object that describes the calculation of a level, but doesn't actualy make the calculation)
 */
export function parseLevelDefinition(object: GCA.Expression | GCS.EntryDefault) {
  // GCA.Expression
  if (has(object, `_raw`) && (has(object, `expression`) || has(object, `math`))) return parseLevelDefinitionFromGCA(object)

  return parseLevelDefinitionFromGCS(object)
}

export function parseLevelDefinitionFromGCA(object: GCA.Expression) {
  const variables = {} as Record<string, IVariable>

  const targets = Object.entries(object.targets ?? {})

  // ERROR: Untested
  if (targets.length === 0) debugger

  for (const [handle, expressionTarget] of targets) {
    let variable: IVariable<typeof handle>

    if (expressionTarget.fullName === `me` || expressionTarget.type === `me`) {
      // ERROR: Unimplemented
      if (!isNil(expressionTarget.value)) debugger

      variable = createVariable<typeof handle, IMeVariable<typeof handle>>(handle, `me`, expressionTarget.transform as string)

      debugger
    } else if (expressionTarget.type === `attribute`) {
      variable = createVariable<typeof handle, IAttributeVariable<typeof handle>>(handle, `attribute`, expressionTarget.value as string, {
        label: expressionTarget.fullName,
        meta: { name: expressionTarget.fullName },
      })

      debugger
    } else if (expressionTarget.type === `skill`) {
      variable = createVariable<typeof handle, ISkillVariable<typeof handle>>(handle, `skill`, expressionTarget.value as number[], {
        label: expressionTarget.fullName,
        meta: {
          fullName: expressionTarget.fullName,
          name: expressionTarget.name,
          nameext: expressionTarget.nameext,
        },
      })

      debugger
    } else {
      // ERROR: Untested
      debugger

      continue
    }

    variable._raw = expressionTarget._raw
    if (expressionTarget.transform) {
      variable.transforms = isArray(expressionTarget.transform) ? expressionTarget.transform : [expressionTarget.transform]
      if (variable.type === `me`) variable.transforms.shift()
    }

    // ERROR: Repeating handles
    if (variables[handle] !== undefined) debugger

    variables[handle] = variable
  }

  return createLevelDefinition(object.expression, variables, { _raw: object._raw })
}

export function parseLevelDefinitionFromGCS(object: GCS.EntryDefault) {
  let definition: ILevelDefinition

  if ([`dx`, `st`, `iq`, `ht`].includes(object.type)) {
    const attribute = object.type.toUpperCase()

    // ERROR: This is skill shit, why is it here
    if (object.name !== undefined) debugger
    if (object.specialization !== undefined) debugger

    // ERROR: Unimplemented non-numeric modifier
    if (!isNil(object.modifier) && !isNumeric(object.modifier) && typeof object.modifier !== `number`) debugger

    const A = createVariable<`A`, IAttributeVariable<`A`>>(`A`, `attribute`, attribute, {
      label: attribute,
      meta: { name: attribute },
    })

    definition = createLevelDefinition(`∂A ${object.modifier ?? ``}`.trim(), { A }, { _raw: JSON.stringify(object) })

    debugger
  } else if (object.type === `skill`) {
    // ERROR: Unimplemented
    if (isNil(object.name)) debugger

    const fullName = specializedName(object.name!, object.specialization)
    const indexes = isNil(object.specialization) ? GCA.index.bySection.SKILLS.byName[object.name!] : GCA.index.bySection.SKILLS.byFullname[fullName]

    // ERROR: Must ALWAYS find GCA indexes
    if (indexes === undefined || indexes.length === 0) debugger

    // ERROR: Unimplemented non-numeric modifier
    if (!isNil(object.modifier) && !isNumeric(object.modifier) && typeof object.modifier !== `number`) debugger

    const S = createVariable<`S`, ISkillVariable<`S`>>(`S`, `skill`, indexes, {
      label: fullName,
      meta: {
        fullName: fullName,
        name: object.name!,
        nameext: object.specialization,
      },
    })

    definition = createLevelDefinition(`∂S ${object.modifier ?? ``}`.trim(), { S }, { _raw: JSON.stringify(object) })

    debugger
  } else {
    // ERROR: Unimplemented
    debugger

    definition = null as any
  }

  // ERROR: Unimplemented expressionless definition
  if (definition?.expression === ``) debugger

  return definition
}

export function createLevelDefinition<THandle extends string = string>(
  expression: string,
  variables: Record<THandle, IVariable<THandle>> | IVariable<THandle> = {} as any,
  options: { _raw?: string; flags?: string[] } = {},
) {
  const _variables = variables.handle !== undefined ? { [variables.handle]: variables } : variables

  const definition = { expression, variables: _variables } as ILevelDefinition<THandle>

  if (options._raw) definition._raw = options._raw
  if (options.flags) definition.flags = options.flags

  return definition
}

// #endregion
