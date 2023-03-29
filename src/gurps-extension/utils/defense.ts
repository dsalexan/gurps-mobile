/* eslint-disable no-debugger */
import { cloneDeep, flatten, flattenDeep, groupBy, intersection, isNil, orderBy, partition, sum, uniq, uniqBy, unzip } from "lodash"
import { parseBonus } from "./bonus"
import { ILevel, ILevelDefinition, calculateLevel } from "./level"
import GenericFeature from "../../gurps-mobile/core/feature/variants/generic"
import { GurpsMobileActor } from "../../gurps-mobile/foundry/actor"
import SkillFeature from "../../gurps-mobile/core/feature/variants/skill"
import { parseExpression } from "../../december/utils/math"
import WeaponFeature from "../../gurps-mobile/core/feature/variants/weapon"

export interface IActiveDefenseLevel {
  bonus: number
  level: number
  skill: SkillFeature
  weapon: WeaponFeature
  equivalentUsages: WeaponFeature[]
  equivalentSkills: SkillFeature[]
  ignoreSpecialization: boolean
}

export function activeDefenseLevel(activeDefense: `block` | `dodge` | `parry` | `all`, actor: GurpsMobileActor, highest?: false): IActiveDefenseLevel[]
export function activeDefenseLevel(activeDefense: `block` | `dodge` | `parry` | `all`, actor: GurpsMobileActor, highest: true): IActiveDefenseLevel | undefined
export function activeDefenseLevel(
  activeDefense: `block` | `dodge` | `parry` | `all`,
  actor: GurpsMobileActor,
  highest = false,
): IActiveDefenseLevel | IActiveDefenseLevel[] | undefined {
  const features = activeDefenseFeatures(activeDefense, actor)

  let adls = [] as IActiveDefenseLevel[]
  let weaponSkills = [] as any[]

  if (features.length > 0) {
    // list all actor skills with activeDefense property
    const allSkills = features.filter(feature => feature.activeDefense?.[activeDefense])
    const skillsIndex = allSkills.map(skill => skill.__compilation.sources.gca?._index)
    const skillsMap = Object.fromEntries(allSkills.map(skill => [skill.__compilation.sources.gca?._index, skill]))

    // aggregate specializations
    const byNonSpecializedNameAndSkillLevel = groupBy(allSkills, skill => `${skill.name}+${skill.calcLevel()?.level}`)
    const skillsAndIgnoreSpecializationFlag = Object.values(byNonSpecializedNameAndSkillLevel).map(
      specializedSkills =>
        [
          specializedSkills[0] as SkillFeature,
          specializedSkills.map(skill => [skill.__compilation.sources.gca?._index, specializedSkills[0].__compilation.sources.gca?._index]),
        ] as const,
    )
    const [flaggedSkills, specializationPairs] = unzip(skillsAndIgnoreSpecializationFlag) as [SkillFeature[], [number, number][][]]
    const specializationToNonSpecialized = Object.fromEntries(flatten(specializationPairs))
    const nonSpecializedToSpecialization = {}
    for (const [key, value] of Object.entries(specializationToNonSpecialized)) {
      if (nonSpecializedToSpecialization[value] === undefined) nonSpecializedToSpecialization[value] = []
      nonSpecializedToSpecialization[value].push(key)
    }

    // SPECIAL CASE FOR SKILLS: get the better of GENERAL/ART/SPORT skills (every combat skill can have a Art or Sport variant)
    const skillsAndDefenseLevel = flatten((flaggedSkills ?? []).map(skill => (skill.activeDefense?.[activeDefense] ?? []).map(formula => [skill, formula] as const)))
    const byNameAndDefenseLevelFormula = groupBy(
      skillsAndDefenseLevel,
      ([skill, formula]) => `${skill.name.replace(/(?<=\w) sport(?!\w)/i, ``).replace(/(?<=\w) art(?!\w)/i, ``)}+${formula}`,
    )
    const byNameAndSkillLevel = Object.values(byNameAndDefenseLevelFormula).map(skillAndDefenseLevelFormula =>
      groupBy(
        skillAndDefenseLevelFormula.map(([skill]) => skill),
        skill => skill.calcLevel()?.level ?? -Infinity,
      ),
    )

    const nonSpecialializedToCompact = {}
    const compactSkills = Object.fromEntries(
      flatten(
        byNameAndSkillLevel.map(bySkillLevel =>
          Object.entries(bySkillLevel).map(([sl, skills]) => {
            const skill = orderBy(skills, (skill: SkillFeature) => ({ false: 0, sport: 1, art: 2 }[skill.form as string]))[0]
            const index = skill.__compilation.sources.gca?._index

            for (const s of skills) {
              // ERROR: There should be NO overriding
              if (nonSpecialializedToCompact[s.__compilation.sources.gca?._index] !== undefined) debugger
              nonSpecialializedToCompact[s.__compilation.sources.gca?._index] = index
            }

            return [
              index,
              {
                sl,
                pool: skills,
                skill,
                specializations: nonSpecializedToSpecialization[index].map(gcaIndex => skillsMap[gcaIndex]),
              },
            ]
          }),
        ),
      ),
    )

    // list all weapons with activeDefense property (for power defenses)
    const equipments = features.filter(feature => feature.type.compare(`equipment`))
    const weapons = flatten(equipments.map(equipment => equipment.weapons ?? []))
    const defenseWeapons = weapons.filter(weapon => weapon[activeDefense] !== false)

    // choose skill for equipment weapons
    weaponSkills = flatten(
      defenseWeapons.map(weapon => {
        const levels = weapon.defaults ?? []
        if (levels.length === 0) return []

        const allSkillTargetsAreInList = levels.filter(level => {
          const targets = level.targets ?? {}
          const notSkillOrIsInList = Object.values(targets).every(target => target.type !== `skill` || intersection(target.value as any, skillsIndex).length > 0)
          const hasSkillTarget = Object.values(targets).some(target => target.type === `skill`)

          return notSkillOrIsInList && hasSkillTarget
        })

        const skills = flattenDeep(
          allSkillTargetsAreInList.map(level =>
            Object.values(level.targets ?? {})
              .filter(target => target.type === `skill`)
              .map(target => target.value),
          ),
        )
        const toNonSpecialized = skills.map(skill => specializationToNonSpecialized[skill])
        const toCompactSkill = uniq(toNonSpecialized).map(skill => nonSpecialializedToCompact[skill])
        const skillList = uniq(toCompactSkill).map(skill => compactSkills[skill])

        return skillList.map(skill => [skill, weapon])
      }),
    )
  }

  const byEquipmentAndDefenseBonusAndDefenseFormulaAndSkillLevel = groupBy(
    weaponSkills,
    ([{ sl, skill }, weapon]) => `${sl}+${skill.activeDefense[activeDefense]}+${weapon.parent.name}+${weapon[activeDefense]}`,
  )

  const flatTuples = Object.values(byEquipmentAndDefenseBonusAndDefenseFormulaAndSkillLevel).map(similar => {
    const arbitraryOrder = orderBy(similar, ([{ skill }]) => (({ false: 0, sport: 1, art: 2 }[skill.form as string] ?? 3) - (skill.training === `trained` ? 0 : 0.5)))

    let _pool = [] as any[],
      usages = [] as any[]

    for (const [{ pool, skill, specializations }, weapon] of arbitraryOrder) {
      _pool.push(skill, ...pool, ...specializations)
      usages.push(weapon)
    }

    return {
      pool: uniqBy(_pool, skill => skill.id),
      specializations: similar[0][0].specializations,
      usages: uniqBy(usages, skill => skill.id),
      skill: similar[0][0].skill,
      weapon: similar[0][1],
    }
  })

  if (activeDefense === `block` || activeDefense === `parry`) {
    // block depends on weapon AND skill
    //    weapon comes from equipment - which must have a block skill (skill with block at, usually defaulted to CLOAK or SHIELD)
    //    skill with block at, usually defaulted to CLOAK or SHIELD
    for (const { pool, specializations, usages, skill, weapon } of flatTuples) {
      const ignoreSpecialization = specializations.length > 1

      // ERROR: Unimplemented
      if (skill.activeDefense[activeDefense].length !== 1) debugger

      const weaponBonus = parseBonus(weapon[activeDefense])
      const defenseLevel = parseExpression(skill.activeDefense[activeDefense][0], skill)

      const adl = {
        bonus: weaponBonus.value,
        level: defenseLevel,
        skill,
        weapon,
        equivalentUsages: usages,
        equivalentSkills: pool,
        ignoreSpecialization,
      } as IActiveDefenseLevel

      adls.push(adl)
    }
  } else if (activeDefense === `dodge`) {
    const DX = actor.system.attributes.DX
    const defenseLevel = Math.floor(parseFloat(DX.value as any) / 2) + 3

    const adl = {
      bonus: 0,
      level: defenseLevel,
    } as IActiveDefenseLevel

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

  const _adls = orderBy(adls, adl => adl.level + adl.bonus, `desc`)

  if (!highest) return _adls
  return _adls[0]
}

export function activeDefenseFeatures(activeDefense: `block` | `dodge` | `parry` | `all`, actor: GurpsMobileActor): GenericFeature[] {
  const defenses = actor.cache.links?.defenses ?? {}
  const links = defenses[activeDefense] ?? []
  const features = links.map(uuid => actor.cache.features?.[uuid])

  return features
}
