import { flatten, isNil, uniq } from "lodash"
import { GenericSource, IDerivationPipeline, derivation, proxy } from "."
import { isNilOrEmpty } from "../../../../../december/utils/lodash"
import { ILevelDefinition, parseLevelDefinition } from "../../../../../gurps-extension/utils/level"
import { MigrationDataObject, MigrationValue, OVERWRITE, PUSH, WRITE } from "../../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "./generic"
import { IWeaponizableFeatureData } from "./weaponizable"

export interface SkillManualSource extends GenericSource {
  training?: `trained` | `untrained` | `unknown`
  ignoreSpecialization?: boolean
}

export interface ISkillFeatureData extends IGenericFeatureData, IWeaponizableFeatureData {
  attribute: string
  difficulty: string
  points: number
  training: `trained` | `untrained` | `unknown`
  defaultFrom: object[]
  proxy?: boolean
  form: false | `art` | `sport`
}

export const SkillFeaturePipeline: IDerivationPipeline<ISkillFeatureData> = [
  // #region MANUAL
  derivation.manual(`training`, `training`, ({ training }) => ({ training: training !== undefined ? OVERWRITE(`training`, training) : undefined })),
  derivation.manual(`ignoreSpecialization`, `specialization`, ({ ignoreSpecialization }) => ({
    specialization: ignoreSpecialization ? OVERWRITE(`specialization`, undefined) : undefined,
  })),
  // #endregion
  // #region GCS
  derivation.gcs(`difficulty`, [`attribute`, `difficulty`], gcs => {
    if (gcs.difficulty) {
      const _difficulty = /(\w{1,4})\/(\w+)/i
      const match = gcs.difficulty.toUpperCase().match(_difficulty)

      if (match) {
        const attribute = match[1]
        const difficulty = match[2]

        return { attribute, difficulty }
      }
    }

    return {}
  }),
  derivation.gcs(`points`, [`points`, `training`], ({ points }) => {
    if (!isNil(points)) return { points, training: points > 0 ? `trained` : `unknown` }
    return {}
  }),
  // #endregion
  // #region GCA
  derivation.gcs(`type`, [`attribute`, `difficulty`], ({ type }) => {
    if (isNilOrEmpty(type)) return {}
    const attribute = type.split(`/`)[0]
    const difficulty = type.split(`/`)[1]

    return { attribute, difficulty }
  }),
  derivation.gca(`default`, `defaults`, gca => ({ defaults: gca.default?.map(_default => parseLevelDefinition(_default)) ?? undefined })),
  // #endregion
]

SkillFeaturePipeline.name = `SkillFeaturePipeline`
SkillFeaturePipeline.conflict = {
  attribute: function genericConflictResolution(migrations: MigrationValue<any>[]) {
    const attributes = flatten(Object.values(migrations)).map(migration => (migration.value as string).toUpperCase())
    const uniqueAttributes = uniq(attributes)
    if (uniqueAttributes.length === 1) return { attribute: Object.values(migrations)[0] }
    else {
      // ERROR: Too many different attributes
      // eslint-disable-next-line no-debugger
      debugger
    }
  },
}

SkillFeaturePipeline.post = function postSkill(data) {
  const MDO = {} as MigrationDataObject<any>

  if (data.name) {
    const name = data.name

    if (name.match(/\w art(?!\w)/i)) MDO.form = WRITE(`form`, `art`)
    else if (name.match(/\w sport(?!\w)/i)) MDO.form = WRITE(`form`, `sport`)
    else MDO.form = WRITE(`form`, false)
  }

  if (data.training) {
    const training = data.training

    if (training === `untrained`) MDO.group = OVERWRITE(`group`, `Untrained Skills`)
    else if (training === `unknown`) MDO.group = OVERWRITE(`group`, `Unknown Skills`)
  }

  return MDO
}
