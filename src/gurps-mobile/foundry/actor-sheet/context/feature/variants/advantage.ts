import { flattenDeep, get, isArray, isNil, isNumber, isString, set, uniq } from "lodash"
import { FeatureBaseContextSpecs } from "../base"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../../context"
import { IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "../interfaces"
import TagBuilder from "../../tag"
import { IFeatureValue } from "../interfaces"
import ContextManager from "../../manager"
import AdvantageFeature from "../../../../actor/feature/advantage"

export interface AdvantageFeatureContextSpecs extends FeatureBaseContextSpecs {
  feature: AdvantageFeature
  //
  links: (id: string) => string[]
}

export default class AdvantageFeatureContextTemplate extends BaseContextTemplate {
  static pre(context: IContext, specs: ContextSpecs, manager: ContextManager): IContext {
    super.pre(context, specs, manager)

    context._template.push(`advantage-feature`)

    return context
  }

  /**
   * Build main data-variant of feature
   */
  static main(variants: IFeatureDataVariant[], specs: AdvantageFeatureContextSpecs, manager: ContextManager): IFeatureDataVariant[] {
    const feature = getSpec(specs, `feature`)
    let variant = variants[0] ?? {}

    // LINKS
    const links = feature.links ?? []

    // COMPOUNDING TAGS
    const tags = new TagBuilder(variant.tags ?? [])
    tags.add(...links)

    // if attached roll is a self control roll
    if (feature.rolls) {
      for (const roll of feature.rolls) {
        if (roll?.self_control) {
          variant.value = {
            label: `WILL`,
            secondary_label: `CR`,
            value: variant.value,
          }

          tags.at(1).add({
            classes: `box interactible`,
            label: `Self-Control Roll`,
          })

          break
        }
      }
    }

    variant.tags = tags.tags

    return [variant]
  }

  static base(context: IFeatureContext, specs: AdvantageFeatureContextSpecs, manager: ContextManager): IFeatureContext {
    super.base(context, specs, manager)

    const children = get(context, `children`) ?? {}

    // COMPOUNDING CLASSES
    const classes = [...(context.classes ?? []), `inline-tags`, `top-marked`]

    const main = this.main(children.main?.[0]?.variants ?? [], specs, manager)
    if (main) set(children, `main.0.variants`, main)

    context = {
      ...context,
      //
      children,
      //
      classes: uniq(classes),
      //
    }

    return context
  }
}
