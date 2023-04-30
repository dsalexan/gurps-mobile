import { Displayable } from "../../gurps-mobile/foundry/actor-sheet/context/feature/interfaces"
import { ILevel } from "./level"

export interface IRoll {
  tags: string[]
  definition: ILevel
}

export interface IRollContext extends Displayable {
  step: number
  content: { primary?: string; secondary?: string; tertiary?: string }[]
}

export function buildRoll(definition: ILevel, tags?: string[]): IRoll {
  return {
    tags: tags ?? [],
    definition,
  }
}

export function rollToRollContext(roll: IRoll, step: number, classes?: string[]): IRollContext {
  const content = [] as IRollContext[`content`]

  if (roll.tags.includes(`self_control`)) {
    content.push({
      primary: `Self-Control Roll`,
      secondary: `Hit ${roll.definition.level} or less`,
    })
  }

  return {
    step,
    classes: classes ?? [],
    value: roll.definition.level,
    label: roll.definition.relative?.toString(),
    content,
  }
}

export function levelToRollContext(content: { primary?: string; secondary?: string; tertiary?: string }[], level: ILevel, step: number, classes?: string[]): IRollContext {
  return {
    step,
    classes: classes ?? [],
    value: level.level,
    label: level.relative?.toString(),
    content,
  }
}
