/* eslint-disable no-debugger */
import { flatten, get, isEmpty, isEqual, isNil, orderBy, sum, uniq } from "lodash"
import { GenericSource, IDerivationPipeline, derivation, proxy } from "."
import { isNilOrEmpty } from "../../../../../december/utils/lodash"
import {
  ILevel,
  ILevelDefinition,
  IVariable,
  calculateLevel,
  createLevelDefinition,
  createVariable,
  levelToHTML,
  levelToString,
  setupCheck,
} from "../../../../../gurps-extension/utils/level"
import { FALLBACK, MigrationDataObject, MigrationValue, OVERWRITE, PUSH, WRITE } from "../../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "./generic"
import { IUsableFeatureData } from "./usable"
import DefenseFeature from "../defense"
import { IAttributeBonusComponent } from "../../../../../gurps-extension/utils/component"
import GenericFeature from "../generic"
import AdvantageFeature from "../advantage"
import SkillFeature from "../skill"
import WeaponFeature from "../usage"
import type { GCA } from "../../../../core/gca/types"
import LOGGER from "../../../../logger"
import mathInstance, { preprocess, setupExpression, toHTML } from "../../../../../december/utils/math"
import { FeatureState } from "../../../../core/feature/utils"

/**
 * (source) Feature which allows the defense
 * (base)   Skill or attribute which level works as a base for active defense level calculation
 */
export interface IDefenseLevel {
  source: string // Feature.id[]
  base: {
    type: `skill` | `attribute`
    id: string
    modifier: number // sourceDefenseModifier (like +1 to parry with judo)
  }
  level: ILevel
}

export type DefenseManualSource = GenericSource

export interface IDefenseFeatureData extends IGenericFeatureData, IUsableFeatureData {
  sources: string[] // Feature.id[]
  actorComponents: { value: number; component: string }[]
  actorModifier: number
  //
  levels: IDefenseLevel[]
}

