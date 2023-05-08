import { flatten, get, isEmpty, isNil, sum, uniq } from "lodash"
import { GenericSource, IDerivationPipeline, derivation, proxy } from "."
import { isNilOrEmpty } from "../../../../../december/utils/lodash"
import { ILevel, buildLevel, parseLevelDefinition } from "../../../../../gurps-extension/utils/level"
import { FALLBACK, MigrationDataObject, MigrationValue, OVERWRITE, PUSH, WRITE } from "../../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "./generic"
import { IWeaponizableFeatureData } from "./weaponizable"
import DefenseFeature from "../defense"
import { IAttributeBonusComponent } from "../../../../../gurps-extension/utils/component"
import GenericFeature from "../generic"
import AdvantageFeature from "../advantage"
import SkillFeature from "../skill"
import WeaponFeature from "../weapon"
import type { GCA } from "../../../../core/gca/types"
import LOGGER from "../../../../logger"
import mathInstance, { preprocess, setupExpression, toHTML } from "../../../../../december/utils/math"

export interface IDefenseLevel {
  source: string // Feature.id[]
  level: ILevel
}

export type DefenseManualSource = GenericSource

export interface IDefenseFeatureData extends IGenericFeatureData, IWeaponizableFeatureData {
  sources: string[] // Feature.id[]
  actorModifier: number
  //
  levels: IDefenseLevel
}

export const DefenseFeaturePipeline: IDerivationPipeline<IDefenseFeatureData> = [
  // #region MANUAL
  // #endregion
  // #region GCS
  // #endregion
  // #region GCA
  // #endregion
  // #region DATA
  derivation([`actor.components.attribute_bonus:pool`], [`actorModifier`], function (_, __, { object }: { object: DefenseFeature }) {
    const actor = object.actor

    // if (object.id === `6e9287a7-221b-45f0-9256-a253498c3085`) debugger

    if (isNil(actor)) return {}

    const activeDefense = object.defense
    const components = actor.getComponents(
      `attribute_bonus`,
      (component: IAttributeBonusComponent) => component.attribute.includes(activeDefense),
      null,
    ) as IAttributeBonusComponent[]

    // TODO: Centralize component sum
    const modifier = sum(
      components.map(component => {
        const componentFeature = actor.cache.features?.[component.feature]
        if (!componentFeature) debugger

        let modifier = 1
        if (component.per_level) modifier = componentFeature!.data.level

        return component.amount * modifier
      }),
    )

    // ERROR: Unimplemented
    if (isNaN(modifier)) debugger

    return { actorModifier: OVERWRITE(`actorModifier`, modifier) }
  }),
  derivation([`actor.links:pool`], [`sources`], function (_, __, { object }: { object: DefenseFeature }) {
    const actor = object.actor

    // if (object.id === `6e9287a7-221b-45f0-9256-a253498c3085`) debugger

    if (isNil(actor)) return {}

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
  derivation([`sources`, `actorModifier`], [`levels`], function (_, __, { object }: { object: DefenseFeature }) {
    const actor = object.actor
    const { sources } = object.data

    if (isNil(sources) || isNil(actor)) return {}

    let levels = [] as IDefenseLevel[]
    const activeDefense = object.defense
    const actorModifier = object.data.actorModifier ?? 0
    const features = sources.map(uuid => actor.cache.features?.[uuid]) as GenericFeature[]

    // ERROR: Unimplemented
    if (features.some(f => isNil(f))) debugger

    // TODO: Adapt to new level shit
    debugger

    for (const feature of features) {
      const dl = { source: feature.id } as IDefenseLevel

      if (activeDefense === `dodge`) {
        // TODO: Power Dodge
        // TODO: Encumbrance is dodge's source bonus

        const defenseFormula = get(feature.data.formulas, `activeDefense.${activeDefense}`) ?? `@int(ST:Basic Speed) + 3`
        const sourceDefenseModifier = 0

        const targets = {
          A: {
            type: `attribute`,
            _raw: `ST:Basic Speed`,
            fullName: `Basic Speed`,
            name: `Basic Speed`,
            value: `Basic Speed`,
          },
          SOURCE_MODIFIER: {
            type: `flat`,
            _raw: `∂SOURCE_MODIFIER`,
            fullName: `Source Modifier`,
            name: `Source Modifier`,
            value: sourceDefenseModifier,
          },
          ACTOR_MODIFIER: {
            type: `flat`,
            _raw: `∂ACTOR_MODIFIER`,
            fullName: `Actor Modifier`,
            name: `Actor Modifier`,
            value: -1 * actorModifier,
          },
        } as Record<string, GCA.ExpressionTarget>

        const expression = {
          math: true,
          _raw: `@int(ST:Basic Speed) + 3 + ∂SOURCE_MODIFIER + ∂ACTOR_MODIFIER`,
          expression: `@int(∂A) + 3 + ∂SOURCE_MODIFIER + ∂ACTOR_MODIFIER`,
          variables: Object.fromEntries(Object.entries(targets).map(([key, target]) => [key, target._raw])),
          targets,
        } as GCA.Expression

        const levelDefinition = parseLevelDefinition(expression)
        const ilevel = levelDefinition.parse(feature, actor)

        LOGGER.info(ilevel?.level)
        LOGGER.info(ilevel?.relative.toString({ showZero: false }))

        const math = mathInstance()

        const node = ilevel?.relative.node
        const scope = ilevel?.relative.scope

        const simplifySymbols = [`SOURCE_MODIFIER`, `ACTOR_MODIFIER`]
        const simplifiedNode = math.simplify(node!, Object.fromEntries(simplifySymbols.map(symbol => [symbol, scope[symbol]])))

        LOGGER.info(simplifiedNode.toString(), simplifiedNode, node, scope)

        const html = toHTML(simplifiedNode, {
          parenthesis: `auto`,
          implicit: `hide`,
        })

        LOGGER.info(html)

        debugger
      } else {
        const baseDefenseLevel = 10
        dl.level = buildLevel(baseDefenseLevel, actorModifier, { flat: `<flat>` })
      }

      levels.push(dl)
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
