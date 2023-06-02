import { intersection, isNil, uniq } from "lodash"
import { IDerivationPipeline, derivation, proxy } from "."
import { calculateLevel, createLevelDefinition, createVariable } from "../../../../../gurps-extension/utils/level"
import { MigrationDataObject, OVERWRITE, PUSH, WRITE } from "../../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "./generic"
import { IUsableFeatureData } from "./usable"
import { parseExpression } from "../../../../../december/utils/math"
import { IRoll, createRoll } from "../../../../../gurps-extension/utils/roll"
import { IModifier, IModifierCost, parseModifier } from "../../../../../gurps-extension/utils/modifier"
import { isNilOrEmpty } from "../../../../../december/utils/lodash"
import { parseSpecializedName, specializedName } from "../../../../core/feature/utils"

export interface IAdvantageFeatureData extends IGenericFeatureData, IUsableFeatureData {
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
  derivation.gcs(`modifiers`, `level`, function ({ modifiers: allModifiers }) {
    if (this.container) return {}
    if (isNil(allModifiers)) return {}
    if (this.type.compare(`disadvantage`, false)) return {}

    const modifiers = allModifiers.filter(modifier => !modifier.disabled)

    const newModifiers = [] as IModifier[]
    for (const raw of modifiers) {
      const modifiersFromRaw = parseModifier(raw)

      newModifiers.push(...modifiersFromRaw)
    }

    return { modifiers: OVERWRITE(`modifiers`, newModifiers) }
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

      if (max_level === 0) return {}
      return { maxLevel: max_level }
    }

    return {}
  }),
  // #endregion
  // #region DATA
  // derivation([`gcs`], [], function (_, __, { object }) {
  //   const gcs = object.sources.gcs
  //   if (gcs.type?.endsWith(`_container`)) return {}

  //   if (object.type.compare(`spell_as_power`)) {
  //     debugger
  //   }

  //   return {}
  // }),
  derivation([`gcs:cr`, `gca:mods`], [`rolls`], function (_, __, { object }) {
    const { gcs, gca } = object.sources
    const { cr } = gcs ?? {}
    const { mods } = gca ?? {}

    if (isNil(cr) || isNil(mods)) return {}

    if (mods!.some(mod => mod.match(/self-control/i))) {
      // ERROR: Unimplemented
      if (typeof cr !== `number`) debugger

      const roll = createRoll(cr, `regular`, undefined, [`self_control`])

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
    const metaList = data.get(`meta`)

    let newMeta = [] as string[]
    let links = [] as string[]

    for (const meta of metaList) {
      // colon without spaces around
      if (meta.match(/(?<! ):(?! )/)) {
        const [_meta, ..._values] = meta.split(`:`)

        // ERROR: Unimplemented
        if (_values.length !== 1) debugger

        newMeta.push(meta)
      } else {
        newMeta.push(meta)
      }
    }

    // LINKS
    MDO.links = PUSH(`links`, uniq(links))

    // META
    newMeta = uniq(newMeta)

    const basedOn = newMeta.filter(meta => meta.startsWith(`based_on:`))
    const nonBasedOn = newMeta.filter(meta => !meta.startsWith(`based_on:`))

    const placeholder = nonBasedOn.filter(meta => meta.startsWith(`placeholder:`))
    const nonPlaceholder = nonBasedOn.filter(meta => !meta.startsWith(`placeholder:`))

    MDO.meta = OVERWRITE(`meta`, nonPlaceholder)

    // DEDICATED META
    if (basedOn.length > 0)
      MDO.basedOn = OVERWRITE(
        `basedOn`,
        basedOn.map(link => {
          const [, fullName, type] = link.split(`:`)

          const obj = parseSpecializedName(fullName) as { name: string; specialization?: string; fullName: string; type?: string }
          obj.fullName = specializedName(obj.name, obj.specialization)
          obj.type = type

          return obj as { name: string; specialization?: string; fullName: string; type?: string }
        }),
      )
    if (placeholder.length > 0) MDO.placeholder = WRITE(`placeholder`, true)
  }

  return MDO
}
