import { cloneDeep, isNil, isObjectLike, isString } from "lodash"
import { Displayable } from "../../gurps-mobile/foundry/actor-sheet/context/feature/interfaces"
import { ILevel, levelToHTML } from "./level"
import { isPrimitive } from "../../december/utils/lodash"

export interface IBaseRoll {
  type: `regular` | `custom` | `damage`
  source: unknown
  //
  die?: string // dice formula, 3d6 by default
  target?: ILevel | number // roll 3d6 against this number
  //
  tags: string[]
}

export interface IRegularRoll extends IBaseRoll {
  type: `regular`
  source: never
}

export interface ICustomRoll extends IBaseRoll {
  type: `custom`
  source: never
}

export interface IDamageRoll extends IBaseRoll {
  type: `damage`
  source: {
    type: string
  }
}

export type IRoll = IRegularRoll | ICustomRoll | IDamageRoll

export interface IRollContextContent {
  primary?: string
  secondary?: string
  tertiary?: string
}

export interface IRollContext extends Displayable {
  step: number
  content: IRollContextContent[]
}

export function createRoll<TRoll extends IRoll = IRoll>(dieOrTarget: string | ILevel, type: TRoll[`type`], source?: TRoll[`source`], tags?: string[]): IRoll {
  const roll = {
    type,
    //
    tags: tags ?? [],
  } as TRoll

  if (source !== undefined) roll.source = source

  if (isString(dieOrTarget)) roll.die = dieOrTarget
  else if (!isNil(dieOrTarget)) roll.target = dieOrTarget
  else debugger

  // VALIDATIONS
  const targetRequired = [`regular`]
  const dieRequired = [`custom`, `damage`]

  if (targetRequired.includes(roll.type)) {
    if (isNil(roll.target)) debugger
  }

  if (dieRequired.includes(roll.type)) {
    if (isNil(roll.die)) debugger
  }

  return roll
}

export function parseRollContext(roll: IRoll, step: number, classes?: string[]): IRollContext {
  const content = [] as IRollContext[`content`]

  let value = `—`
  let label = undefined as any as string

  // VALUE/LABEL
  if ([`regular`].includes(roll.type)) {
    let target = roll.target!

    value = typeof target === `number` ? target.toString() : target.value.toString()
    label = typeof target === `number` ? undefined : levelToHTML(target, { acronym: true })

    if (roll.tags.includes(`self_control`)) label = `<span class="math-symbol">CR</span>`
  }

  if ([`custom`, `damage`].includes(roll.type)) {
    value = roll.die!
    if (!isNil(roll.source)) {
      label = isPrimitive(roll.source) ? roll.source.toString() : JSON.stringify(roll.source)

      if (roll.type === `damage`) label = `<span class="math-symbol" data-name="${roll.source.type}">${roll.source.type}</span>`
    }
  }

  // CONTENT
  if (roll.tags.includes(`self_control`)) {
    content.push({
      primary: `Self-Control Roll`,
      secondary: `Hit ${value} or less`,
    })
  }

  return {
    step,
    classes: classes ?? [],
    value,
    label,
    content,
  }
}

export function parseRollContextWithContent(content: IRollContextContent[], roll: IRoll, step: number, classes?: string[]): IRollContext {
  const context = parseRollContext(roll, step, classes)

  context.content = content

  return context
}
