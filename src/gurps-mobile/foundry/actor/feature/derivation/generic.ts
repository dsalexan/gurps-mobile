import { flatten, flattenDeep, get, isArray, isEmpty, isNil } from "lodash"
import { derivation, proxy } from "."
import { isNilOrEmpty, push } from "../../../../../december/utils/lodash"
import { GCS } from "../../../../../gurps-extension/types/gcs"
import { FastMigrationDataObject, MERGE, MigrationValue, OVERWRITE, PUSH, WRITE } from "../../../../core/feature/compilation/migration"
import { parseComponentDefinition } from "../../../../../gurps-extension/utils/component"
import { GCA } from "../../../../core/gca/types"
import { CompilationContext } from "../../../../core/feature/compilation/template"
import { FeatureSources } from ".."

export const GenericDerivations = [
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

    return { tl }
  }),
  proxy.gcs(`label`),
  derivation.gcs(`notes`, `notes`, ({ notes }) => ({ notes: flattenDeep(notes ?? []) })),
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
  derivation.gcs(`condition`, `condition`, ({ condition }) => ({ condition: flattenDeep(condition ?? []) })),
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
  derivation.gca(`page`, `reference`, ({ page }) => ({ reference: PUSH(`reference`, flattenDeep(page ?? [])) })),
  derivation.gca(`cat`, `categories`, ({ cat }) => ({ categories: flattenDeep(cat ?? []) })),
  derivation.gca(`itemnotes`, `notes`, ({ itemnotes }) => ({ notes: PUSH(`notes`, flattenDeep(itemnotes ?? [])) })),
  derivation.gca([`blockat`, `parryat`], [`activeDefense`], ({ blockat, parryat }) => {
    const activeDefense = {} as Record<`block` | `parry` | `dodge`, string[]>

    if (blockat && !isEmpty(blockat)) push(activeDefense, `block`, blockat)
    if (parryat && !isEmpty(parryat)) push(activeDefense, `parry`, parryat)

    if (Object.keys(activeDefense).length === 0) return {}
    return { activeDefense }
  }),
  // #endregion
]

GenericDerivations.conflict = function genericConflictResolution(
  this: CompilationContext,
  key: string,
  migrations: MigrationValue<any>[],
  sources: FeatureSources<any>,
): FastMigrationDataObject<unknown> {
  if (key === `type`) {
    const types = flatten(Object.values(migrations)).map(migration => migration.value) as Type[]
    const nonGeneric = types.filter(type => !type.isGeneric)
    if (nonGeneric.length === 1) MDO[key] = nonGeneric[0]
    else {
      const trees = Type.uniq(nonGeneric)
      if (trees.length === 1) MDO[key] = nonGeneric[0]
      else {
        // ERROR: Unimplemented multiple trees conflict resolution
        debugger
      }
    }
  } else if (key === `specialization`) {
    if (sources.gca.specializationRequired) {
      const gcsMigrations = migrations.filter(migration => isOrigin(migration._meta.origin, [`gcs`]))
      if (gcsMigrations.length === 1) MDO[key] = gcsMigrations[0]
      else {
        // ERROR: Unimplemented, too many migrations to decide
        debugger
      }
    } else {
      // ERROR: Unimplemented conflict between two different non-required specializations
      debugger
    }
  }

  return MDO
}
