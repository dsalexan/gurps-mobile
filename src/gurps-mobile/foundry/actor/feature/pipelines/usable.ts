import { cloneDeep, groupBy, has, indexOf, isEmpty, isNil, orderBy, uniq } from "lodash"
import { FeatureSources, GenericSource, IDerivationPipeline, derivation, proxy } from "."
import Feature, { IFeatureData } from ".."
import { FALLBACK, MigrationDataObject, OVERWRITE, PUSH } from "../../../../core/feature/compilation/migration"
import { FEATURE } from "../../../../core/feature/type"
import { GCS } from "../../../../../gurps-extension/types/gcs"
import { IGenericFeatureData } from "./generic"
import FeatureUsageContextTemplate from "../../../actor-sheet/context/feature/variants/usage"
import LOGGER from "../../../../logger"
import { push } from "../../../../../december/utils/lodash"
import { IFeatureUsageData, IUsageTag } from "./usage/usage"
import FeatureUsage from "../usage"
import GenericFeature from "../generic"
import SkillFeature from "../skill"
import { allowedSkillVariables, parseLevelDefinition, setupCheck } from "../../../../../gurps-extension/utils/level"
import { FeatureMeleeUsagePipeline } from "./usage/melee"
import { FeatureRangedUsagePipeline } from "./usage/ranged"
import { FeatureDamageUsagePipeline } from "./usage/damage"
import { FeatureDefenseUsagePipeline } from "./usage/defense"
import { GCATypes } from "../../../../core/gca/types"

export interface IUsableFeatureData extends IFeatureData {
  recipes?: IUsageRecipe[]
  usages?: FeatureUsage[]
}

export interface IUsageRecipe {
  id: string
  index: number | number[]
  sources: Partial<FeatureSources<any>>
  path: string
  pipelines: IDerivationPipeline<IFeatureUsageData>[]
  mode?: string
  tags: IUsageTag[]
  source: string // identifies recipe's source
}

