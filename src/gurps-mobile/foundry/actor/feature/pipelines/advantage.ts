import { isNil } from "lodash"
import { IDerivationPipeline, derivation, proxy } from "."
import { ILevelDefinition, parseLevelDefinition } from "../../../../../gurps-extension/utils/level"
import { MigrationDataObject, OVERWRITE, PUSH } from "../../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "./generic"
import { IWeaponizableFeatureData } from "./weaponizable"
import { parseExpression } from "../../../../../december/utils/math"

export interface IAdvantageFeatureData extends IGenericFeatureData, IWeaponizableFeatureData {
  rolls?: ILevelDefinition[]
  cost: string
  // points?: number
  level?: number
  basePoints?: number
  canLevel?: boolean
  pointsPerLevel?: boolean
  maxLevel: number
}

export const AdvantageFeaturePipeline: IDerivationPipeline<IAdvantageFeatureData> = [
  // #region GCS
  derivation.gcs(`can_level`, `canLevel`, ({ can_level }) => ({ canLevel: can_level })),
  derivation.gcs(`points_per_level`, `pointsPerLevel`, ({ points_per_level }) => ({ pointsPerLevel: points_per_level })),
  // derivation.gcs(`calc`, [`points`], ({ calc }) => {
  //   if (!isNil(calc?.points)) {
  //     const points = parseInt(calc.points)

  //     // ERROR: Cannot b
  //     if (isNaN(points)) debugger

  //     return { points }
  //   }
  //   return {}
  // }),
  derivation.gcs(`base_points`, `basePoints`, ({ base_points }) => {
    if (isNil(base_points)) return {}

    const basePoints = parseInt(base_points)
    if (isNaN(basePoints)) debugger

    return { basePoints }
  }),
  derivation.gcs(`levels`, `level`, ({ levels }) => {
    if (isNil(levels)) return {}

    const level = parseInt(levels)
    if (isNaN(level)) debugger

    return { level }
  }),
  // #endregion
  // #region GCA
  proxy.gca(`cost`),
  derivation.gca(`upto`, [`maxLevel`], ({ upto: _upto }, _, { object }) => {
    const upto = _upto as string
    if (!isNil(upto)) {
      // TODO: Parse "LimitingTotal" in upto
      if (upto.match(/LimitingTotal/i)) return {}

      const max_level = parseExpression(upto, object)

      if (isNaN(max_level)) debugger

      return { maxLevel: max_level }
    }

    return {}
  }),
  // #endregion
  // #region DATA
  // derivation([`canLevel`, `points`, `pointsPerLevel`, `maxLevel`], [`level`], function (_, __, { object }) {
  //   const actor = object.actor
  //   const { canLevel, points, pointsPerLevel, maxLevel } = object.data

  //   if (!canLevel) return {}

  //   const level = points * pointsPerLevel
  //   const cappedLevel = !isNil(maxLevel) ? Math.min(level, maxLevel) : level

  //   // ERROR: Cannot b
  //   if (isNaN(cappedLevel)) debugger

  //   return { level: OVERWRITE(`level`, cappedLevel) }
  // }),
  // #endregion
]

AdvantageFeaturePipeline.name = `AdvantageFeaturePipeline`
AdvantageFeaturePipeline.conflict = {}

AdvantageFeaturePipeline.post = function postAdvantage(data) {
  const MDO = {} as MigrationDataObject<any>

  if (data.has(`meta`)) {
    const meta = data.get(`meta`)
    if (meta.includes(`:`)) {
      const [meta1, links] = linkFromVTTNotes(meta)

      MDO.meta = OVERWRITE(`meta`, meta1)
      MDO.links = PUSH(`links`, links)
    }
  }

  if (data.has(`notes`)) {
    const notes = data.get(`notes`)
    if (notes.length > 0) {
      const _notes = [] as string[]
      const rolls = [] as ILevelDefinition[]

      for (const note of notes) {
        if (!note.includes(`CR`)) _notes.push(note)
        else {
          const [notes2, cr] = selfControlRolls(note)

          _notes.push(notes2)
          rolls.push(cr)
        }
      }

      MDO.notes = OVERWRITE(`notes`, _notes)
      MDO.rolls = PUSH(`rolls`, rolls)
    }
  }

  return MDO
}

function linkFromVTTNotes(_meta: string) {
  const pattern = / ?\w+:([\w:]+)\w+\b ?/gi
  const links = _meta.match(pattern)
  const meta = _meta.replace(pattern, ``)

  return [meta, links ? links.map(match => match.replace(/ */gi, ``).replace(/:/gi, `.`)) : []] as [string, string[]]
}

function selfControlRolls(_notes: string) {
  const pattern = /\[CR: (\d+) \(([\w ]+)\): (.+)\]/
  const cr = _notes.match(pattern)
  const notes = _notes.replace(pattern, ``)

  debugger

  const definition = parseLevelDefinition({
    type: `flat`,
    name: cr?.[2],
    specialization: `Self-Control Roll`,
    value: cr?.[1],
  })
  definition.tags = [`self_control`]

  debugger
  return [notes, definition] as const
}
