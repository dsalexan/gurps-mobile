/* eslint-disable no-debugger */
import { cloneDeep, flatten, flattenDeep, groupBy, intersection, isNil, orderBy, partition, sum, uniq, uniqBy, unzip } from "lodash"
import { parseBonus } from "./bonus"
import { ILevel, ILevelDefinition, calculateLevel, nonSkillOrAllowedSkillVariables } from "./level"
import { GurpsMobileActor } from "../../gurps-mobile/foundry/actor"
import { parseExpression } from "../../december/utils/math"
import SkillFeature from "../../gurps-mobile/foundry/actor/feature/skill"
import WeaponFeature from "../../gurps-mobile/foundry/actor/feature/usage"
import GenericFeature from "../../gurps-mobile/foundry/actor/feature/generic"
import { LOGGER } from "../../mobile"
import AdvantageFeature from "../../gurps-mobile/foundry/actor/feature/advantage"
import FeatureUsage from "../../gurps-mobile/foundry/actor/feature/usage"

export interface IBaseActiveDefenseLevel {
  type: string
  //
  level: number
  sourceBonus: number
  //
  source: GenericFeature | null
  base: Record<string, unknown>
  breakdown: Record<string, unknown>
}

export interface IWeaponActiveDefenseLevel extends IBaseActiveDefenseLevel {
  type: `weapon`
  source: WeaponFeature
  base: {
    skill: SkillFeature
    ignoreSpecialization: boolean
  }
  breakdown: {
    weapons: WeaponFeature[]
    skills: SkillFeature[]
  }
}

export interface IAttributeActiveDefenseLevel extends IBaseActiveDefenseLevel {
  type: `attribute`
  source: null
  base: {
    attribute: `st` | `dx` | `iq` | `ht` | `will` | `per` | `fp` | `hp` | `speed` | `move`
  }
  breakdown: {
    attributes: (`st` | `dx` | `iq` | `ht` | `will` | `per` | `fp` | `hp` | `speed` | `move`)[]
  }
}

export interface IPowerActiveDefenseLevel extends IBaseActiveDefenseLevel {
  type: `power`
  source: AdvantageFeature
  base: {
    attribute: `st` | `dx` | `iq` | `ht` | `will` | `per` | `fp` | `hp` | `speed` | `move`
  }
  breakdown: {
    powers: unknown[] // TODO: Power would be the limitation?
    advantages: AdvantageFeature[]
    // a power defense can have skills attached, and so can attributes
    skills: SkillFeature[]
    attributes: (`st` | `dx` | `iq` | `ht` | `will` | `per` | `fp` | `hp` | `speed` | `move`)[]
  }
}

export type IActiveDefenseLevel = IWeaponActiveDefenseLevel | IAttributeActiveDefenseLevel | IPowerActiveDefenseLevel

