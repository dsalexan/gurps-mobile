/* eslint-disable no-debugger */
import { cloneDeep, flatten, flattenDeep, get, groupBy, isArray, isEmpty, isNil, isString, set, uniq } from "lodash"
import { IDerivation, IDerivationPipeline, derivation, proxy } from "."
import { isNilOrEmpty, push } from "../../../../../december/utils/lodash"
import { GCS } from "../../../../../gurps-extension/types/gcs"
import { MigrationDataObject, MERGE, MigrationValue, OVERWRITE, PUSH, WRITE, isOrigin } from "../../../../core/feature/compilation/migration"
import {
  IAttributeBonusComponent,
  IComponentDefinition,
  IDRBonusComponent,
  ISkillBonusComponent,
  IWeaponBonusComponent,
  parseComponentDefinition,
  updateComponentSchema,
} from "../../../../../gurps-extension/utils/component"
import { IFeatureData } from ".."
import { Type } from "../../../../core/feature"
import { FeatureState } from "../../../../core/feature/utils"
import { ILevelDefinition, setupCheck } from "../../../../../gurps-extension/utils/level"
import { GURPS4th } from "../../../../../gurps-extension/types/gurps4th"
import { deepDiff } from "../../../../../december/utils/diff"
import GenericFeature from "../generic"
import SkillFeature from "../skill"
import LOGGER from "../../../../logger"

export interface IGenericFeatureFormulas {
  activeDefense?: Record<`block` | `dodge` | `parry`, string[]>
}

export interface IGenericFeatureData extends IFeatureData {
  name: string
  specialization?: string
  specializationRequired?: boolean
  container: boolean
  proxy?: boolean

  value?: string | number
  label: string
  tl?: {
    level: number
    required?: boolean
    range?: string
  }

  categories: string[]
  notes: string[]
  meta: string
  tags: string[]
  conditional: string[]
  reference: string[]

  formulas?: IGenericFeatureFormulas

  defaults?: ILevelDefinition[]
  // calcLevel(attribute: GURPS4th.AttributesAndCharacteristics): ILevel | null

  // relationships
  group?: string // string to group features by
  links: string[] // strings to establish relationships between features
  components: IComponentDefinition[] // basically modifiers to other features or aspects of the actor
}

