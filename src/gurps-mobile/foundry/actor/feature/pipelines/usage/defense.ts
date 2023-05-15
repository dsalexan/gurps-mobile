import { String, flatten, indexOf, isEmpty, isNil, last, uniq } from "lodash"
import { GenericSource, IDerivationPipeline, derivation, proxy } from ".."
import { isNilOrEmpty } from "../../../../../../december/utils/lodash"
import { ILevelDefinition, parseLevelDefinition, setupCheck } from "../../../../../../gurps-extension/utils/level"
import { FALLBACK, MigrationDataObject, MigrationValue, OVERWRITE, PUSH, WRITE } from "../../../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "../generic"
import { IFeatureData } from "../.."
import { IBase } from "../../../../../../gurps-extension/utils/base"
import FeatureUsage from "../../usage"
import { IFeatureUsageData, IHit, IHitRollToHit, IHitTargetMelee, IHitTargetRanged, IUsageEffect, IUsageEffectDamage, IUse } from "./usage"
import GenericFeature from "../../generic"
import LOGGER from "../../../../../logger"
import { IAttributeBonusComponent } from "../../../../../../gurps-extension/utils/component"
import { FeatureState } from "../../../../../core/feature/utils"
import { GCATypes } from "../../../../core/gca/types"

export const FeatureDefenseUsagePipeline: IDerivationPipeline<IFeatureUsageData, { mode: `parry` | `block` | `dodge` }> = [
  // #region MANUAL
  // #endregion
  // #region GCS
  derivation([`gcs`], [`label`, `use`, `hit`], ({ gcs, manual }, __, { object }) => {
    const activeDefense = manual.mode as `parry` | `block` | `dodge`

    const value = gcs[activeDefense] as string
    const defaults = gcs.defaults!

    if (value === `No` || value === `-` || isNil(value)) {
      debugger
      return {}
    }

    const use = { rule: `automatic` } as IUse
    const hit = { rule: `roll_to_hit`, target: null } as IHit

    // get modifier from GCS weapon
    const weaponModifier = parseInt(isEmpty(value) ? `0` : value)
    if (isNaN(weaponModifier)) debugger

    // #region get formulas from GCS weapon.defaults

    // for each definition of roll for weapon, get a list of formulas
    const formulas = [] as { formula: string; modifier: number }[]
    const definitions = defaults.map(_default => parseLevelDefinition(_default)) ?? []
    for (const definition of definitions) {
      // #region get skill (GCA entry) from definition
      const { variablesByType } = setupCheck(definition)
      const skillVariables = variablesByType.skill
      if (!skillVariables?.length) continue

      const listOfIndexes = skillVariables.map(variable => variable.value as number[])

      // ERROR: Untested
      if (listOfIndexes.length > 1) debugger

      // list of variants of a skill acceptable to that variable in definition
      const pool = listOfIndexes[0].map(index => GCA.entries[index])

      // ERROR: Untested
      if (pool.length > 1) debugger
      // #endregion

      const skill = pool[0] as GCATypes.Entry

      // #region get formula and modifier from GCA properties
      let formula = skill[`${activeDefense}at`] as string // formula
      let modifier = (skill[activeDefense] as string) ?? `No` // modifier

      // mode reduction
      if (formula?.options || modifier?.options) {
        const modeIndex = indexOf(
          skill.mode.options.map(o => o.toLowerCase()),
          gcs.usage?.toLowerCase(),
        )

        // ERROR: Untested for non-matching modes <-> usages
        if (modeIndex === -1) debugger

        if (formula?.options) formula = formula?.options?.[modeIndex] ?? formula
        if (modifier?.options) modifier = modifier?.options?.[modeIndex] ?? modifier
      }

      // #endregion

      let baseDefenseFormula = undefined as any as string
      const baseDefenseModifier = parseInt(modifier)

      // ERROR: Untested
      if (baseDefenseModifier !== weaponModifier) debugger
      if (isNaN(baseDefenseModifier)) debugger

      // #region default formulas where they dont exist

      // [entry has property <defense>at (internaly known as "formula")]
      if (formula !== `No` && formula !== `-` && !isNil(formula)) baseDefenseFormula = formula
      else {
        // [entry is one of the pre-defined defense-capable skills (block/cloak, melee weapon)]
        const block = [/shield/i, /cloak/i]
        if (block.some(pattern => pattern.test(skill.name))) baseDefenseFormula = `@int(∂S / 2) + 3`

        const parry = [/karate/i, /boxing/i, /brawling/i, /judo/i, /wrestling/i, /sumo wrestling/i]
        if (parry.some(pattern => pattern.test(skill.name))) baseDefenseFormula = `@int(∂S / 2) + 3`

        const entryTags = (skill.tags as string[]) ?? []
        if (entryTags.some(tag => tag.match(/melee combat/i)) && entryTags.some(tag => tag.match(/weapon/i))) baseDefenseFormula = `@int(∂S / 2) + 3`
      }
      // #endregion

      // EROROR: Unimplemented
      if (isNil(baseDefenseFormula)) debugger

      const handle = `skill`[0].toUpperCase()

      // replace level references for vS/vA in formula (to allow for me:: references only in feature context)
      if (baseDefenseFormula) baseDefenseFormula = baseDefenseFormula.replaceAll(/%level/g, `∂${handle}`).replaceAll(/me::level/g, `∂${handle}`)

      // ERROR: Unimplemented "me::" formula for skill
      if (baseDefenseFormula.match(/me::/i)) debugger

      debugger
    }

    // #endregion

    // ERROR: Should have rolls
    if (!hit.rolls) debugger
    if (!hit.rolls.length) debugger

    debugger
    return { use, hit, tags: PUSH(`tags`, [activeDefense]) }
  }) as any,
  // #endregion
  // #region GCA

  // #endregion
  // #region DATA
  derivation([`hit.rule`], [`hit.rolls`], (_, __, { object }) => {
    const activeDefense = last(object.id.split(`-`))! as `parry` | `block` | `dodge`
    const hit = object.data.hit as IHit

    const value = object.sources.gcs[activeDefense] as string

    if (hit.rule !== `roll_to_hit`) {
      debugger
      return { "hit.rolls": [] }
    }

    if (value === `No` || value === `-` || isNil(value)) return {}

    const modifier = parseInt(isEmpty(value) ? `0` : value)
    if (isNaN(modifier)) debugger

    // TODO: Get defense rolls (ILevelDefinition[])
    // defense usage is how a feature (object.parent) is going to use a active defense
    //  object.parent is the source of defense
    //  the skill/attribute for base calculation is
    if (activeDefense === `block`) {
      debugger
    } else if (activeDefense === `dodge`) {
      debugger
    } else if (activeDefense === `parry`) {
      debugger
    } else {
      debugger
    }

    debugger
    return {}
  }),
  // #endregion
]

FeatureDefenseUsagePipeline.name = `FeatureDefenseUsagePipeline`
// FeatureDefenseUsagePipeline.conflict = {
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

FeatureDefenseUsagePipeline.post = function postMeleeUsage(data) {
  const MDO = {} as MigrationDataObject<any>

  return MDO
}