export const DefenseFeaturePipeline: IDerivationPipeline<IDefenseFeatureData> = [
  // #region MANUAL
  // #endregion
  // #region GCS
  // #endregion
  // #region GCA
  // #endregion
  // #region DATA
  derivation([`actor.components.attribute_bonus:pool`], [`actorModifier`, `actorComponents`], function (_, __, { object }: { object: DefenseFeature }) {
    const actor = object.actor

    // if (object.id === `6e9287a7-221b-45f0-9256-a253498c3085`) debugger

    if (isNil(actor)) return {}

    const activeDefense = object.defense
    const components = actor.getComponents(
      `attribute_bonus`,
      (component: IAttributeBonusComponent) => component.attribute.includes(activeDefense),
      null,
    ) as IAttributeBonusComponent[]

    const componentSummary = [] as { value: number; component: string }[]
    for (const component of components) {
      const componentFeature = actor.cache.features?.[component.feature]
      if (!componentFeature) debugger

      let modifier = 1
      if (component.per_level) modifier = componentFeature!.data.level

      // ignore for state
      const isFeatureActive = [FeatureState.PASSIVE, FeatureState.ACTIVE].some(state => componentFeature!.data.state & state)
      if (!isFeatureActive) modifier = 0

      componentSummary.push({
        value: component.amount * modifier,
        component: component.id,
      })
    }

    // TODO: Centralize component sum
    const modifier = sum(componentSummary.map(component => component.value))

    // ERROR: Unimplemented
    if (isNaN(modifier)) debugger

    return {
      actorModifier: OVERWRITE(`actorModifier`, modifier),
      actorComponents: OVERWRITE(`actorComponents`, componentSummary),
    }
  }),
  derivation([`actor.links:pool`], [`sources`], function (_, __, { object }: { object: DefenseFeature }) {
    const actor = object.actor

    // if (object.id === `6e9287a7-221b-45f0-9256-a253498c3085`) debugger

    if (isNil(actor)) return {}
    return {}

    const activeDefense = object.defense
    const links = actor.cache.links?.activeDefense?.[activeDefense] ?? []
    const features = links.map(uuid => actor.cache.features?.[uuid]).filter(f => !isNil(f)) as GenericFeature[]

    // DEFENSE-CAPABLE SKILLS are:
    //    skills with a defense formula property (<defense>at, usually only if GCA)
    //    skills matching those in a pre-determined hardcoded list (only needed for a GCS-only feature)
    //
    //    skill.defenses?.includes(<defense>)

    // SOURCES of defenses are:
    //    features with a defense property (or with at least a weapon with a defense property)
    //    features with a defense formula property (<defense>at, usually only if GCA)
    //    features linked with a defense-capable skill
    //    features with specific VTT_NOTES tag
    //
    //    feature.links.includes(activeDefense.<defense>)

    const sources = features.map(feature => feature.id)

    if (sources.length === 0) return {}
    return { sources: OVERWRITE(`sources`, sources) }
  }),
  derivation([`sources`, `actorModifier`, `actor.skills`], [`levels`], function (_, __, { object }: { object: DefenseFeature }) {
    const actor = object.actor
    const { sources } = object.data

    if (isNil(sources) || isNil(actor)) return {}

    let levels = [] as IDefenseLevel[]
    const activeDefense = object.defense
    const actorModifier = object.data.actorModifier ?? 0
    const features = sources.map(uuid => actor.cache.features?.[uuid]) as GenericFeature[]

    // ERROR: Unimplemented
    if (features.some(f => isNil(f))) debugger

    for (const feature of features) {
      const dls = [] as IDefenseLevel[]

      // TODO: Retreat
      // TODO: Dodge and Drop

      // TODO: Power Dodge
      // TODO: Encumbrance is dodge's source bonus
      // TODO: Acrobatic Dodge
      // TODO: Sacrificial Dodge
      // TODO: Vehicular Dodge

      // TODO: POWER BLOCK
      // TODO: POWER PARRY

      let sourceDefenseModifiers = [] as { value: number; bases: { type: `skill` | `attribute`; id: string }[] }[]
      if (feature.type.compare(`equipment`) || feature.type.compare(`advantage`)) {
        // vaguelly based on Generic derivation of "skills" property
        const usages = feature.data.usages ?? []
        for (const usage of usages) {
          if (!usage.data[activeDefense]) continue

          const definitions = usage.data.rolls ?? []

          const relatedBases = [] as { type: `skill` | `attribute`; id: string }[]
          for (const definition of definitions) {
            const { variablesByType } = setupCheck(definition)

            const skillVariables = variablesByType[`skill`] ?? []
            if (skillVariables.length === 0) continue

            const indexes = skillVariables.map(target => target.value).flat() as number[]
            const entries = indexes.map(index => GCA.entries[index])

            const features = indexes.map(entry => actor.cache.gca?.skill[entry])

            const ids = features.filter(feature => !isNil(feature)).map(feature => feature.id)
            relatedBases.push(...ids.map(id => ({ type: `skill` as const, id })))
          }

          debugger

          sourceDefenseModifiers.push({
            bases: relatedBases,
            value: parseFloat(usage.data[activeDefense]),
          })
        }

        debugger
      } else {
        // ERROR: Unimplemented for non-equipment/non-advantage features
        debugger
      }

      const sourceDefenseFormulas = uniq(get(feature.data.formulas, `activeDefense.${activeDefense}`))

      let skill: SkillFeature
      let attribute: { value: number }

      // TODO: skills whot
      debugger
      let bases: IDefenseLevel[`base`][] = feature.data.skills?.map(skill => ({ type: `skill`, id: skill })) ?? []
      // inject "default dx" as dodge "skill" for basic speed
      if (activeDefense === `dodge` || activeDefense === `parry`) {
        bases.push({
          type: `attribute`,
          id: `Basic Speed`,
          modifier: 0,
        })
      }

      // ERROR: Unimplemented uter lack of bases for defense (maybe then the defense is unusable?)
      if (!bases || bases.length === 0) debugger

      // for each associated skill
      for (const base of bases) {
        debugger
        let variables = {
          SOURCE_MODIFIER: createVariable(`SOURCE_MODIFIER`, `constant`, sourceDefenseModifier),
          ACTOR_MODIFIER: createVariable(`ACTOR_MODIFIER`, `constant`, -1 * actorModifier),
        } as Record<string, IVariable>

        let baseDefenseFormulas = undefined as string[] | undefined

        if (base.type === `skill`) {
          skill = actor.cache?.features?.[base.id] as SkillFeature

          baseDefenseFormulas = uniq(get(skill.data.formulas, `activeDefense.${activeDefense}`))

          const index = skill.sources.gca._index

          // ERROR: Unimplemented skill without gca index
          if (isNil(index)) debugger

          const S = createVariable(`S`, `skill`, [index], {
            meta: {
              fullName: skill.specializedName,
              name: skill.data.name,
              nameext: skill.data.specialization,
            },
          })

          variables[`S`] = S
        } else if (base.type === `attribute`) {
          attribute = actor.system.attributes[base.id.toUpperCase()] ?? actor.system[base.id.toLowerCase()]

          if (activeDefense === `dodge`) baseDefenseFormulas = [`@int(∂A) + 3`]
          else if (activeDefense === `parry`) baseDefenseFormulas = [`@int(∂A / 2) + 3`]
          else {
            // ERROR: Unimplemented for attriute-based active defenses for anything NOT dodge
            debugger
          }

          const A = createVariable(`A`, `attribute`, base.id, {
            meta: { name: base.id },
          })

          variables[`A`] = A
        }

        const handle = base.type[0].toUpperCase()

        // replace level references for vS/vA in formula (to allow for me:: references only in feature context)
        if (baseDefenseFormulas) baseDefenseFormulas = baseDefenseFormulas.map(formula => formula.replaceAll(/%level/g, `∂${handle}`).replaceAll(/me::level/g, `∂${handle}`))

        // ERROR: Unimplemented "me::" formula for skill
        if (baseDefenseFormulas?.some(formula => formula.match(/me::/i))) debugger

        // ERROR: Untested two possible formulas
        if (sourceDefenseFormulas?.length && baseDefenseFormulas?.length && !isEqual(sourceDefenseFormulas, baseDefenseFormulas)) debugger

        let defenseFormulas = sourceDefenseFormulas.length ? sourceDefenseFormulas : baseDefenseFormulas

        // ERROR: Unimplemented multiple/no formulas
        if (!defenseFormulas?.length) debugger
        if (defenseFormulas?.length !== 1) debugger

        let defenseFormula = defenseFormulas![0]

        // ERROR: Formula doenst seem to have base variable (S or A usually)
        if (!defenseFormula.match(new RegExp(`∂${handle}`, `i`))) debugger

        let level: ILevel
        try {
          const definition = createLevelDefinition(`${defenseFormula} + ∂SOURCE_MODIFIER + ∂ACTOR_MODIFIER`, variables)
          level = calculateLevel(definition, feature, actor)!
        } catch (error) {
          console.error(`gurps-mobile`, `defense pipeline calc level`)
          console.error(error)
          debugger
        }

        if (!level) debugger

        dls.push({
          source: feature.id,
          base: {
            type: base.type,
            id: base.id,
            modifier: sourceDefenseModifier,
          },
          level,
        })
      }

      levels.push(...orderBy(dls, [`level.value`], [`desc`]))
    }

    return { levels: OVERWRITE(`levels`, levels) }
  }),
  // #endregion
]

DefenseFeaturePipeline.name = `DefenseFeaturePipeline`
// DefenseFeaturePipeline.conflict = {
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

DefenseFeaturePipeline.post = function postWeapon(data) {
  const MDO = {} as MigrationDataObject<any>

  if (!isNilOrEmpty(this.parent?.data.name)) MDO.name = FALLBACK(`name`, this.parent?.data.name)

  return MDO
}
