/* eslint-disable no-debugger */
import { isArray, isNil } from "lodash"
import { GenericSource, IDerivationPipeline, derivation, proxy } from "."
import { IFeatureData } from ".."
import { MigrationDataObject, OVERWRITE } from "../../../../core/feature/compilation/migration"
import ModifierFeature from "../modifier"
import { IGenericFeatureData } from "./generic"
import { IUsableFeatureData } from "./usable"
import FeatureUsage from "../usage"
import { isNilOrEmpty } from "../../../../../december/utils/lodash"

export interface IModifierCost {
  type: `multiplier` | `percentage` | `points`
  value: number
  affects: undefined | `base_only` | `levels_only`
}

export interface IModifierFeatureData extends IGenericFeatureData, IUsableFeatureData {
  level?: number
  cost: IModifierCost
  parents?: string[]
  // TODO: Decide if modifiers should have usages
}

export const ModifierFeaturePipeline: IDerivationPipeline<IModifierFeatureData, GenericSource> = [
  // #region MANUAL
  proxy.manual(`parents`),
  // #endregion
  // #region GCS
  derivation.gcs([`cost`, `cost_type`, `affects`], [`cost`], ({ cost, cost_type, affects }) => {
    const modifierCost = {} as IModifierCost

    modifierCost.value = parseInt(cost)
    modifierCost.type = cost_type ?? `percentage`
    modifierCost.affects = affects

    // ERROR: Unimplemented cost type
    if (![`multiplier`, `points`, `percentage`].includes(modifierCost.type)) debugger
    if (![undefined, `base_only`, `levels_only`].includes(modifierCost.affects)) debugger

    return { cost: OVERWRITE(`cost`, modifierCost) }
  }),
  derivation.gcs([`name`, `notes`], [`name`, `specialization`, `notes`], ({ name, notes }) => {
    const hasNotes = !isNilOrEmpty(notes)
    const hasParenthesis = name.match(/[\(\)]/i)

    const BLACKLIST_COMMA = [/once on/i, /first in/i]

    const isComma = name.match(/,/i) && !BLACKLIST_COMMA.some(pattern => name.match(pattern)) && !hasParenthesis
    const isColon = name.match(/:/i)

    if (isComma && isColon) {
      // ERROR: Untested
      if (hasNotes) debugger

      debugger
    } else if (isComma) {
      const byComma = name.replaceAll(/ *, */g, `,`).split(`,`)

      name = byComma[0]
      const specialization = byComma[1]

      // ERROR: Unimplemented conflict
      if (hasNotes && !isNilOrEmpty(byComma[2])) debugger

      if (!isNilOrEmpty(byComma[2])) notes = [byComma.slice(2).join(`,`)]

      return { name: OVERWRITE(`name`, name), specialization: OVERWRITE(`specialization`, specialization), notes: OVERWRITE(`notes`, notes) }
    } else if (isColon) {
      const byColon = name.replaceAll(/ *: */g, `:`).split(`:`)

      // ERROR: Untested
      if (byColon.length !== 2) debugger
      if (hasNotes) debugger
      if (hasParenthesis) debugger

      name = byColon[0]
      const specialization = byColon[1]

      return { name: OVERWRITE(`name`, name), specialization: OVERWRITE(`specialization`, specialization) }
    } else if (hasNotes) {
      const notes_ = notes as string

      // ERROR: Unimplemented for array notes
      if (isArray(notes_)) debugger

      // testing if notes should act as specialization (since GCS lacks specialization field for modifiers, but GCA has it)
      const hasNonWords = notes_.match(/[^\w -\\\/]/i)

      const hasTestedCharacters = notes_.match(/[,:\-\(\)\\\/]/i) // .match(/[,;:-\"\'\(\)]/i)
      const hasNumericalPercentages = notes_.match(/(\d+)%/i)
      const hasTestedWeirdShit = hasTestedCharacters || hasNumericalPercentages

      const isSpecialization = !hasNonWords
      const isUntested = hasNonWords && !hasTestedWeirdShit

      if (isSpecialization) return { specialization: OVERWRITE(`specialization`, notes_), notes: OVERWRITE(`notes`, undefined) }

      // if untested, stop here
      if (isUntested) debugger

      // if it was tested and it's not a specialization, just let it go
    }

    return {}
  }),
  // #endregion
  // #region GCA
  // #endregion
  // #region DATA
  // #endregion
]

ModifierFeaturePipeline.name = `ModifierFeaturePipeline`
// ModifierFeaturePipeline.conflict = {
//   attribute: function genericConflictResolution(migrations: MigrationValue<any>[]) {
//     const attributes = flatten(Object.values(migrations)).map(migration => (migration.value as string).toUpperCase())
//     const uniqueAttributes = uniq(attributes)
//     if (uniqueAttributes.length === 1) return { attribute: Object.values(migrations)[0] }
//     else {
//       // ERROR: Too many different attributes
//       // eslint-disable-next-line no-debugger
//       debugger
//     }
//   },
// }

ModifierFeaturePipeline.post = function postModifier(data) {
  const MDO = {} as MigrationDataObject<any>

  return MDO
}
