/* eslint-disable no-debugger */
import {
  flatten,
  isArray,
  isNil,
  uniq,
  uniqBy,
  orderBy as _orderBy,
  has,
  orderBy,
  sum,
  groupBy,
  intersection,
  unzip,
  omit,
  isFunction,
  isString,
  mapValues,
  get,
  escape,
} from "lodash"
import BaseFeature from "../../gurps-mobile/core/feature/base"
import type { GCS } from "../types/gcs"
import type { GCA } from "../../gurps-mobile/core/gca/types"
import { GurpsMobileActor } from "../../gurps-mobile/foundry/actor"
import { MathNode, evaluate } from "mathjs"
import { isNilOrEmpty, isNumeric, push } from "../../december/utils/lodash"
import mathInstance, { MathPrintOptions, MathScope, buildScope, ignorableSymbols, mathError, parseExpression, preprocess, setupExpression, toHTML } from "../../december/utils/math"
import { LOGGER } from "../../mobile"
import { Logger } from "../../december/utils"
import { specializedName } from "../../gurps-mobile/core/feature/utils"
import { GURPS4th } from "../types/gurps4th"
import GenericFeature from "../../gurps-mobile/foundry/actor/feature/generic"
import { TypeVariable } from "typescript"

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
      const multiValue = parseVariable(definition.variables[name], me, actor)

      symbolValue = multiValue
    } else {
      // ERROR: Unimplemented
      debugger
      throw new Error(`Unimplemented function/prefix "${symbol}"`)
    }

    // // ERROR: Unimplemented
    // if (isNil(symbolValue.number)) debugger

    scope[symbol] = symbolValue
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
    scope = prepareScope(node, definition, me, actor)
  } catch (error) {
    mathError(expression, scope, error)
    debugger
    scope = prepareScope(node, definition, me, actor)
  }

  const numericScope = mapValues(scope, value => value.number ?? value.string)

  const viable = Object.values(numericScope).every(value => !isNil(value))
  if (!viable) return null

  let value: number = undefined as any as number
  try {
    const code = node.compile()
    value = code.evaluate(numericScope)
  } catch (error) {
    mathError(expression, scope, error)
    debugger
    const code = node.compile()
    value = code.evaluate(numericScope)
  }

  if (value === undefined) return null

  const level = {
    value,
    expression,
    scope,
    definition,
  } as ILevel

  return level
}

export function levelToHTML(level: ILevel, options: Omit<MathPrintOptions, `label`> & { simplify?: boolean | string[]; acronym?: boolean } = {}) {
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
  return toHTML(node, {
    html(node, options: Omit<MathPrintOptions, `label`> & { simplify?: boolean | string[]; acronym?: boolean }) {
      if (node.type === `SymbolNode`) {
        const name = escape(node.name)

        let html = {} as Record<string, true> & {
          classes?: string[]
          type?: string
          content?: string
          value?: number
        }

        if (name.startsWith(`VAR_`)) {
          const handle = name.substring(4)
          const variable = level.definition.variables[handle]

          html.type = variable.type
          for (const transform of variable.transforms ?? []) html[`transform-${transform}`] = true
          for (const flag of variable.flags ?? []) push(html, `classes`, flag)

          if (options.acronym && [`skill`].includes(variable.type)) {
            push(html, `classes`, `acronym`)
            html.content = Handlebars.helpers[`gurpsIcon`](variable.type)?.string
          }
        }

        if (has(level.scope, name)) {
          const value = level.scope[name]
          html.value = value.number
          if (!html.content && !isNil(value.string)) html.content = value.string
        }

        return Object.keys(html).length === 0 ? undefined : html
      }
    },
    ...options,
  })
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
  type: `unknown` | `attribute` | `skill` | `me` | `constant` // type of variable, indicates which algorithm to use to acquire numeric value
  value?: unknown // arguments to supply numeric acquiring algorithm
  transforms?: string[] // any transforms to apply to numeric value
  //
  label: string // printable string to show in place of numeric variable
  flags?: string[]
}

