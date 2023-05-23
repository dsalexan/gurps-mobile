import { flattenDeep, get, isArray, isNil, isNumber, isString, set } from "lodash"
import { FeatureBaseContextSpecs } from "../base"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../../context"
import { IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "../interfaces"
import TagBuilder from "../../tag"
import { IFeatureValue } from "../interfaces"
import ContextManager from "../../manager"
import GenericFeature from "../../../../actor/feature/generic"
import { FeatureState } from "../../../../../core/feature/utils"

export interface MoveFeatureContextSpecs extends FeatureBaseContextSpecs {
  feature: GenericFeature
  //
  links: (id: string) => string[]
}

export default class MoveFeatureContextTemplate extends BaseContextTemplate {
  static pre(context: IContext, specs: ContextSpecs, manager: ContextManager): IContext {
    super.pre(context, specs, manager)

    context._template.push(`move-feature`)

    return context
  }

  /**
   * Build main data-variant of feature
   */
  static main(variants: IFeatureDataVariant[], specs: MoveFeatureContextSpecs, manager: ContextManager): IFeatureDataVariant[] {
    const feature = getSpec(specs, `feature`)
    let variant = variants[0] ?? {}

    const mark = (feature.data.state & FeatureState.HIGHLIGHTED ? `Ruler` : undefined) as string | undefined
    const classes = [
      ...(variant.classes ?? []), //
      !!mark && `marked`,
    ] as string[]

    // VALUE
    let value: IFeatureValue = { value: feature.data.value }

    // LINKS
    const links = (feature.data.links ?? []).filter(link => !link.match(/^defenses\./))

    // COMPOUNDING TAGS
    const tags = new TagBuilder(variant.tags ?? [])
    tags.add(
      ...links.map(label => ({
        type: `link`,
        children: [
          {
            label,
          },
        ],
      })),
    )

    if (tags.tags.length > 0) value.asterisk = true

    variant = {
      ...(variant ?? {}),
      classes,
      //
      mark,
      //
      tags: tags.tags,
    }

    if (!specs.usage) variant.value = value

    return [variant]
  }

  static base(context: IFeatureContext, specs: MoveFeatureContextSpecs, manager: ContextManager): IFeatureContext {
    super.base(context, specs, manager)

    const children = get(context, `children`) ?? {}

    // COMPOUNDING CLASSES
    // const classes = [...(context.classes ?? []), `set-move-default`]

    const main = this.main(children.main?.[0]?.variants ?? [], specs, manager)
    if (main) set(children, `main.0.variants`, main)

    context = {
      ...context,
      //
      children,
      //
      // classes: [...new Set(classes)],
      //
    }

    return context
  }
}
