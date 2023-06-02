import { cloneDeep, groupBy, has, indexOf, isArray, isEmpty, isNil, isString, orderBy, uniq } from "lodash"
import { FeatureSources, GenericSource, IDerivationPipeline, derivation, proxy } from "."
import Feature, { IFeatureData } from ".."
import { FALLBACK, MigrationDataObject, OVERWRITE, PUSH } from "../../../../core/feature/compilation/migration"
import { FEATURE } from "../../../../core/feature/type"
import { GCS } from "../../../../../gurps-extension/types/gcs"
import { IGenericFeatureData } from "./generic"
import FeatureUsageContextTemplate from "../../../actor-sheet/context/feature/variants/usage"
import LOGGER from "../../../../logger"
import { push } from "../../../../../december/utils/lodash"
import { IFeatureUsageData, IUsageTag } from "./usage/usage"
import FeatureUsage from "../usage"
import GenericFeature from "../generic"
import SkillFeature from "../skill"
import { allowedSkillVariables, parseLevelDefinition, setupCheck } from "../../../../../gurps-extension/utils/level"
import { FeatureMeleeUsagePipeline } from "./usage/melee"
import { FeatureRangedUsagePipeline } from "./usage/ranged"
import { FeatureDamageUsagePipeline } from "./usage/damage"
import { FeatureDefenseUsagePipeline } from "./usage/defense"
import { GCA as GCATypes } from "../../../../core/gca/types"
import { parseSpecializedName, typeFromGCASection } from "../../../../core/feature/utils"

export const ParentFeaturePipeline: IDerivationPipeline<IGenericFeatureData> = [
  //
  derivation([`gcs:children`, `actor`], [], function derivationGCSChildren(_, __, { object }) {
    const actor = object.actor
    if (!actor) return {}

    const gcs = object.sources.gcs as GCS.Entry
    const children = gcs?.children

    if (!children || children?.length === 0) return {}

    // ERROR: Untested for existing children
    if (object.data.children?.length > 0) debugger

    const features = object.factory
      .buildCollection(`gcs`, children as GCS.Entry[], object, {
        actor,
        path: object.path ?? undefined,
      })
      .loadFromGCAOn(`compile:gcs`, true)
      .integrateOn(`loadFromGCA`, actor)

    const ids = features.items.map(feature => feature.id)

    return { children: OVERWRITE(`children`, ids) }
  }),
  derivation([`gca:adds`, `actor`], [`metatrait`], function derivationGCAAdds(_, __, { object }) {
    const actor = object.actor
    if (!actor) return {}

    const gca = object.sources.gca as GCATypes.Entry
    const adds = gca?.adds

    if (!adds || adds?.length === 0) return {}

    // ERROR: Untested for existing children
    if (object.data.children?.length > 0) debugger

    // ERROR: Unimplemented
    if (!isArray(adds)) debugger

    // TODO: Make dis validation inside GCA parsing
    const adds_ = adds.map(string => {
      if (isString(string)) return string
      if (isArray(string)) {
        // ERROR: Unimplemented
        if (string.length > 2) debugger
        if (string.length === 0) debugger

        if (string.length === 1) return string[0]
        return `${string[0]}(${string[1]})`
      }

      // ERROR: Unimplemented
      debugger
      return ``
    }) as string[]

    const entries = [] as GCATypes.Entry[]
    for (const string of adds_) {
      const colon = string.split(`:`)

      // ERROR: Unimplemented for unknown pattren
      if (colon.length !== 2) debugger

      const [prefix, fullName] = colon

      const section = {
        ST: `ATTRIBUTES`,
        LA: `LANGUAGES`,
        CU: `CULTURES`,
        AD: `ADVANTAGES`,
        PE: `PERKS`,
        FE: `FEATURES`,
        DI: `DISADVANTAGES`,
        QU: `QUIRKS`,
        SK: `SKILLS`,
        SP: `SPELLS`,
        TE: `TEMPLATES`,
        EQ: `EQUIPMENT`,
        GR: `GROUPS`,
        LI: `LISTS`,
      }[prefix] as GCATypes.Section

      const type = typeFromGCASection(section)!

      // ERROR: Section conversion failed, UNIMPLEMENTED
      if (!type) debugger

      const { name, specialization } = parseSpecializedName(fullName)

      const entry = GCA.query({ name, specializedName: isNil(specialization) ? undefined : fullName, type: type.value })

      // ERROR: Unimplemented for no match
      if (!entry) debugger
      if (isArray(entry)) debugger

      entries.push(entry!)
    }

    const features = object.factory
      .buildCollection(`gca`, entries, object, { actor, path: `add` }) //
      .addSource(`manual`, { metatrait: true })
      .integrateOn(`compile:gca`, actor)

    const ids = features.items.map(feature => feature.id)

    if (ids.length === 0) return {}
    return { children: OVERWRITE(`children`, ids), metatrait: OVERWRITE(`metatrait`, true) }
  }),
]

ParentFeaturePipeline.name = `ParentFeaturePipeline`
// ParentFeaturePipeline.post = function postUsable(data, object) {
//   const MDO = {} as MigrationDataObject<any>

//   if (has(data, `usages`) && data.usages.length > 0) {
//     const factory = object.factory
//     const usages = [] as Feature<any, never>[]

//     for (let index = 0; index < data.usages.length ?? 0; index++) {
//       const usage = data.usages[index] as any as GCS.Entry

//       debugger
//       const feature = factory
//         .build(`usage`, usage.id, index, object, {
//           context: { templates: [FeatureUsageContextTemplate] },
//         })
//         .addSource(`gcs`, usage)

//       usages.push(feature)
//     }

//     MDO.usages = OVERWRITE(`usages`, usages)
//   }

//   return MDO
// }