export interface IUnknownVariable<THandle extends string = string> extends IBaseVariable<THandle> {
  type: `unknown`
  meta: {
    fullName: string
    name: GCA.TargetProperty | string
    nameext?: GCA.TargetProperty | string
  }
  //
  value: undefined
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

export interface IConstantVariable<THandle extends string = string> extends IBaseVariable<THandle> {
  type: `constant`
  //
  value: number
}

export type IVariable<THandle extends string = string> =
  | IUnknownVariable<THandle>
  | IAttributeVariable<THandle>
  | ISkillVariable<THandle>
  | IMeVariable<THandle>
  | IConstantVariable<THandle>

export type VariableType<TVariable extends IVariable> = TVariable[`type`]
export type VariableValue<TVariable extends IVariable> = TVariable[`value`]

// ```

export interface CreateVariableOptions<THandle extends string = string, TVariable extends IVariable<THandle> = IVariable<THandle>> {
  _raw?: string
  meta?: TVariable[`meta`]
  label?: TVariable[`label`]
  transforms?: TVariable[`transforms`]
  flags?: TVariable[`flags`]
}

export function createVariable<THandle extends string = string, TVariable extends IVariable<THandle> = IVariable<THandle>>(
  handle: THandle,
  type: VariableType<TVariable>,
  value: VariableValue<TVariable>,
  options: CreateVariableOptions<THandle, TVariable> = {},
): TVariable {
  const variable = {
    _raw: options._raw ?? `∂${handle}`,
    handle,
    //
    type,
    value,
  } as TVariable

  if (type === `skill` && variable.value === undefined) variable.value = [] as number[]

  // ERROR: Checks
  if (type === `me`) {
    if (!isString(variable.value)) debugger
  } else if (type === `skill`) {
    if (!isArray(variable.value)) debugger
  } else if (type === `unknown`) {
    if (!isNil(variable.value)) debugger
  }

  if (options.meta) variable.meta = options.meta
  if (options.label) variable.label = options.label
  if (options.transforms) variable.transforms = options.transforms
  if (options.flags) variable.flags = options.flags

  return variable
}

export function parseVariable<TMe extends GenericFeature = GenericFeature, THandle extends string = string>(variable: IVariable<THandle>, me: TMe, actor: GurpsMobileActor) {
  const _middleTransforms = [] as RegExp[]
  const _postTransforms = [/max=\d+/i]

  const _transforms = variable.transforms ?? []

  const invalidTransforms = [] as string[]
  const postTransforms = [] as string[]
  const transforms = [] as string[]

  for (const transform of _transforms) {
    if (_middleTransforms.some(expected => expected.test(transform))) transforms.push(transform)
    else if (_postTransforms.some(expected => expected.test(transform))) postTransforms.push(transform)
    else invalidTransforms.push(transform)
  }

  // TODO: Deal with dynamic
  const dynamicMeta = Object.values(variable.meta ?? {}).some(value => value?.type === `dynamic`)
  if (dynamicMeta) LOGGER.get(`level`).warn(`Found dynamic metadata in variable`, `"${variable.label ?? `${variable.type}:${variable.value}`}"`, `from`, variable._raw, variable)

  // ERROR: Unimplemented
  if (invalidTransforms.length !== 0) debugger
  if (dynamicMeta) debugger

  let value: { number: number; string?: string } = { number: null } as any

  if (variable.type === `me`) {
    if (has(me, variable.value as keyof TMe)) {
      const _value = get(me, variable.value as keyof TMe)

      if (isNumeric(_value) || typeof _value === `number`) {
        value.number = parseFloat(_value)
      } else if (!isNil(_value)) {
        value.string = _value?.toString()
        debugger
      }
    } else {
      const originalExpression = me.sources.gca?.[variable.value]?.toString()
      if (isNil(originalExpression)) debugger

      const math = mathInstance()
      const expression = preprocess(originalExpression!)
      const node = math.parse(expression)

      let scope = {} as MathScope
      try {
        scope = buildScope(node, me, scope)
      } catch (error) {
        mathError(originalExpression!, scope, error)
        debugger
      }

      const code = node.compile()
      const _value = code.evaluate(scope)

      if (isNumeric(_value) || typeof _value === `number`) {
        value.number = parseFloat(_value)
      } else {
        debugger
        value.string = _value?.toString()
      }
    }
  } else if (variable.type === `attribute`) {
    const attribute = variable.value as GURPS4th.Attributes
    const _value = (actor.system.attributes[attribute.toUpperCase()] ?? actor.system[attribute.toLowerCase().replaceAll(/ +/g, ``)]).value

    value.number = parseFloat(_value)
    value.string = attribute.toUpperCase()

    // WARN: Checking UNTESTED attributes
    if (![`ST`, `DX`, `IQ`, `HT`, `PER`, `WILL`, `DODGE`, `BASIC SPEED`].includes(attribute.toUpperCase())) debugger

    // The Rule of 20 (B 173) applies only to defaulting skills to attributes (not every level math is about skills m8)
  } else if (variable.type === `skill`) {
    let skillIndexes = variable.value

    // TODO: Deal with dynamic shit
    if (dynamicMeta) skillIndexes = []

    // ERROR: Unimplemented for undefined list of skills (target.value === undefined)
    if (skillIndexes?.length === undefined) debugger

    // list all skills
    //    remove duplicates by id
    const skillEntries = skillIndexes.map(index => GCA.entries[index])
    const skillFeatures = skillIndexes.map(index => actor.cache.gca?.skill?.[index]).filter(skill => !isNil(skill))

    const knownSkills = skillFeatures.filter(skill => skill.data.training !== `unknown`)

    if (skillFeatures.length > 0) {
      const orderedByLevel = orderBy(knownSkills, skill => skill.data.level?.value ?? skill.data.attributeBasedLevel?.value ?? -Infinity, `desc`)
      // transform if needed
      const skill = orderedByLevel[0]

      // ERROR: Cannotb
      if (isNil(skill.data.attributeBasedLevel) && isNil(skill.data.level)) debugger

      const level = skill.data.level === undefined ? skill.data.attributeBasedLevel : skill.data.level

      value.number = level!.value
      value.string = skill.specializedName

      // ERROR: Unimplemented
      if (isNil(value.number)) debugger

      for (const transform of transforms) {
        // if (transform === `level`) // do nothing, "level" for skill is already sl

        // ERROR: Unimplemented
        if (transform !== `level`) debugger
      }
    } else {
      // no skill here
      value.number = null
    }
  } else if (variable.type === `constant`) {
    value.number = parseFloat(variable.value)
  } else {
    // ERROR: Unimplemented
    debugger
  }

  for (const transform of postTransforms) {
    const [name, arg] = transform.split(`=`)

    if (name === `max`) {
      if (!isNil(value.number)) value.number = Math.min(value.number, parseFloat(arg))
    } else if (name === `min`) {
      if (!isNil(value.number)) value.number = Math.max(value.number, parseFloat(arg))
    } else {
      // ERROR: Unimplemented transform
      debugger
    }
  }

  return value
}

// #region Variable checks

export function setupCheck(definition: ILevelDefinition) {
  const variables = Object.values(definition.variables ?? {})
  const variablesByType = groupBy(variables, `type`)
  const types = Object.keys(variablesByType)

  // ERROR: Untested viability of targetless definitions (if they really exist)  // COMMENT
  if (!definition.variables) debugger // COMMENT

  // ERROR: Untested, other types then skill/atribute // COMMENT
  if (!types.includes(`skill`) && !types.includes(`attribute`)) debugger // COMMENT

  // ERROR: Untested, multiple attributes in definition // COMMENT
  if (types.length === 1 && types[0] === `attribute` && variablesByType[`attribute`].length > 1) debugger // COMMENT

  return { variables, variablesByType, types }
}

export function allowedSkillVariables(definition: ILevelDefinition, allowedSkillList: number[], cachedSetup?: ReturnType<typeof setupCheck>) {
  let setup = cachedSetup
  if (!setup) setup = setupCheck(definition)
  const { variablesByType } = setup

  const skillVariables = variablesByType[`skill`] ?? []

  const allowedSkillVariables = skillVariables.filter(target => intersection((target.value as number[]) ?? [], allowedSkillList).length >= 1)

  return allowedSkillVariables
}

export function nonSkillOrAllowedSkillVariables(definition: ILevelDefinition, allowedSkillList: number[], cachedSetup?: ReturnType<typeof setupCheck>) {
  let setup = cachedSetup
  if (!setup) setup = setupCheck(definition)
  const { variables } = setup

  const nonSkillOrAllowedSkillVariables = [] as IVariable[]

  // non-skills
  nonSkillOrAllowedSkillVariables.push(...variables.filter(target => target.type !== `skill`))

  // trained skills
  nonSkillOrAllowedSkillVariables.push(...allowedSkillVariables(definition, allowedSkillList, setup))

  return nonSkillOrAllowedSkillVariables
}

export function getFeaturesFromVariable(actor: GurpsMobileActor, variable: IVariable) {
  if (variable.type === `skill`) {
    const GCAIndexes = (variable.value as number[]) ?? []
    const features = GCAIndexes.map(index => actor.cache.gca?.skill?.[index]).filter(skill => !isNil(skill))

    return features
  } else if (variable.type === `attribute`) {
    debugger
  } else if (variable.type === `me`) {
    debugger
  } else if (variable.type === `constant`) {
    debugger
  }

  // ERROR: Unimplemented
  debugger
  return []
}

// #endregion

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
    } else if (expressionTarget.type === `attribute`) {
      variable = createVariable<typeof handle, IAttributeVariable<typeof handle>>(handle, `attribute`, expressionTarget.value as string, {
        label: expressionTarget.fullName,
        meta: { name: expressionTarget.fullName },
      })
    } else if (expressionTarget.type === `skill`) {
      if (isNil(expressionTarget.value)) LOGGER.get(`gca`).error(`Target`, `"${expressionTarget._raw}"`, `came from GCA without a value`, expressionTarget, object)

      variable = createVariable<typeof handle, ISkillVariable<typeof handle>>(handle, `skill`, expressionTarget.value as number[], {
        label: expressionTarget.fullName,
        meta: {
          fullName: expressionTarget.fullName,
          name: expressionTarget.name,
          nameext: expressionTarget.nameext,
        },
      })
    } else if (expressionTarget.type === `unknown`) {
      variable = createVariable<typeof handle, IUnknownVariable<typeof handle>>(handle, `unknown`, expressionTarget.value as undefined, {
        label: expressionTarget.fullName,
        meta: {
          fullName: expressionTarget.fullName,
          name: expressionTarget.name,
          nameext: expressionTarget.nameext,
        },
      })
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
