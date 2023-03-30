import { flatten, flattenDeep, isArray, isNil } from "lodash"
import { derivation, proxy } from "."
import { isNilOrEmpty } from "../../../../../december/utils/lodash"
import { GCS } from "../../../../../gurps-extension/types/gcs"
import { MERGE, OVERWRITE, PUSH, WRITE } from "../../../../core/feature/compilation/migration"
import { parseComponentDefinition } from "../../../../../gurps-extension/utils/component"
import { GCA } from "../../../../core/gca/types"

export const GenericDerivations = [
  //
  derivation.gcs(`type`, `container`, function ({ type }: GCS.Entry) {
    return { container: type?.match(/_container$/) ? OVERWRITE(`container`, true) : WRITE(`container`, false) }
  }),
  derivation.gcs([`name`, `specialization`], [`name`, `specialization`], function ({ name, specialization }: GCS.Entry) {
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
  derivation.gcs(`tech_level`, `tl`, function ({ tech_level }: GCS.Entry) {
    if (isNil(tech_level)) return {}

    const tl = { level: parseInt(tech_level) }

    this.tl = tl.level

    return { tl }
  }),
  proxy.gcs(`label`),
  derivation.gcs(`notes`, `notes`, ({ notes }: GCS.Entry) => ({ notes: flattenDeep(notes ?? []) })),
  derivation.gcs(`vtt_notes`, `meta`, ({ vtt_notes }) => ({ meta: vtt_notes })),
  derivation.gcs(`reference`, `reference`, ({ reference }: GCS.Entry) => ({
    reference: PUSH(
      `reference`,
      flatten(
        flattenDeep(isArray(reference) ? reference : [reference])
          .filter(r => !isNil(r))
          .map(r => r.split(/ *, */g)),
      ).filter(ref => ref !== ``),
    ),
  })),
  derivation.gcs(`tags`, `tags`, function ({ tags }: GCS.Entry) {
    if (!tags) return {}
    return { tags: tags.filter(tag => tag !== this.type.name) }
  }),
  derivation.gcs(`condition`, `condition`, ({ condition }: GCS.Entry) => ({ condition: flattenDeep(condition ?? []) })),
  derivation.gcs(`features`, `components`, ({ features }: GCS.Entry) => ({ components: (features ?? []).map(f => parseComponentDefinition(f as any)) })),
  //
  derivation.gcs([`name`, `nameext`], [`name`, `specialization`], function ({ name, nameext }: GCA.Entry) {
    this.humanId = this.humanId ?? name

    return { name, specialization: nameext?.replaceAll(/[\[\]]/g, ``) }
  }),
  proxy.gca(`specializationRequired`),
  proxy.gca(`label`),
  derivation.gca(`tl`, `tl`, function ({ tl }: GCA.Entry) {
    if (isNil(tl)) return {}

    return {
      tl: MERGE(`tl`, {
        required: true,
        range: tl,
      }),
    }
  }),
  derivation.gca(`page`, `reference`, ({ page }: GCA.Entry) => ({ reference: PUSH(`reference`, flattenDeep(page ?? [])) })),
  derivation.gca(`cat`, `categories`, ({ cat }: GCA.Entry) => ({ categories: flattenDeep(cat ?? []) })),
  derivation.gca(`itemnotes`, `notes`, ({ itemnotes }: GCA.Entry) => ({ notes: PUSH(`notes`, flattenDeep(itemnotes ?? [])) })),
]