export const UsableFeaturePipeline: IDerivationPipeline<IUsableFeatureData & IGenericFeatureData> = [
  //
  derivation([`gcs:weapons`, `gca`], [`recipes`], function derivationWeaponToUsages(_, __, { object }) {
    const { weapons, recipes: existingRecipes } = object.sources.gcs ?? {}

    if (weapons && weapons.length > 0) {
      const factory = object.factory

      // since from a single weapon we can have multiple recipes
      // from N weapons we can have M recipes

      const defenses = [`block`, `dodge`, `parry`] as const
      const skills = {} as Record<number, number[]> // Record<weapon.index, GCS.entry.index[]>

      const recipes = [] as IUsageRecipe[]
      for (let index = 0; index < weapons.length ?? 0; index++) {
        const weapon = weapons[index] as any as GCS.Entry

        // ERROR: Pathless parent
        if (object && !object.path) debugger

        // from a single weapon, we can have multiple recipes

        // split a weapon into multiple recipes:
        // - one for each attack
        // - one for each active defense (if all active defenses use the same rolls, they can be merged into a single usage)

        const baseRecipe: IUsageRecipe = {
          id: `weapon-${weapon.id}`,
          index: [23, (existingRecipes?.length ?? 0) + index],
          sources: { gcs: weapon },
          path: `${object.path}.weapons.${index}`,
          pipelines: [],
          tags: [],
          source: `weapon-${weapon.id}`,
        }

        const localRecipes = [] as IUsageRecipe[]

        // WEAPON.TYPE
        if (weapon.type === `melee_weapon`) {
          const recipe = cloneDeep(baseRecipe) as IUsageRecipe

          recipe.id = `${recipe.id}-melee`
          recipe.pipelines.push(FeatureMeleeUsagePipeline)
          recipe.pipelines.push(FeatureDamageUsagePipeline)

          localRecipes.push(recipe)
        } else if (weapon.type === `ranged_weapon`) {
          const recipe = cloneDeep(baseRecipe) as IUsageRecipe

          recipe.id = `${recipe.id}-ranged`
          recipe.pipelines.push(FeatureRangedUsagePipeline)
          recipe.pipelines.push(FeatureDamageUsagePipeline)

          localRecipes.push(recipe)
        } else {
          // ERROR: Unimplemented weapon type
          debugger
        }

        // DEFENSES
        for (const defense of defenses) {
          const defenseRecipe = cloneDeep(baseRecipe) as IUsageRecipe
          defenseRecipe.id = `${defenseRecipe.id}-${defense}`
          defenseRecipe.pipelines.push(FeatureDefenseUsagePipeline)
          defenseRecipe.mode = defense

          let addRecipe = false

          // SOURCES of defenses are:
          //    A. features with a defense property (or with at least a usage with a defense property)
          //    B. features with a defense formula property (<defense>at, usually only if GCA)
          //    C. features linked with a defense-capable skill
          //    D. VTT_NOTES tag

          // here we just account for A. and C., sice the rest derives from features
          // TODO: implement B., D.

          // A.
          const weaponHasDefenseModifier = weapon[defense] !== `No` && weapon[defense] !== `-` && !isNil(weapon[defense])
          if (weaponHasDefenseModifier) addRecipe = true

          // C.
          //    get all skills from defaults of weapons
          //        in GCS, a weapon have skills in defaults
          //        in GCA, a skill have modes (which are basically weapons)
          //          so we get skills from defaults of GCS, and correlate the many modes of a GCA skill to the weapon that originated the list of defaults
          //    from skills determine if GCS.Entry is defense-capable
          //      entry has property <defense>at (internaly known as "formula")
          //      entry has property <defense> (internaly known as "modifier")
          //      entry is one of the pre-defined defense-capable skills (block/cloak, melee weapon)
          if (!addRecipe) {
            const definitions = weapon.defaults?.map(_default => parseLevelDefinition(_default)) ?? []
            for (const definition of definitions) {
              const { variablesByType } = setupCheck(definition)
              const skillVariables = variablesByType.skill
              if (!skillVariables?.length) continue

              const listOfIndexes = skillVariables.map(variable => variable.value as number[])
              for (const indexes of listOfIndexes) {
                // list of variants of a skill acceptable to that variable in definition
                const pool = indexes.map(index => GCA.entries[index])
                for (const skill of pool) {
                  let formula = skill[`${defense}at`] as string // formula
                  let modifier = (skill[defense] as string) ?? `No` // modifier

                  // mode reduction
                  if (formula?.options || modifier?.options) {
                    const modeIndex = indexOf(
                      skill.mode.options.map(o => o.toLowerCase()),
                      weapon.usage?.toLowerCase(),
                    )

                    // ERROR: Untested for non-matching modes <-> usages
                    if (modeIndex === -1) debugger

                    if (formula?.options) formula = formula?.options?.[modeIndex] ?? formula
                    if (modifier?.options) modifier = modifier?.options?.[modeIndex] ?? modifier
                  }

                  // [entry is one of the pre-defined defense-capable skills (block/cloak, melee weapon)]
                  if (!isNil(modifier)) addRecipe = modifier !== `No` && modifier !== `-`
                  // [entry has property <defense>at (internaly known as "formula")]
                  else if (!isNil(formula)) addRecipe = formula !== `No` && formula !== `-`
                  // [entry has property <defense> (internaly known as "modifier")]
                  else {
                    const block = [/shield/i, /cloak/i]
                    if (block.some(pattern => pattern.test(skill.name))) addRecipe = true

                    const parry = [/karate/i, /boxing/i, /brawling/i, /judo/i, /wrestling/i, /sumo wrestling/i]
                    if (parry.some(pattern => pattern.test(skill.name))) addRecipe = true

                    const entryTags = (skill.tags as string[]) ?? []
                    if (entryTags.some(tag => tag.match(/melee combat/i)) && entryTags.some(tag => tag.match(/weapon/i))) addRecipe = true
                  }

                  if (addRecipe) continue
                }

                if (addRecipe) continue
              }

              if (addRecipe) continue
            }
          }

          if (addRecipe) localRecipes.push(defenseRecipe)
        }

        recipes.push(...localRecipes)
      }

      return { recipes: PUSH(`recipes`, recipes) }
    }

    return {}
  }),
  derivation([`container`, `formulas`], [`recipes`], function derivationLinksToDefenseUsages(_, __, { object }: { object: GenericFeature }) {
    // usages:compiled is not on derivation because rolls are already derived from it
    const { container, formulas, recipes: existingRecipes } = object.data
    const actor = object.actor

    // if (object.data.name === `Light Cloak`) debugger
    if (!actor || container || isNil(formulas)) return {}

    if (![`advantage`, `equipment`].some(type => object.type.compare(type))) return {}

    const baseRecipe: IUsageRecipe = {
      id: `${object.id}`,
      index: [0, existingRecipes?.length ?? 0],
      sources: {
        manual: { shadow: true },
      },
      path: `${object.path}`,
      pipelines: [],
      tags: [],
      source: `${object.id}`,
    }

    const defenses = [`block`, `dodge`, `parry`] as const
    const recipes = [] as IUsageRecipe[]

    // SOURCES of defenses are:
    //    A. features with a defense property (or with at least a usage with a defense property)
    //    B. features with a defense formula property (<defense>at, usually only if GCA)
    //    C. features linked with a defense-capable skill
    //    D. VTT_NOTES tag

    // [A] Done in UsableFeaturePipeline::derivationWeaponToUsages

    // B (technically formulas will never change after source is first-compiled)
    for (const defense of defenses) {
      if (formulas?.activeDefense?.[defense]?.length) {
        const recipe = cloneDeep(baseRecipe) as IUsageRecipe

        recipe.id = `formula-${recipe.id}-${defense}`
        recipe.pipelines.push(FeatureDefenseUsagePipeline)
        recipe.mode = defense

        recipes.push(recipe)
      }
    }

    // [C] Done in UsableFeaturePipeline::derivationWeaponToUsages

    // D
    // TODO: Implement for VTT_NOTES tags (mind shield would require it, for example)

    // TODO: Implement for powers
    // TODO: Implement taking modifiers (limitations and enhancements) into account

    debugger
    return { recipes: PUSH(`recipes`, recipes) }
  }),

  // #region DATA
  derivation([`recipes`], [`usages`], function (_, __, { object }: { object: GenericFeature }) {
    const factory = object.factory
    const allRecipes = object.data.recipes ?? []

    if (isNil(allRecipes)) return {}

    // group recipes by pipelines+source
    //    pipelines can yield different usages for the same gcs
    //    source of "gcs" can yield different usages for the same usages
    const byPipelines = groupBy(
      allRecipes,
      recipe => uniq(orderBy(recipe.pipelines, `name`).map(pipeline => pipeline.name)).join(`,`) + `+` + (recipe.mode ?? `default`) + `+` + recipe.source,
    )

    // make features
    const features = [] as FeatureUsage[]
    for (const [key, recipes] of Object.entries(byPipelines)) {
      // ERROR: Untested
      if (recipes.length !== 1) debugger

      for (const recipe of recipes) {
        const feature = factory
          .build(`usage`, recipe.id, recipe.index, object, {
            context: { templates: [FeatureUsageContextTemplate] },
          })
          .addPipeline(...recipe.pipelines)
          .addSource(`manual`, { mode: recipe.mode, tags: recipe.tags, ...(recipe.sources.manual ?? {}) })

        for (const [name, source] of Object.entries(recipe.sources)) {
          if (name === `manual`) continue
          if (name === `gcs`) feature.addSource(`gcs`, source, { path: recipe.path })
          else feature.addSource(name, source)
        }

        // feature.on(`compile:gcs`, event => {
        //   LOGGER.info(
        //     `UsableFeaturePipeline:compile:gcs`,
        //     event.data.feature.id,
        //     event.data.feature.data.name,
        //     `@`,
        //     event.data.feature.parent.id,
        //     event.data.feature.parent.data.name,
        //     event.data.feature,
        //   )
        // })

        features.push(feature as any as FeatureUsage)
      }
    }

    return { usages: PUSH(`usages`, features) }
  }),
  // derivation([`usages:integrated`], [`recipes`], function derivationUsagesToRecipes(_, __, { object }: { object: GenericFeature }) {
  //   const { usages, recipes: existingRecipes } = object.data
  //   const actor = object.actor

  //   if (!usages?.length || !actor) return {}

  //   // check rolls associated with usages.hit to check if some usage is defense-capable

  //   // SOURCES of defenses are:
  //   //    A. features with a defense property (or with at least a usage with a defense property)
  //   //    B. features with a defense formula property (<defense>at, usually only if GCA)
  //   //    C. features linked with a defense-capable skill
  //   //    D. VTT_NOTES tag

  //   // C.
  //   //    get all skills from defaults of weapons
  //   //    from skills determine if feature is defense-capable
  //   debugger

  //   return {}
  // }),
  // derivation([`usages:compiled`, `actor.skills`], [`rolls`], function (_, __, { object }: { object: GenericFeature }) {
  //   const actor = object.actor
  //   const { container, usages } = object.data

  //   const GCASkills = actor.cache.gca?.skill

  //   if (!GCASkills || container || ![`advantage`, `equipment`].some(type => object.type.compare(type)) || isNil(usages)) return {}

  //   const INDEX = {} as Record<string, string[]>

  //   // if (object.id === `30a740fb-c141-413f-9a20-87b7e62d8d84`) debugger

  //   //    from usages
  //   for (const usage of usages ?? []) {
  //     const rolls = [] as IUseRoll[]

  //     const definitions = usage.data.rolls
  //     if (!definitions) {
  //       LOGGER.error(`gcs`, `Usage entry`, `"${usage.data.name}"`, `for`, `"${usage.parent?.data.name}"`, `lacks default definitions.`, [
  //         `color: #826835;`,
  //         `color: rgba(130, 104, 53, 60%); font-style: italic;`,
  //         `color: black; font-style: regular; font-weight: bold`,
  //         ``,
  //       ])
  //       continue
  //     }

  //     for (const definition of definitions) {
  //       const { variables, variablesByType, types } = setupCheck(definition)

  //       debugger

  //       const skillVariables = variablesByType[`skill`] ?? []
  //       if (skillVariables.length === 0) continue

  //       const indexes = skillVariables.map(target => target.value).flat() as number[]
  //       const entries = indexes.map(index => GCA.entries[index])

  //       const features = indexes.map(entry => GCASkills[entry])

  //       rolls.push(...features.filter(feature => !isNil(feature)).map(feature => feature.id))
  //     }

  //     if (rolls.length > 0) INDEX[usage.id] = rolls
  //   }

  //   if (Object.keys(INDEX).length === 0) return {}
  //   return { rolls: OVERWRITE(`rolls`, INDEX) }
  // }),
  // #endregion
]

UsableFeaturePipeline.name = `UsableFeaturePipeline`
// UsableFeaturePipeline.post = function postUsable(data, object) {
//   const MDO = {} as MigrationDataObject<any>

//   if (has(data, `usages`) && data.usages.length > 0) {
//     const factory = object.factory
//     const usages = [] as Feature<any, never>[]

//     for (let index = 0; index < data.usages.length ?? 0; index++) {
//       const usage = data.usages[index] as any as GCS.Entry

//       debugger
//       const feature = factory
//         .build(`usage`, usage.id, index, object, {
//           context: { templates: [FeatureUsageContextTemplate] },
//         })
//         .addSource(`gcs`, usage)

//       usages.push(feature)
//     }

//     MDO.usages = OVERWRITE(`usages`, usages)
//   }

//   return MDO
// }
