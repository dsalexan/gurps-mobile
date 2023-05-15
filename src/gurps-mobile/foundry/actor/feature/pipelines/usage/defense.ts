import { String, flatten, indexOf, isArray, isEmpty, isNil, last, uniq } from "lodash"
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
    const feature = object.parent as any as GenericFeature
    const activeDefense = manual.mode as `parry` | `block` | `dodge`

    const value = gcs[activeDefense] as string
    const defaults = gcs.defaults!

    if (value === `No` || value === `-` || isNil(value)) {
      debugger
      return {}
    }

    const use = { rule: `automatic` } as IUse
    const hit = { rule: `roll_to_hit`, target: null } as IHit

    /**
     * A Defense Level Definition can be broken in specific parts:
     * - Base Formula
     *    - Generaly found in many places, describes the mathematical expression to calculate final level
     * - Modifier
     *    - A numeric bonus applied to formula before calculation
     *    - Sometimes more complex bonuses (another math expressions such as Talent/2 or a advantage level) can be found
     * - Base
     *    - Base feature which's level is applied in base formula (usually a attribute or skill)
     *    - Can be found directly in feature (parent) or implied by defaults of GCS.weapons
     */

    /**
     * Defense to hit definitions can be found in many places:
     * - Feature (parent) can have both formula and modifier
     *   - Basic Speed, for example, has formula for dodge (that formula is responsible for requesting the usage creation in derivationLinksToDefenseUsages)
     * - GCS weapon can have modifier
     * - Skills attached to GCS weapon (weapon.defaults) can have both formula and modifier
     *   - Those formulas can be found in equivalent GCA entry OR be derived by default based on pre-defined list of defense-capable skills
     *   - It will always be skills online. If there is no skill (when a attribute is the defense base, for example), any necessary descriptions will be found in feature formula
     */

    // most important data, those informations take precedence over the rest
    // feature can imply base, if not specified it will be derived from GCS.weapons
    let featureFormula: string | null = null
    let featureBase: { type: `skill` | `attribute`; value: number[] | string } | null

    // only ADVANTAGE or EQUIPMENT feature can have a formula
    if (![`advantage`, `equipment`].some(type => object.type.compare(type))) {
      featureFormula = (feature?.data.formulas?.activeDefense?.[activeDefense] ?? null) as string | null
      if (isArray(featureFormula)) debugger
    }

    // setup default formula/base
    if (featureFormula === `__default__formula__`) {
      if (activeDefense === `block`) {
        featureFormula = `@int(∂A) + 3`
        featureBase = { type: `attribute`, value: `basic speed` }
      } else if (activeDefense === `dodge`) {
        debugger
      } else if (activeDefense === `parry`) {
        debugger
      } else {
        debugger
      }
    }

    // a weapon modifier takes precedence over base specific modifiers
    // skills from weapons.defaults are implied as bases for defense
    const weaponModifier = parseInt(isEmpty(value) ? `0` : value)
    if (isNaN(weaponModifier)) debugger

    // default formulas and mofifiers for defense as described for a specific usage ("mode") in GCA.Entry
    const skillDefenseFormulasAndModifiers = [] as { formula: string | null; modifier: number | null; base: { type: `skill` | `attribute`; value: number[] | string }[] | null }[]

    // #region get formulas from GCS weapon.defaults

    // for each definition of roll for weapon, get a list of formulas and modifiers
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

      // cannot defend
      if (modifier === `No` || modifier === `-`) continue

      let baseDefenseFormula = null as string | null
      const baseDefenseModifier = !isNil(modifier) ? parseInt(modifier) : null

      // ERROR: Untested
      if (!isNil(baseDefenseModifier) && isNaN(baseDefenseModifier)) debugger

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

      // ERROR: Untested, shouldnt be
      if (isNil(baseDefenseModifier) && isNil(baseDefenseFormula)) debugger

      const base = {
        formula: baseDefenseFormula,
        modifier: baseDefenseModifier,
        base: [{ type: `skill` as const, value: [skill.index] }],
      }

      debugger

      skillDefenseFormulasAndModifiers.push(base)
    }

    // #endregion

    debugger

    /**
     * Defense Level Definition -> Level Definition -> Level
     * {formula(base)} + {modifier}
     */

    const handle = `skill`[0].toUpperCase()

    // replace level references for vS/vA in formula (to allow for me:: references only in feature context)
    if (baseDefenseFormula) baseDefenseFormula = baseDefenseFormula.replaceAll(/%level/g, `∂${handle}`).replaceAll(/me::level/g, `∂${handle}`)

    // ERROR: Unimplemented "me::" formula for skill
    if (baseDefenseFormula.match(/me::/i)) debugger

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
