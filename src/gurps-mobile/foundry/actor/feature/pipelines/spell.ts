import { flatten, isNil, uniq } from "lodash"
import { GenericSource, IDerivationPipeline, derivation, proxy } from "."
import { isNilOrEmpty } from "../../../../../december/utils/lodash"
import { MigrationDataObject, MigrationValue, OVERWRITE, PUSH, WRITE } from "../../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "./generic"
import { IUsableFeatureData } from "./usable"
import { ISkillFeatureData, SkillManualSource } from "./skill"

export interface SpellManualSource extends SkillManualSource {
  tl?: number
  training?: `trained` | `untrained` | `unknown`
  ignoreSpecialization?: boolean
}

export interface ISpellFeatureData extends ISkillFeatureData {
  spellClass: string
  //
  cost: string
  castingTime: string
  maintain: string
  duration: string
  //
  resist?: string
  powerSource?: string
}

export const SpellFeaturePipeline: IDerivationPipeline<ISpellFeatureData> = [
  // #region GCS
  derivation.gcs(`spell_class`, `spellClass`, ({ spell_class }) => {
    return { spellClass: spell_class }
  }),
  derivation.gcs(`casting_cost`, `cost`, ({ casting_cost }) => {
    return { cost: casting_cost }
  }),
  derivation.gcs(`casting_time`, `castingTime`, ({ casting_time }) => {
    return { castingTime: casting_time }
  }),
  derivation.gcs(`maintenance_cost`, `maintain`, ({ maintenance_cost }) => {
    return { maintain: maintenance_cost }
  }),
  derivation.gcs(`duration`, `duration`, ({ duration }) => {
    return { duration: duration }
  }),
  derivation.gcs(`resist`, `resist`, ({ resist }) => {
    return { resist: resist }
  }),
  derivation.gcs(`power_source`, `powerSource`, ({ power_source }) => {
    return { powerSource: power_source }
  }),
  // #endregion
  // #region DATA
  // #endregion
]

SpellFeaturePipeline.name = `SpellFeaturePipeline`
