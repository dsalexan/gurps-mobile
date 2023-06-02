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
  buildComponent,
  parseComponentDefinition,
  updateComponentSchema,
} from "../../../../../gurps-extension/utils/component"
import { IFeatureData } from ".."
import { Type } from "../../../../core/feature"
import { FeatureState, parseSpecializedName } from "../../../../core/feature/utils"
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
  meta: string[]
  tags: string[]
  conditional: string[]
  reference: string[]

  formulas?: IGenericFeatureFormulas

  // relationships
  group?: string // string to group features by
  links: string[] // strings to establish relationships between features
  components: IComponentDefinition[] // basically modifiers to other features or aspects of the actor
  placeholder?: boolean // placeholder entry, should be mostly ignored
  basedOn?: { name: string; specialization?: string; fullName: string; type?: string }[] // gca names to search for
  metatrait: boolean
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
      const parsed = parseSpecializedName(name)
      if (parsed.name !== name) {
        name = OVERWRITE(`name`, parsed.name)
        specialization = OVERWRITE(`specialization`, parsed.specialization)
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
  derivation.gcs(`vtt_notes`, `meta`, ({ vtt_notes }) => {
    if (isNil(vtt_notes)) return {}
    return { meta: vtt_notes.split(`;`) }
  }),
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
  derivation.gcs(`container_type`, `metatrait`, function ({ container_type }) {
    if (container_type === `meta-trait` || container_type === `metatrait`) return { metatrait: OVERWRITE(`metatrait`, true) }

    return {}
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
  derivation.gca([`name`, `nameext`, `_fromBasedOn`], [`name`, `specialization`], function ({ name, nameext, _fromBasedOn }) {
    if (_fromBasedOn) return {}

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
  derivation.gca(`gives`, `components`, function ({ gives }, _, { object }) {
    if (!gives) return {}

    if (object.sources.gca._basedOn) debugger

    const gives_ = (isString(gives) ? [gives] : gives) as string[] | string[][]

    const finalComponents = [] as IComponentDefinition[]
    // for (const expression of gives_) {
    for (let i = 0; i < gives_.length; i++) {
      const expression = gives_[i]

      // TODO: Deal with parenthetic expressions inside GCA conversor
      let expression_ = expression as string
      if (isArray(expression)) {
        if (expression[0].match === undefined) debugger

        const firstIsExpression = expression[0].match(/^=/)
        const someFollowUpItemHasFirstCharacterSpace = expression.some((item, index) => expression[index + 1]?.[0] === ` `)

        if (firstIsExpression && someFollowUpItemHasFirstCharacterSpace) {
          // ERROR: Unimplemented
          if (expression.length !== 3) debugger

          expression_ = `${expression[0]}(${expression[1]})${expression.slice(2).join(``)}`
        }
      }

      if (!isString(expression_)) debugger

      if (expression_.match(/=/)) {
        LOGGER.error(`gca`, `gives`, `Not implemented gives → components with "=" expression`, gives, object)
        continue
      }

      const to_ = expression_.split(/ to /i)

      const bonus = parseFloat(to_[0])
      const rawTarget = to_[1]

      const type_ = rawTarget.split(`:`)
      const type = type_.length > 1 ? type_[0] : undefined
      const name = type_.length > 1 ? type_[1] : type_[0]

      const component = buildComponent(type, name, bonus, object.id, i)
      if (!component) continue

      finalComponents.push(component)
    }

    if (finalComponents.length === 0) return {}
    return { components: PUSH(`components`, finalComponents) }
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
  derivation([`container`, `rolls`, `formulas`], [`links`], function (_, __, { object }: { object: GenericFeature }) {
    // usages:compiled is not on derivation because rolls are already derived from it
    const { container, usages, rolls, formulas } = object.data

    return {}

    const actor = object.actor

    // if (object.data.name === `Light Cloak`) debugger
    if (!actor || container || ![`advantage`, `equipment`].some(type => object.type.compare(type)) || (isNil(usages) && isNil(rolls) && isNil(formulas))) return {}

    debugger
    // TODO: How to get skills related to feature? Probably all gonna come from usages (but usages theirselves can come from different places, like weapons and modifiers)

    // SOURCES of defenses are:
    //    A. features with a defense property (or with at least a usage with a defense property)
    //    B. features with a defense formula property (<defense>at, usually only if GCA)
    //    C. features linked with a defense-capable skill
    //    D. VTT_NOTES tag

    const defenses = [`block`, `dodge`, `parry`] as const
    let links = [] as string[]

    // A (technically usages will never change after source is first-compiled)
    for (const defense of defenses) {
      for (const usage of usages ?? []) {
        if (usage.data[defense] && !links.includes(`activeDefense.${defense}`)) links.push(`activeDefense.${defense}`)
      }
    }

    // B (technically formulas will never change after source is first-compiled)
    for (const defense of defenses) {
      if (formulas?.activeDefense?.[defense]?.length && !links.includes(`activeDefense.${defense}`)) links.push(`activeDefense.${defense}`)
    }

    // C (technically a skill defense capability will never change after source is first-compiled)
    //    determine skills related to features is done in a separate derivation
    for (const skill of skills ?? []) {
      const feature = actor.cache?.features?.[skill] as SkillFeature | undefined

      // check if skill is defense-capable (has some defense formula)
      for (const defense of defenses) {
        if (!feature) debugger
        if (feature!.data.defenses?.includes(defense)) links.push(`activeDefense.${defense}`)
      }
    }

    // D
    // TODO: Implement for VTT_NOTES tags (mind shield would require it, for example)

    // TODO: Implement for powers
    // TODO: Implement taking modifiers (limitations and enhancements) into account

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