export const GenericFeaturePipeline: IDerivationPipeline<IGenericFeatureData> = [
  // #region GCS
  derivation.gcs(`type`, `container`, function ({ type }) {
    const isContainer = type?.match(/_container$/)
    this.container = !!isContainer
    return { container: isContainer ? OVERWRITE(`container`, true) : WRITE(`container`, false) }
  }),
  derivation.gcs([`name`, `specialization`], [`name`, `specialization`], function ({ name, specialization }) {
    this.humanId = name

    if (isNilOrEmpty(specialization) && !isNilOrEmpty(name)) {
      const _hasSpecialization = / \((.*)\)$/

      const hasSpecialization = name.match(_hasSpecialization)
      if (hasSpecialization) {
        name = name.replace(hasSpecialization[0], ``)
        specialization = hasSpecialization[1].replaceAll(/[\[\]]/g, ``)
      }
    }

    return { name, specialization }
  }),
  derivation.gcs(`tech_level`, `tl`, function ({ tech_level }) {
    if (isNil(tech_level)) return {}

    const tl = { level: parseInt(tech_level) }

    this.tl = tl.level

    return { tl: MERGE(`tl`, tl) }
  }),
  proxy.gcs(`label`),
  derivation.gcs(`notes`, `notes`, ({ notes }) => ({ notes: flattenDeep([notes ?? []]) })),
  derivation.gcs(`vtt_notes`, `meta`, ({ vtt_notes }) => ({ meta: vtt_notes })),
  derivation.gcs(`reference`, `reference`, ({ reference }) => ({
    reference: PUSH(
      `reference`,
      flatten(
        flattenDeep(isArray(reference) ? reference : [reference])
          .filter(r => !isNil(r))
          .map(r => r.split(/ *, */g)),
      ).filter(ref => ref !== ``),
    ),
  })),
  derivation.gcs(`tags`, `tags`, function ({ tags }) {
    if (!tags) return {}
    return { tags: tags.filter(tag => tag !== this.type.name) }
  }),
  derivation.gcs(`conditional`, `conditional`, ({ conditional }) => ({ conditional: flattenDeep([conditional ?? []]) })),
  derivation.gcs(`features`, `components`, ({ features }, _, { object }) => {
    if (!features) return {}

    const definitions = (features ?? []).map((f, index) => parseComponentDefinition(f as any, object.id, index))
    const byType = groupBy(definitions, `type`) as Record<IComponentDefinition[`type`], IComponentDefinition[]>
    const entries = Object.entries(byType) as [IComponentDefinition[`type`], IComponentDefinition[]][]

    const finalComponents = [] as IComponentDefinition[]
    for (const [type, allComponents] of entries) {
      if (allComponents.length === 1) {
        finalComponents.push(updateComponentSchema(allComponents[0], cloneDeep(allComponents[0])))
        continue
      }

      // GENERIC DIFF ANALYSIS
      const tableDiff = [] as any[][]
      const allDiff = [] as [number, number, any][]

      for (let i = 0; i < allComponents.length; i++) {
        tableDiff[i] = []
        for (let j = 0; j <= i; j++) {
          if (i === j) continue
          else {
            const diff = deepDiff(allComponents[i], allComponents[j])
            tableDiff[i][j] = diff
            allDiff.push([i, j, diff])
          }
        }
      }

      const allKeys = uniq(allDiff.map(([i, j, diff]) => Object.keys(diff ?? {})).flat())
      const firstOrderKeys = uniq(allKeys.map(key => key.split(`.`)[0]))

      // decide speficic aggregation technique
      let authorizedProperties = null as any as string[]
      if (type === `skill_bonus` || type === `weapon_bonus`) {
        const components = allComponents as ISkillBonusComponent[] | IWeaponBonusComponent[]
        const selectionTypes = uniq(components.map(c => c.selection_type))

        // AGGREGATE IF
        //    all selection types are the same
        if (selectionTypes.length === 1 && (selectionTypes[0] === `skills_with_name` || selectionTypes[0] === `weapons_with_name`)) {
          authorizedProperties = [`name`, `specialization`]
        } else {
          // ERROR: Unimplemented multiple selection type aggregation
          debugger
        }
      } else if (type === `attribute_bonus` || type === `dr_bonus`) {
        const components = allComponents as IAttributeBonusComponent[] | IDRBonusComponent[]

        // all attribute/dr bonuses can just agrgegate its attributes/locations
        authorizedProperties = type === `attribute_bonus` ? [`attribute`] : [`location`]
      }

      // if there authorized properties is null, then component was not analysed
      if (authorizedProperties !== null) {
        // if aggregation is authorized, go for it
        //    authorized mens: if all diffs are in those expected for this technique
        if (firstOrderKeys.every(key => key === `id` || authorizedProperties.includes(key))) {
          // TODO: How to factor amount into aggregation? Since it doenst invalidade a aggregation, just break into by similar amounts (kind of like with component.type han)

          const component = updateComponentSchema(allComponents[0], cloneDeep(allComponents[0]))

          for (const otherComponent of allComponents.slice(1)) {
            updateComponentSchema(otherComponent, component)
          }

          finalComponents.push(component)
        } else {
          debugger
        }

        // was not authorized, but passed analysis
        continue
      }

      // if it was not aggregated, breakpoint to read analysis
      debugger
    }

    return { components: PUSH(`components`, finalComponents) }
  }),
  // #endregion
  // #region ACTOR
  derivation([`actor`, `components`], [], function (_, __, { object }) {
    if (isNil(object.actor) || isNil(object.data.components)) return {}

    for (const component of object.data.components) object.actor.addComponent(component)

    return {}
  }),
  derivation([`actor`, `links`], [], function (_, __, { object }) {
    if (isNil(object.actor) || isNil(object.data.links)) return {}

    object.actor.addLink(object, object.data.links)

    return {}
  }),
  // #endregion
  // #region GCA
  derivation.gca([`name`, `nameext`], [`name`, `specialization`], function ({ name, nameext }) {
    this.humanId = this.humanId ?? name

    let specialization = nameext
    if (nameext !== undefined && !isString(nameext)) {
      debugger
    }

    // TODO: Implement a better dynamic detector in GCA parsing
    return { name, specialization: specialization?.replaceAll(/[\[\]]/g, ``) }
  }),
  proxy.gca(`specializationRequired`),
  proxy.gca(`label`),
  derivation.gca(`tl`, `tl`, function ({ tl }) {
    if (isNil(tl)) return {}

    return {
      tl: MERGE(`tl`, {
        required: true,
        range: tl,
      }),
    }
  }),
  derivation.gca(`page`, `reference`, ({ page }) => ({ reference: PUSH(`reference`, flattenDeep([page ?? []])) })),
  derivation.gca(`cat`, `categories`, ({ cat }) => ({ categories: flattenDeep([cat ?? []]) })),
  derivation.gca(`itemnotes`, `notes`, ({ itemnotes }) => ({ notes: PUSH(`notes`, flattenDeep([itemnotes ?? []])) })),
  derivation.gca([`blockat`, `parryat`, `dodgeat`], [`formulas`], ({ blockat, parryat, dodgeat }) => {
    const activeDefense = {} as Record<`block` | `parry` | `dodge`, string[]>

    if (blockat && !isEmpty(blockat)) push(activeDefense, `block`, blockat)
    if (parryat && !isEmpty(parryat)) push(activeDefense, `parry`, parryat)
    if (dodgeat && !isEmpty(dodgeat)) push(activeDefense, `dodge`, dodgeat)

    if (Object.keys(activeDefense).length === 0) return {}
    return { formulas: MERGE(`formulas`, { activeDefense }) }
  }),
  // #endregion
  // #region DATA
  derivation([`formulas`], [`links`], function (_, __, { object }: { object: GenericFeature }) {
    const formulas = object.data.formulas ?? {}

    if (isNil(formulas)) return {}

    const links = object.data.links ?? []

    const categories = Object.keys(formulas ?? {}) as (keyof IGenericFeatureFormulas)[]
    for (const category of categories) {
      const formulaIndex = formulas[category]
      if (!formulaIndex) continue

      for (const [key, formulas] of Object.entries(formulaIndex)) {
        if (formulas.length === 0) continue

        links.push(`formulas.${category}.${key}`)
      }
    }

    if (links.length === 0) return {}
    return { links: PUSH(`links`, uniq(links)) }
  }),
  derivation([`container`, `weapons:compiled`, `formulas`], [`links`], function (_, __, { object }: { object: GenericFeature }) {
    const { container, weapons, formulas } = object.data

    // if (object.data.name === `Light Cloak`) debugger
    if (container || ![`advantage`, `equipment`].some(type => object.type.compare(type)) || (isNil(weapons) && isNil(formulas))) return {}

    // SOURCES of defenses are:
    //    A. features with a defense property (or with at least a weapon with a defense property)
    //    B. features with a defense formula property (<defense>at, usually only if GCA)
    //    C. features linked with a defense-capable skill
    //    D. VTT_NOTES tag

    const defenses = [`block`, `dodge`, `parry`] as const
    let links = [] as string[]

    // A (technically weapons will never change after source is first-compiled)
    for (const defense of defenses) {
      for (const weapon of weapons ?? []) {
        if (weapon.data[defense] && !links.includes(`activeDefense.${defense}`)) links.push(`activeDefense.${defense}`)
      }
    }

    // B (technically formulas will never change after source is first-compiled)
    for (const defense of defenses) {
      if (formulas?.activeDefense?.[defense]?.length && !links.includes(`activeDefense.${defense}`)) links.push(`activeDefense.${defense}`)
    }

    links = []
    // C (technically a skill defense capability will never change after source is first-compiled)
    //    determine skills related to feature
    const skills = [] as GCA.Entry[]

    //    from weapons
    for (const weapon of weapons ?? []) {
      const definitions = weapon.data.defaults as any as ILevelDefinition[]
      if (!definitions) {
        LOGGER.error(`gcs`, `Weapon entry`, `"${weapon.data.name}"`, `for`, `"${weapon.parent?.data.name}"`, `lacks default definitions.`, [
          `color: #826835;`,
          `color: rgba(130, 104, 53, 60%); font-style: italic;`,
          `color: black; font-style: regular; font-weight: bold`,
          ``,
        ])
        continue
      }

      for (const definition of definitions) {
        const { variablesByType } = setupCheck(definition)

        const skillVariables = variablesByType[`skill`] ?? []
        if (skillVariables.length === 0) continue

        const indexes = skillVariables.map(target => target.value).flat() as number[]
        const entries = indexes.map(index => GCA.entries[index])
        skills.push(...entries.filter(entry => !isNil(entry)))
      }
    }

    // TODO: Implement for powers
    // TODO: Implement taking modifiers (limitations and enhancements) into account

    for (const skill of skills) {
      // check if skill is defense-capable (has some defense formula)
      for (const defense of defenses) {
        if (!isNil(skill[`${defense}at`])) links.push(`activeDefense.${defense}`)
      }
    }

    // D
    // TODO: Implement for VTT_NOTES tags (mind shield would require it, for example)

    if (links.length === 0) return {}
    return { links: PUSH(`links`, uniq(links)) }
  }),
  // #endregion
]

