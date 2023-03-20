import { isNil } from "lodash"

interface Spacer {
  spacer: true
}

interface BaseStatus {
  label: string
  icon: string
  value?: string | number
  main?: boolean
  tray?: boolean
}

interface GroupedStatus {
  header: string
  children: BaseStatus[]
}

type Status = Spacer | GroupedStatus | BaseStatus

/**
 *
 */
function spacer(): Spacer {
  return { spacer: true }
}

/**
 *
 * @param maneuver
 */
export function getStatus(maneuver: string): Status[] {
  const Maneuver = { header: `Maneuver`, children: [] } as GroupedStatus
  const Others = { header: `Others`, children: [] } as GroupedStatus

  if (maneuver !== `undefined` && !isNil(maneuver))
    Maneuver.children.push({
      label: Handlebars.helpers[`gurpsLabel`](maneuver),
      icon: maneuver,
      main: true,
      tray: true,
    })
  Maneuver.children.push(
    {
      label: `Half Move`,
      icon: `move_half`,
      value: `20`,
      tray: true,
    },
    {
      label: `No Active Defense`,
      icon: `no_defense`,
      tray: true,
    },
    {
      label: `To Hit`,
      icon: `to_hit`,
      value: `+1`,
    },
    {
      label: `Damage`,
      icon: `damage`,
      value: `+2`,
    },
  )

  Others.children.push(
    {
      label: `Aim`,
      icon: `aim`,
      value: `+1`,
      tray: true,
    },
    {
      label: `Reeling`,
      icon: `reeling`,
      value: `<i>↓</i>20<i>HP</i>`,
      tray: true,
    },
    {
      label: `Tired`,
      icon: `tired`,
      value: `<i>↓</i>20<i>HP</i>`,
      tray: true,
    },
  )

  return [Maneuver, spacer(), Others]
}
