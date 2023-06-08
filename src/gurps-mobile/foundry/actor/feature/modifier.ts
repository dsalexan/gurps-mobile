import { get, has, isArray, isEmpty, isNil, isString, uniq } from "lodash"
import Feature, { FeatureTemplate } from "."
import { ToggableValue } from "../../../core/feature/base"
import LOGGER from "../../../logger"
import { ModifierFeaturePipeline, IModifierFeatureData } from "./pipelines/modifier"
import { Utils } from "../../../core/feature"
import { GurpsMobileActor } from "../actor"
import FeatureWeaponsDataContextTemplate from "../../actor-sheet/context/feature/usable"
import { isNilOrEmpty } from "../../../../december/utils/lodash"
import { GURPS4th } from "../../../../gurps-extension/types/gurps4th"
import GenericFeature from "./generic"
import { GenericSource } from "./pipelines"

export default class ModifierFeature extends GenericFeature {
  declare data: IModifierFeatureData

  constructor(id: string, key: string | number | (string | number)[], parent?: Feature<any, any>, template?: FeatureTemplate) {
    super(id, key, parent, template)
    this.addPipeline(ModifierFeaturePipeline)
  }

  _integrate(actor: GurpsMobileActor) {
    super._integrate(actor)

    return this
  }

  prepareQueryGCA() {
    const parameters = super.prepareQueryGCA()

    if (this.parent) {
      if (isNilOrEmpty(this.parent.data.name)) debugger

      const local = { name: this.parent.data.name, specializedName: this.parent.specializedName }
      const gca = (
        this.parent.sources.gca
          ? {
              name: this.parent.sources.gca.name,
              specializedName: Utils.specializedName(this.parent.sources.gca),
              specializationRequired: this.parent.sources.gca.specializationRequired,
              basedOn: this.parent.sources.gca._fromBasedOn,
            }
          : null
      )!

      // ERROR: Untested for GCAless parent
      if (gca === null) {
        LOGGER.get(`gca`).warn(
          `prepareQueryGCA`,
          `Modifier's parent has no GCA source (it could affect GCA query for modifier)`,
          `${this.specializedName}:${this.id}`,
          `@`,
          `${this.parent.specializedName}:${this.parent.id}`,
          this,
          local,
          [
            `color: #826835;`,
            `color: rgba(130, 104, 53, 60%); font-style: italic;`,
            `color: black; font-style: regular; font-weight: bold`,
            `color: rgba(130, 104, 53, 60%); font-style: italic;`,
            `color: black; font-style: regular; font-weight: bold`,
            ``,
          ],
        )
      } else {
        // ERROR: Untested for differing local vs GCA names
        const differingNames = local.name !== gca.name
        const differingSpecializedNames = local.specializedName !== gca.specializedName
        // if (differingNames || (differingSpecializedNames && !gca.specializationRequired)) debugger
        // Seems to me that specialization can vary wildly between GCS and GCA, this comparasion doenst help me
        if (differingNames && !gca?.basedOn) debugger

        let name = local.name
        if (gca.basedOn) name = gca.name

        // TODO: Find out if i should use specialized name instead
        parameters.groups = [name]

        if (name.match(/reputation/i)) {
          if (this.parent.type.compare(`disadvantage`)) parameters.groups = [`${name} Disadvantage`]
          else if (this.parent.type.compare(`advantage`)) parameters.groups = [`${name} Advantage`]
        }
      }
    }

    // TODO: Remove this, was hardcoded while testing
    if (parameters.specializedName?.match(/\(Resist Roll\)/i)) {
      parameters.specializedName = parameters.specializedName.replaceAll(/\(Resist Roll\)/gi, `(Target Roll)`)
    }

    return parameters
  }
}
