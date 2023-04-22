import { flatten, isNil, sum, uniq } from "lodash"
import { GenericSource, IDerivationPipeline, derivation, proxy } from "."
import { isNilOrEmpty } from "../../../../../december/utils/lodash"
import { ILevel, ILevelDefinition, parseLevelDefinition } from "../../../../../gurps-extension/utils/level"
import { MigrationDataObject, MigrationValue, OVERWRITE, PUSH, WRITE } from "../../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "./generic"
import { IWeaponizableFeatureData } from "./weaponizable"
import { IComponentDefinition, compareComponent } from "../../../../../gurps-extension/utils/component"
import LOGGER from "../../../../logger"
import GenericFeature from "../generic"
import SkillFeature from "../skill"

export interface SkillManualSource extends GenericSource {
  tl?: number
  training?: `trained` | `untrained` | `unknown`
  ignoreSpecialization?: boolean
  proxy?: boolean
}

export interface ISkillFeatureData extends IGenericFeatureData, IWeaponizableFeatureData {
  attribute: string
  difficulty: string
  points: number
  training: `trained` | `untrained` | `unknown`
  defaultFrom: object[]
  proxy?: boolean
  form: false | `art` | `sport`
  //
  proficiencyModifier: number
  actorModifier: number
  attributeBasedLevel: ILevel | null
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
  derivation.gca(`type`, [`attribute`, `difficulty`], ({ type }) => {
    if (isNilOrEmpty(type)) return {}
    const attribute = type.split(`/`)[0]
    const difficulty = type.split(`/`)[1]

    return { attribute, difficulty }
  }),
  derivation.gca(`default`, `defaults`, gca => ({ defaults: gca.default?.map(_default => parseLevelDefinition(_default)) ?? undefined })),
  // #endregion
  // #region DATA
  // derivation([`points`, `difficulty`, `training`], [`proficiencyModifier`], function (_, __, { object }) {
  //   const skill = object as SkillFeature
  //   const modifier = skill.calcProficiencyModifier()

  //   return { proficiencyModifier: OVERWRITE(`proficiencyModifier`, modifier) }
  // }),
  // derivation([`actor.components:pool`], [`actorModifier`], function (_, __, { object }) {
  //   const actor = object.actor

  //   debugger
  //   if (isNil(actor)) return {}

  //   const skill = object as SkillFeature
  //   const modifier = skill.calcActorModifier()

  //   return { actorModifier: OVERWRITE(`actorModifier`, modifier) }
  // }),
  // // TODO: add to target actor attributes
  // derivation([`integration`, `points`, `training`], [`attributeBasedLevel`], function (_, __, { object }) {
  //   const actor = object.actor
  //   const { defaults, difficulty, name, points, training } = object.data

  //   if (isNil(actor)) return {}

  //   // TODO: Only call AFTER components targeting this skill are set in actor
  //   //    probably create another intermediary value ("actorBonus") and use that as target here

  //   const skill = object as SkillFeature
  //   const level = skill.calcAttributeBasedLevel({ modifier: true })

  //   return { attributeBasedLevel: OVERWRITE(`attributeBasedLevel`, level) }
  // }),
  // // TODO: add some sort of "actor cached trained skills" to target
  // derivation([`attributeBasedLevel`, `defaults`, `training`], [`level`], function (_, __, { object }) {
  //   const actor = object.actor
  //   const { defaults, difficulty, name, points, training } = object.data

  //   if (isNil(actor)) return {}

  //   // TODO: Only call AFTER components targeting this skill are set in actor

  //   const skill = object as SkillFeature
  //   const level = skill.calcLevel()

  //   return { level: OVERWRITE(`level`, level) }
  // }),
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

  if (data.has(`name`)) {
    const name = data.get(`name`)

    if (name.match(/\w art(?!\w)/i)) MDO.form = WRITE(`form`, `art`)
    else if (name.match(/\w sport(?!\w)/i)) MDO.form = WRITE(`form`, `sport`)
    else MDO.form = WRITE(`form`, false)
  }

  if (data.has(`training`)) {
    const training = data.get(`training`)

    if (training === `untrained`) MDO.group = OVERWRITE(`group`, `Untrained Skills`)
    else if (training === `unknown`) MDO.group = OVERWRITE(`group`, `Unknown Skills`)
  }

  return MDO
}
