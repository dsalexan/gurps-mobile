import { flattenDeep, get, isArray, isNil, isNumber, isString, set } from "lodash"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../context"
import ContextManager from "../manager"
import { Displayable, IFeatureAction, IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "./interfaces"
import { isNilOrEmpty, push } from "../../../../../december/utils/lodash"
import LOGGER from "../../../../logger"
import TagBuilder, { FastTag } from "../tag"
import FeatureBaseContextTemplate from "./base"
import { FeatureState, stateToString } from "../../../../core/feature/utils"
import GenericFeature from "../../../actor/feature/generic"

export interface FeatureMainVariantContextSpecs extends ContextSpecs {
  feature: GenericFeature
  ignoreSpecialization?: boolean
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

    const ignoreSpecialization = get(specs, `ignoreSpecialization`) ?? false

    let defaultLabel = feature.data.proxy && ignoreSpecialization ? feature.data.name : feature.specializedName
    let defaultSecondaryLabel = undefined as any as string

    // COMPOUNDING CLASSES
    const classes = [
      ..._classes, //
      !!getSpec(specs, `mark`) && `marked`,
    ] as string[]

    const labelClasses = [
      //
      !!(feature.data.proxy && getSpec(specs, `proxyTo`, []).length > 0) && `soft`,
    ] as string[]

    // #region COMPOUNDING TAGS

    const tags = new TagBuilder(_tags)

    //    TYPE
    if (!feature.type.isGeneric) {
      let typeLabel = feature.type.name
      let icon = feature.type.icon ?? undefined
      if (feature.data.proxy) {
        typeLabel = undefined as any
        icon = undefined
      }

      tags.at(0).add({
        type: `type`,
        classes: [`box`, `collapsed`],
        children: [
          {
            classes: `bold`,
            label: typeLabel,
            icon,
          },
          ...(feature.data.state & FeatureState.PASSIVE
            ? []
            : [
                {
                  classes: `state`,
                  label: stateToString(feature.data.state),
                },
              ]),
        ],
      })
    } else if (!(feature.data.state & FeatureState.PASSIVE)) {
      tags.at(0).add({
        type: `type`,
        classes: [`box`, `collapsed`],
        children: [
          {
            classes: `state`,
            label: stateToString(feature.data.state),
          },
        ],
      })
    }

    // SPECIALIZATION REQUIRED
    else if (ignoreSpecialization && feature.sources.gca?.specializationRequired) {
      // TODO: Render #InputToTag as a tooltip maybe?
      defaultSecondaryLabel = `Specialization Required`
      // tags.add({
      //   type: `feature`,
      //   classes: `box`,
      //   children: `Specialization Required`,
      // })
    }

    //    TAGS (feature tags, the property)
    tags.add(
      ...(feature.data.tags ?? []).map(featureTag => ({
        type: `feature`,
        classes: `box`,
        children: featureTag,
      })),
    )

    //    REFERENCE
    if (feature.data.reference?.length)
      tags.add(
        ...feature.data.reference.map(ref => ({
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
      id: `main-variant`,
      //
      icon: {
        classes: [],
        value: getSpec(specs, `icon`, feature.type.icon) ?? `mdi-help-rhombus`,
      },
      label: {
        classes: labelClasses,
        main: getSpec(specs, `label`, feature.data.label ?? defaultLabel),
        secondary: getSpec(specs, `secondary_label`, defaultSecondaryLabel),
      },
      // value,
      mark: getSpec(specs, `mark`),
      //
      notes: getSpec(specs, `notes`, feature.data.notes),
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
        main: [FeatureBaseContextTemplate.data(`main`, main, specs as any, manager)],
      },
    }
    return context
  }
}