GenericFeaturePipeline.name = `GenericFeaturePipeline`
GenericFeaturePipeline.conflict = {
  // type: function genericConflictResolution(key: string, migrations: MigrationValue<Type>[]) {
  //   const types = flatten(Object.values(migrations)).map(migration => migration.value)
  //   const nonGeneric = types.filter(type => !type.isGeneric)
  //   if (nonGeneric.length === 1) return nonGeneric[0]
  //   else {
  //     const trees = Type.uniq(nonGeneric)
  //     if (trees.length === 1) return nonGeneric[0]
  //     else {
  //       // ERROR: Unimplemented multiple trees conflict resolution
  //       debugger
  //     }
  //   }

  //   return undefined
  // },
  specialization: function genericConflictResolution(migrations: MigrationValue<any>[], { gca }) {
    if (gca.specializationRequired) {
      const gcsMigrations = migrations.filter(migration => flatten(migration._meta.origin.map(origin => origin.source)).includes(`gcs`))
      if (gcsMigrations.length === 1) return { specialization: gcsMigrations[0] }
      else {
        // ERROR: Unimplemented, too many migrations to decide
        debugger
      }
    } else {
      // ERROR: Unimplemented conflict between two different non-required specializations
      debugger
    }
  },
}

GenericFeaturePipeline.post = function postGeneric(data) {
  const MDO = {} as MigrationDataObject<any>

  if (data.has(`tl`)) {
    const tl = data.get(`tl`)
    if (tl?.required && isNilOrEmpty(tl?.level)) {
      if (!isNil(this.tl)) MDO.tl = MERGE(`tl`, { level: this.tl })
    }
  }

  return MDO
}
