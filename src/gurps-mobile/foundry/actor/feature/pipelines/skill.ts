import { flatten, isArray, isNil, sum, uniq } from "lodash"
import { GenericSource, IDerivationPipeline, derivation, proxy } from "."
import { isNilOrEmpty } from "../../../../../december/utils/lodash"
import { ILevel, ILevelDefinition, parseLevelDefinition } from "../../../../../gurps-extension/utils/level"
import { FALLBACK, MERGE, MigrationDataObject, MigrationValue, OVERWRITE, PUSH, WRITE } from "../../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "./generic"
import { IUsableFeatureData } from "./usable"
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

export interface ISkillFeatureData extends IGenericFeatureData, IUsableFeatureData {
  attribute: string
  difficulty: string
  points: number
  training: `trained` | `untrained` | `unknown`
  defaultFrom: object[]
  form: false | `art` | `sport`
  //
  defaults?: ILevelDefinition[]
  proficiencyModifier: number
  actorModifier: number
  attributeBasedLevel: ILevel | null
  level: ILevel | null
  //
  defenses?: (`parry` | `block` | `dodge`)[] // indicates that the skill is defense-capable for these defenses
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
        const attribute = match[1].toUpperCase()
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
    const attribute = type.split(`/`)[0].toUpperCase()
    const difficulty = type.split(`/`)[1]

    return { attribute, difficulty }
  }),
  derivation.gca(`default`, [`defaults`, `training`], gca => {
    // TODO: Deal with dynamic values

    if (!isArray(gca.default)) return { training: FALLBACK(`training`, `unknown`) }

    const definitions = gca.default.map(_default => parseLevelDefinition(_default))

    return { defaults: definitions, training: FALLBACK(`training`, definitions.length > 0 ? `untrained` : `unknown`) }
  }),
  // #endregion
  // #region DATA
  derivation([`gcs`], [`training`, `defenses`], function ({ gcs }, __, { object }) {
    let defenses = [] as (`parry` | `block` | `dodge`)[]

    const block = [/shield/i, /cloak/i]
    for (const pattern of block) {
      if (pattern.test(gcs.name)) defenses.push(`block`)
    }

    const parry = [/karate/i, /boxing/i, /brawling/i, /judo/i, /wrestling/i, /sumo wrestling/i]
    for (const pattern of parry) {
      if (pattern.test(gcs.name)) defenses.push(`parry`)
    }

    if (gcs.tags?.some(tag => tag.match(/melee combat/i)) && gcs.tags?.some(tag => tag.match(/weapon/i))) {
      if (!defenses.includes(`parry`)) defenses.push(`parry`)
    }

    if (defenses.length === 0) defenses = undefined as any
    return { training: FALLBACK(`training`, `untrained`), defenses }
  }),
  derivation([`formulas`], [`defenses`], function (_, __, { object }) {
    const activeDefenseFormulas = object.data.formulas?.activeDefense ?? {}
    const defenses = Object.keys(activeDefenseFormulas).filter(defense => activeDefenseFormulas[defense]?.length > 0)

    if (defenses.length === 0) return {}

    return { defenses: WRITE(`defenses`, defenses) }
  }),
  derivation([`points`, `difficulty`, `attribute`, `training`], [`proficiencyModifier`], function (_, __, { object }) {
    const skill = object as SkillFeature
    // if (object.id === `fa49c99f-d754-4f4a-8322-e14db72c32d1`) debugger
    const modifier = object.data.training !== `trained` ? 0 : skill.calcProficiencyModifier()

    return { proficiencyModifier: OVERWRITE(`proficiencyModifier`, modifier) }
  }),
  derivation([`actor.components.skill_bonus:pool`], [`actorModifier`], function (_, __, { object }) {
    const actor = object.actor

    // if (object.id === `6e9287a7-221b-45f0-9256-a253498c3085`) debugger

    if (isNil(actor) || isNil(actor.cache.components)) return {}

    const skill = object as SkillFeature
    const modifier = skill.calcActorModifier(actor)

    return { actorModifier: OVERWRITE(`actorModifier`, modifier) }
  }),
  derivation([`actorModifier`, `proficiencyModifier`, `attribute`, `training`, `defaults`], [`attributeBasedLevel`], function (_, __, { object }) {
    const actor = object.actor
    const { actorModifier, proficiencyModifier } = object.data

    if (isNil(actor) || actorModifier == undefined || proficiencyModifier === undefined) return {}

    const skill = object as SkillFeature
    const level = skill.calcAttributeBasedLevel({ modifier: true })

    return { attributeBasedLevel: OVERWRITE(`attributeBasedLevel`, level) }
  }),
  derivation([`attributeBasedLevel:pool`, `defaults`, `training`], [`level`], function (_, __, { object }) {
    const actor = object.actor
    const { attributeBasedLevel, container, training } = object.data

    if (isNil(actor) || attributeBasedLevel === undefined || container) return {}

    const skill = object as SkillFeature
    const level = skill.calcLevel()

    return { level: OVERWRITE(`level`, level) }
  }),
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
