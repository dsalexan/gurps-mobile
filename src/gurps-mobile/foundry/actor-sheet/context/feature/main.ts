import { flattenDeep, get, isArray, isNil, isNumber, isString, set } from "lodash"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../context"
import ContextManager from "../manager"
import { Displayable, IFeatureAction, IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "./interfaces"
import BaseFeature from "../../../../core/feature/base"
import { isNilOrEmpty, push } from "../../../../../december/utils/lodash"
import LOGGER from "../../../../logger"
import TagBuilder, { FastTag } from "../tag"
import FeatureBaseContextTemplate from "./base"
import { stateToString } from "../../../../core/feature/utils"

export interface FeatureMainVariantContextSpecs extends ContextSpecs {
  feature: BaseFeature
  //
  hidden: boolean
  pinned: (id: string) => boolean
  collapsed: (id: string) => boolean
  //
  index?: number
  tags?: FastTag[]
  variantClasses?: string[]
}

export default class FeatureMainVariantContextTemplate extends BaseContextTemplate {
  static pre(context: IContext, specs: ContextSpecs, manager: ContextManager): IContext {
    super.pre(context, specs, manager)

    context._template.push(`feature-main`)
    if (context._metadata?.childrenKeys === undefined) set(context, `_metadata.childrenKeys`, [])
    context._metadata?.childrenKeys.push([0, `main`])

    return context
  }

  /**
   * Build main data-variant of feature
   */
  static main(variants: IFeatureDataVariant[], specs: FeatureMainVariantContextSpecs, manager: ContextManager): IFeatureDataVariant[] {
    const feature = getSpec(specs, `feature`)
    let variant = variants[0] ?? {}

    /**
     * properties like "tags", "label", "secondary_label", etc... from root specs always refer to first child featureData
     * (since there is only one most of the time)
     */
    const _tags = getSpec(specs, `tags`, [] as FastTag[])
    const _classes = getSpec(specs, `variantClasses`, [] as string[])
    let value = feature.value
    if (isString(value)) value = { value: value }

    // COMPOUNDING CLASSES
    const classes = [
      ..._classes, //
      !!getSpec(specs, `mark`) && `marked`,
    ] as string[]

    // #region COMPOUNDING TAGS

    const tags = new TagBuilder(_tags)

    //    TYPE
    if (!feature.type.isGeneric) {
      tags.at(0).add({
        type: `type`,
        classes: [`box`, `collapsed`],
        children: [
          {
            classes: `bold`,
            label: feature.type.name,
            icon: feature.type.icon ?? undefined,
          },
          {
            classes: `state`,
            label: stateToString(feature.state),
          },
        ],
      })
    } else {
      tags.at(0).add({
        type: `type`,
        classes: [`box`, `collapsed`],
        children: [
          {
            classes: `state`,
            label: stateToString(feature.state),
          },
        ],
      })
    }

    //    TAGS (feature tags, the property)
    tags.add(
      ...(feature.tags ?? []).map(featureTag => ({
        type: `feature`,
        classes: `box`,
        children: featureTag,
      })),
    )

    //    REFERENCE
    if (feature.reference?.length)
      tags.add(
        ...feature.reference.map(ref => ({
          type: `reference`,
          classes: `box`,
          children: {
            classes: `interactible`,
            label: ref,
          },
        })),
        {
          type: `reference`,
          classes: [`box`, `collapsed-only`],
          children: {
            classes: `interactible`,
            label: `References`,
          },
        },
      )

    // #endregion

    variant = {
      ...(variant ?? {}),
      classes,
      //
      label: getSpec(specs, `label`, feature.label ?? feature.specializedName),
      secondary_label: getSpec(specs, `secondary_label`),
      value,
      icon: getSpec(specs, `icon`, feature.type.icon) ?? undefined,
      mark: getSpec(specs, `mark`),
      //
      notes: getSpec(specs, `notes`, feature.notes),
      //
      tags: tags.tags,
    }

    return [variant]
  }

  static base(context: IFeatureContext, specs: FeatureMainVariantContextSpecs, manager: ContextManager): IFeatureContext {
    super.base(context, specs, manager)

    const children = get(context, `children`) ?? {}

    const main = FeatureMainVariantContextTemplate.main(children.main?.[0]?.variants ?? [], specs, manager)
    if (!main) return context

    context = {
      ...context,
      // {key: FeatureData} -> {main, ...secondaries}
      children: {
        ...children,
        main: [FeatureBaseContextTemplate.data(main, specs as any, manager)],
      },
    }
    return context
  }
}
