/* eslint-disable no-debugger */
import { flatten, flattenDeep, get, isArray, isEmpty, isNil, set, uniq } from "lodash"
import { IDerivation, IDerivationPipeline, derivation, proxy } from "."
import { isNilOrEmpty, push } from "../../../../../december/utils/lodash"
import { GCS } from "../../../../../gurps-extension/types/gcs"
import { MigrationDataObject, MERGE, MigrationValue, OVERWRITE, PUSH, WRITE, isOrigin } from "../../../../core/feature/compilation/migration"
import { IComponentDefinition, parseComponentDefinition } from "../../../../../gurps-extension/utils/component"
import { GCA } from "../../../../core/gca/types"
import { IFeatureData } from ".."
import { Type } from "../../../../core/feature"
import { FeatureState } from "../../../../core/feature/utils"
import { ILevel, ILevelDefinition } from "../../../../../gurps-extension/utils/level"
import { GURPS4th } from "../../../../../gurps-extension/types/gurps4th"

export interface IGenericFeatureData extends IFeatureData {
  name: string
  specialization?: string
  specializationRequired?: boolean
  container: boolean

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

  activeDefense?: Record<`block` | `dodge` | `parry`, string[]>

  level?: number
  defaults?: ILevelDefinition[]
  calcLevel(attribute: GURPS4th.AttributesAndCharacteristics): ILevel | null

  // relationships
  group?: string // string to group features by
  links: string[] // strings to establish relationships between features
  components: IComponentDefinition[] // basically modifiers to other features or aspects of the actor
}

export const GenericFeaturePipeline: IDerivationPipeline<IGenericFeatureData> = [
  // #region GCS
  derivation.gcs(`type`, `container`, function ({ type }) {
    return { container: type?.match(/_container$/) ? OVERWRITE(`container`, true) : WRITE(`container`, false) }
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
  derivation.gcs(`features`, `components`, ({ features }) => ({ components: (features ?? []).map(f => parseComponentDefinition(f as any)) })),
  // #endregion
  // #region GCA
  derivation.gca([`name`, `nameext`], [`name`, `specialization`], function ({ name, nameext }) {
    this.humanId = this.humanId ?? name

    return { name, specialization: nameext?.replaceAll(/[\[\]]/g, ``) }
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
  derivation.gca([`blockat`, `parryat`], [`activeDefense`], ({ blockat, parryat }) => {
    const activeDefense = {} as Record<`block` | `parry` | `dodge`, string[]>

    if (blockat && !isEmpty(blockat)) push(activeDefense, `block`, blockat)
    if (parryat && !isEmpty(parryat)) push(activeDefense, `parry`, parryat)

    if (Object.keys(activeDefense).length === 0) return {}
    return { activeDefense }
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

GenericFeaturePipeline.post = function postGeneric({ data }) {
  const MDO = {} as MigrationDataObject<any>

  if (data.tl?.required && isNilOrEmpty(data.tl)) {
    if (isNil(this.tl)) debugger
    set(data, `tl.level`, this.tl)
  }

  return MDO
}
