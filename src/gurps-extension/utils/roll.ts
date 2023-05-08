import { cloneDeep, isNil } from "lodash"
import { Displayable } from "../../gurps-mobile/foundry/actor-sheet/context/feature/interfaces"
import { ILevel, levelToHTML } from "./level"

export interface IRoll extends ILevel {
  tags: string[]
}

export interface IRollContext extends Displayable {
  step: number
  content: { primary?: string; secondary?: string; tertiary?: string }[]
}

export function createRoll(level: ILevel, tags?: string[]): IRoll {
  // ERROR: Unimplemented
  if (isNil(level)) debugger

  // TODO: Find out if it should cloneDeep
  return {
    tags: tags ?? [],
    ...cloneDeep(level),
  }
}

export function parseRollContext(roll: IRoll | ILevel, step: number, classes?: string[]): IRollContext {
  const content = [] as IRollContext[`content`]

  const tags = roll?.tags ?? []
  if (tags?.includes(`self_control`)) {
    content.push({
      primary: `Self-Control Roll`,
      secondary: `Hit ${roll.value} or less`,
    })
  }

  return {
    step,
    classes: classes ?? [],
    value: roll.value,
    label: levelToHTML(roll), //  roll.definition.relative?.toString(),
    content,
  }
}

export function parseRollContextWithContent(
  content: { primary?: string; secondary?: string; tertiary?: string }[],
  roll: IRoll | ILevel,
  step: number,
  classes?: string[],
): IRollContext {
  const context = parseRollContext(roll, step, classes)

  context.content = content

  return context
}
