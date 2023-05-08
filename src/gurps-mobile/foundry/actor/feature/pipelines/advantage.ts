import { isNil } from "lodash"
import { IDerivationPipeline, derivation, proxy } from "."
import { calculateLevel, createLevelDefinition, createVariable } from "../../../../../gurps-extension/utils/level"
import { MigrationDataObject, OVERWRITE, PUSH } from "../../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "./generic"
import { IWeaponizableFeatureData } from "./weaponizable"
import { parseExpression } from "../../../../../december/utils/math"
import { IRoll, createRoll } from "../../../../../gurps-extension/utils/roll"

export interface IAdvantageFeatureData extends IGenericFeatureData, IWeaponizableFeatureData {
  rolls?: IRoll[]
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
  derivation([`gcs:cr`, `gca:mods`], [`rolls`], function (_, __, { object }) {
    const { gcs, gca } = object.sources
    const { cr } = gcs ?? {}
    const { mods } = gca ?? {}

    if (isNil(cr) || isNil(mods)) return {}

    if (mods!.some(mod => mod.match(/self-control/i))) {
      const definition = createLevelDefinition(`∂CR`, createVariable(`CR`, `me`, `sources.gcs.cr`))
      const level = calculateLevel(definition, object, object.actor)
      const roll = createRoll(level!, [`self_control`])

      return { rolls: PUSH(`rolls`, roll) }
    }

    return {}
  }),
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

  return MDO
}

function linkFromVTTNotes(_meta: string) {
  const pattern = / ?\w+:([\w:]+)\w+\b ?/gi
  const links = _meta.match(pattern)
  const meta = _meta.replace(pattern, ``)

  return [meta, links ? links.map(match => match.replace(/ */gi, ``).replace(/:/gi, `.`)) : []] as [string, string[]]
}