export function activeDefenseLevel(activeDefense: `block` | `dodge` | `parry` | `all`, actor: GurpsMobileActor, highest?: false): IActiveDefenseLevel[]
export function activeDefenseLevel(activeDefense: `block` | `dodge` | `parry` | `all`, actor: GurpsMobileActor, highest: true): IActiveDefenseLevel | undefined
export function activeDefenseLevel(
  activeDefense: `block` | `dodge` | `parry` | `all`,
  actor: GurpsMobileActor,
  highest = false,
): IActiveDefenseLevel | IActiveDefenseLevel[] | undefined {
  // get all features linked to defense
  const features = activeDefenseFeatures(activeDefense, actor)

  let adls = [] as IActiveDefenseLevel[]
  const usageSkills = [] as { usage: FeatureUsage; skill: Similars }[]

  type Similars = { sl: number; skill: SkillFeature; forms: SkillFeature[]; specializations: SkillFeature[] }

  if (features.length > 0) {
    const nonSkills = features.filter(feature => !feature.type.compare(`skill`, false))
    if (nonSkills.length > 0) LOGGER.warn(`Non-skill features in activeDefenseLevel calculation`, activeDefense, nonSkills, actor)

    // list all actor skills with activeDefense property (only skills have activeDefense property)
    debugger
    const allSkills = features.filter(feature => feature.type.compare(`skill`) && (feature as any as SkillFeature).data.activeDefense?.[activeDefense]) as any as SkillFeature[]
    const allSkillsWithLevel = allSkills.filter(skill => !isNil(skill.data.level)) as SkillFeature[]
    const knownLeveledSkills = allSkillsWithLevel.map(skill => skill.sources.gca?._index)
    const skillsGCAIndex = Object.fromEntries(allSkillsWithLevel.map(skill => [skill.sources.gca?._index, skill]))

    // aggregate specializations and build indexes for specializations
    //        ReferenceSkill: A SkillFeature used as reference for a subset of specializations (ex.: Smith (Iron) could be the ReferenceSkill for a subset of Smith (Iron), Smith (Copper) and Smith (Tin))
    //                        Its mostly the first skill in the sheet which shares the same level with its other specializations
    //
    //    Record<name+level, Skill[]>
    const byBaseNameAndSkillLevel = groupBy(allSkillsWithLevel, skill => `${skill.data.name}+${skill.data.level!.level}`)
    //    List<(ReferenceSkill, (SpecializedSkill.gca.index, ReferenceSkill.gca.index)[])>
    const skillsAndIgnoreSpecializationFlag = Object.values(byBaseNameAndSkillLevel).map(
      specializedSkills => [specializedSkills[0] as SkillFeature, specializedSkills.map(skill => [skill.sources.gca?._index, specializedSkills[0].sources.gca?._index])] as const,
    )
    //    List<ReferenceSkill>, List<(SpecializedSkill.gca.index, ReferenceSkill.gca.index)[]>
    const [referenceSkills, specializationPairs] = unzip(skillsAndIgnoreSpecializationFlag) as [SkillFeature[], [number, number][][]]
    //    Record<SpecializedSkill.gca.index, ReferenceSkill.gca.index[]>
    //      This is used to get the ReferenceSkill from a SpecializedSkill
    const specializationToReference = Object.fromEntries(flatten(specializationPairs))
    //    Record<ReferenceSkill.gca.index, SpecializedSkill.gca.index[]>
    //       This is used to get a list of SpecializedSkill indexes from a ReferenceSkill
    const referenceToSpecialization = {} as Record<number, number[]>
    for (const [key, value] of Object.entries(specializationToReference)) {
      if (referenceToSpecialization[value] === undefined) referenceToSpecialization[value] = []
      referenceToSpecialization[value].push(parseInt(key))
    }

    // #region SPECIAL CASES

    // FORM-VARIANT SKILL (ART/SPORT Skills)
    //        get the better of GENERAL/ART/SPORT skills (every combat skill can have a Art or Sport variant)
    //    List<(ReferenceSkill, ActiveDefenseFormula)>
    //      get all active defense formulas for a given reference skill
    const skillsAndDefenseLevel = flatten((referenceSkills ?? []).map(skill => (skill.data.activeDefense?.[activeDefense] ?? []).map(formula => [skill, formula] as const))) as [
      SkillFeature,
      string,
    ][]
    //    Record<name+ActiveDefenseFormula, List<ReferenceSkill>>
    //      group skills by base name (modified to ignore art/sport variance) and active defense formula
    const byNameAndDefenseLevelFormula = groupBy(
      skillsAndDefenseLevel,
      ([skill, formula]) => `${skill.data.name.replace(/(?<=\w) sport(?!\w)/i, ``).replace(/(?<=\w) art(?!\w)/i, ``)}+${formula}`,
    ) as Record<string, [SkillFeature, string][]>
    const listsOfFormVariantSkillsAndFormulasByNameAndDefenseLevelFormula = Object.values(byNameAndDefenseLevelFormula)
    //      each entry of list has form-variants of reference skills grouped by skill level
    const listOfFormVariantSkillsAndFormulasBySkillLevel = listsOfFormVariantSkillsAndFormulasByNameAndDefenseLevelFormula.map(
      listOfFormVariantSkillsAndFormulasByNameAndDefenseLevelFormula => {
        const formVariantSkillsOrderedByForm = orderBy(
          listOfFormVariantSkillsAndFormulasByNameAndDefenseLevelFormula,
          ([skill, formula]) => ({ false: 0, sport: 1, art: 2 }[skill.data.form as string] ?? 3),
        )
        // const skillsOrderedByLevel = orderBy(skillsOrderedByForm, ([skill, formula]) => skill.data.level?.level ?? -Infinity)

        debugger
        // group (form-variant skill, formula) by level (to later only get the highest level for a skill+formula tuple)
        return groupBy(formVariantSkillsOrderedByForm, ([skill]) => skill.data.level?.level ?? -Infinity)
      },
    )
    // #endregion

    // just mash all "similar" skills together in a "similars" object
    const referenceToSimilars = {} as Record<number, number>
    const similarsIndex = {} as Record<number, Similars>
    for (const formVariantSkillsAndFormulasBySkillLevel of listOfFormVariantSkillsAndFormulasBySkillLevel) {
      const skillLevels = Object.keys(formVariantSkillsAndFormulasBySkillLevel)

      for (const skillLevel of skillLevels) {
        const [formVariantSkills, formulas] = unzip(formVariantSkillsAndFormulasBySkillLevel[skillLevel]) as [SkillFeature[], string[]]

        // order form-variant skills by form (GENERAL, SPORT, ART) (like, I just ordered this guys above but ok)
        const orderedSkills = orderBy(formVariantSkills, skill => ({ false: 0, sport: 1, art: 2 }[skill.data.form as string]))
        const skill = orderedSkills[0]
        const index = skill.sources.gca?._index

        // index all form-variant skills to the same "compact" skill (since each form-variant is a reference skill)
        for (const formVariant of formVariantSkills) {
          // ERROR: There should be NO overriding
          if (referenceToSimilars[formVariant.sources.gca?._index] !== undefined) debugger
          referenceToSimilars[formVariant.sources.gca?._index] = index
        }

        similarsIndex[index] = {
          sl: parseInt(skillLevel),
          skill,
          forms: formVariantSkills,
          specializations: referenceToSpecialization[index].map(index => skillsGCAIndex[index]),
        }
      }
    }

    // list all weapons with activeDefense property (for power defenses)
    const usableFeatures = features.filter(feature => feature.data.usages?.length > 0)
    const usages = flatten(usableFeatures.map(feature => feature.data.usages ?? []))
    const defenseUsages = usages.filter(weapon => weapon.data.activeDefense?.[activeDefense] !== false && !isNil(weapon.data.activeDefense?.[activeDefense]))

    // choose skill for feature weapons
    for (const usage of defenseUsages) {
      const defaults = usage.data.rolls ?? []
      if (defaults.length === 0) continue

      const viableDefinitions = defaults.filter(definition => nonSkillOrAllowedSkillVariables(definition, knownLeveledSkills))

      // get all known leveled skills from viable definitions
      const skillIndexes = viableDefinitions
        .map(definition => {
          const variables = Object.values(definition.variables ?? {})
          const skillVariables = variables.filter(target => target.type === `skill`)
          return skillVariables.map(target => (target.value as number[]).filter(value => knownLeveledSkills.includes(value))).flat()
        })
        .flat()

      const referenceSkills = skillIndexes.map(skill => specializationToReference[skill])
      const similarsSkills = uniq(referenceSkills).map(skill => referenceToSimilars[skill])
      const similars = uniq(similarsSkills).map(skill => similarsIndex[skill])

      usageSkills.push(...similars.map(skill => ({ usage, skill })))
    }
  }

  debugger
  // group (usage, skill) by skill level, defense bonus, feature and formula
  const bySkillLevelAndDefenseBonusAndFeatureAndFormula = groupBy(
    usageSkills,
    ({ skill: { sl, skill }, usage }) => `${sl}+${skill.data.activeDefense![activeDefense]}+${usage.parent!.data.name}+${usage.data[activeDefense]}`,
  )
  const listsOfGroupedWeaponSkills = Object.values(bySkillLevelAndDefenseBonusAndFeatureAndFormula) as { usage: FeatureUsage; skill: Similars }[][]

  type DefenseLevelDefinition = { pool: { skills: SkillFeature[]; weapons: WeaponFeature[] }; skill: SkillFeature; specializations: SkillFeature[]; weapon: WeaponFeature }
  const definitions = [] as DefenseLevelDefinition[]
  for (const weaponSkillsBySkillLevelAndDefenseBonusAndFeatureAndFormula of listsOfGroupedWeaponSkills) {
    const orderedWeaponSkills = orderBy(
      weaponSkillsBySkillLevelAndDefenseBonusAndFeatureAndFormula,
      ({ skill: { skill } }) => (({ false: 0, sport: 1, art: 2 }[skill.data.form as string] ?? 3) - (skill.data.training === `trained` ? 0 : 0.5)),
    )

    const relatedSkills = orderedWeaponSkills.map(({ skill: similar }) => [...similar.forms, ...similar.specializations, similar.skill]).flat()
    const similarSkills = uniqBy(relatedSkills, skill => skill.id)

    const weaponPool = uniqBy(
      orderedWeaponSkills.map(({ weapon }) => weapon),
      weapon => weapon.id,
    )

    definitions.push({
      pool: {
        skills: similarSkills,
        weapons: weaponPool,
      },
      skill: orderedWeaponSkills[0].skill.skill,
      specializations: orderedWeaponSkills[0].skill.specializations,
      weapon: orderedWeaponSkills[0].weapon,
    })
  }

  if (activeDefense === `block` || activeDefense === `parry`) {
    // TODO: Power Block
    // TODO: Power Parry
    // block depends on weapon AND skill
    //    weapon comes from features (usually equipment or advantage) - which must have a block skill (skill with block at, usually defaulted to CLOAK or SHIELD)
    //    skill with block at, usually defaulted to CLOAK or SHIELD
    for (const { pool, skill, specializations, weapon } of definitions) {
      const ignoreSpecialization = specializations.length > 1

      // ERROR: Unimplemented, main skill for defense MUST have ONLY one suitable active defense property (block or parry here)
      //        Untested for many and none, basically
      if (skill.data.activeDefense?.[activeDefense]?.length !== 1) debugger

      const weaponBonus = parseBonus(weapon.data[activeDefense] as string)
      const defenseLevel = parseExpression(skill.data.activeDefense![activeDefense][0], skill)

      const adl = {
        type: `weapon`,
        //
        level: defenseLevel,
        sourceBonus: weaponBonus.value,
        //
        source: weapon,
        base: { skill, ignoreSpecialization },
        //
        breakdown: {
          weapons: pool.weapons,
          skills: pool.skills,
        },
      } as IWeaponActiveDefenseLevel

      adls.push(adl)
    }
  } else if (activeDefense === `dodge`) {
    // TODO: Power Dodge
    // TODO: Get basic speed from actor (which should be a feature)
    // TODO: Encumbrance is dodge's source bonus

    const BASIC_SPEED = parseFloat(actor.system.basicspeed.value)
    const level = BASIC_SPEED + 3

    const adl = {
      type: `attribute`,
      //
      level,
      sourceBonus: 0,
      //
      source: null,
      base: { attribute: `speed` },
      //
      breakdown: {
        attributes: [`speed`],
      },
    } as IAttributeActiveDefenseLevel

    adls.push(adl)
  } else {
    // ERROR: Unimplemented
    debugger
  }

  // if (activeDefense === `block` || activeDefense === `parry`) {
  //   adls = features.map(feature => featureActiveDefenseLevel(activeDefense, feature, actor)).filter(level => !isNil(level)) as IActiveDefenseLevel[]
  // } else if (activeDefense === `dodge`) {
  //   debugger
  // } else {
  //   // ERROR: Unimplemented
  //   debugger
  // }

  const _adls = orderBy(adls, adl => adl.level + adl.sourceBonus, `desc`)

  if (!highest) return _adls
  return _adls[0]
}

/**
 * Return all features of actor connected to some active defense.
 * Usually will return ALL parryable and blockable skills, even untrained ones.
 */
export function activeDefenseFeatures(activeDefense: `block` | `dodge` | `parry` | `all`, actor: GurpsMobileActor): GenericFeature[] {
  const defenses = actor.cache.links?.defenses ?? {}
  const links = defenses[activeDefense] ?? []
  const features = links.map(uuid => actor.cache.features?.[uuid])

  return features
}
