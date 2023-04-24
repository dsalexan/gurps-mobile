import { flatten, flattenDeep, get, isArray, isNil, isNumber, isString, orderBy, set, uniq } from "lodash"
import { FeatureBaseContextSpecs } from "../base"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../../context"
import { FastDisplayable, IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "../interfaces"
import TagBuilder, { PartialTag } from "../../tag"
import { IFeatureValue } from "../interfaces"
import ContextManager from "../../manager"
import { push } from "../../../../../../december/utils/lodash"
import SpellFeature from "../../../../actor/feature/spell"

export interface SpellFeatureContextSpecs extends FeatureBaseContextSpecs {
  feature: SpellFeature
  //
  showDefaults?: boolean
  difficulty?: boolean
}

export default class SpellFeatureContextTemplate extends BaseContextTemplate {
  static pre(context: IContext, specs: ContextSpecs, manager: ContextManager): IContext {
    super.pre(context, specs, manager)

    context._template.push(`spell-feature`)

    return context
  }

  /**
   * Build main data-variant of feature
   */
  static main(variants: IFeatureDataVariant[], specs: SpellFeatureContextSpecs, manager: ContextManager): IFeatureDataVariant[] {
    const feature = getSpec(specs, `feature`)
    let variant = variants[0] ?? { classes: [] }

    const tags = new TagBuilder(variant.tags)

    // VALUE
    if (variant.value === undefined) variant.value = {}
    // @ts-ignore
    variant.value.secondary_label = `CASTING<br/>`

    // TAGS
    if (feature.data.spellClass)
      if (feature.data.spellClass) {
        tags.type(`type`).update(tag => {
          tag.children.push({
            classes: [`box`],
            label: feature.data.spellClass,
          })

          return tag
        })
      }

    if (feature.data.powerSource)
      tags.type(`type`).add({
        classes: [`box`],
        children: { label: feature.data.powerSource },
      })

    tags.type(`feature`).update(tag => {
      if (tag.children[0].classes === undefined) tag.children[0].classes = []
      tag.children[0].classes.push(`interactible`)
      return tag
    })

    // STATS
    variant.stats = [
      {
        label: `Cost`,
        value: feature.data.cost ?? `—`,
      },
      {
        label: `Maintain`,
        value: feature.data.maintain ?? `—`,
      },
      {
        label: `Casting Time`,
        value: feature.data.castingTime ?? `—`,
      },
      {
        label: `Duration`,
        value: feature.data.duration ?? `—`,
      },
    ]

    variant.tags = tags.tags
    return [variant]
  }
}
