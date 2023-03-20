import { flatten, flattenDeep, get, isArray, isNil, isNumber, isString, orderBy, set, uniq } from "lodash"
import { FeatureBaseContextSpecs } from "../base"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../../context"
import { FastDisplayable, IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "../interfaces"
import TagBuilder, { PartialTag } from "../../tag"
import { IFeatureValue } from "../interfaces"
import ContextManager from "../../manager"
import { push } from "../../../../../../december/utils/lodash"
import { IEquipmentFeature } from "../../../../../core/feature/compilation/templates/equipment"
import EquipmentFeature from "../../../../../core/feature/variants/spell"

export interface EquipmentFeatureContextSpecs extends FeatureBaseContextSpecs {
  feature: IEquipmentFeature
  //
  showDefaults?: boolean
  difficulty?: boolean
}

export default class EquipmentFeatureContextTemplate extends BaseContextTemplate {
  static pre(context: IContext, specs: ContextSpecs, manager: ContextManager): IContext {
    super.pre(context, specs, manager)

    context._template.push(`equipment-feature`)

    return context
  }

  /**
   * Build main data-variant of feature
   */
  static main(variants: IFeatureDataVariant[], specs: EquipmentFeatureContextSpecs, manager: ContextManager): IFeatureDataVariant[] {
    const feature = getSpec(specs, `feature`)
    let variant = variants[0] ?? { classes: [] }

    const tags = new TagBuilder(variant.tags)

    // QUANTITY
    if (!isNil(feature.quantity)) {
      tags.type(`type`).update(tag => {
        tag.children.push({
          classes: [`interactible`],
          label: `x<b>${feature.quantity}</b>`,
        })

        return tag
      })
    }

    // WEIGHT
    if (!isNil(feature.weight?.extended)) {
      tags.type(`type`).push({
        type: `quantity`,
        classes: [`box`, `collapsed`],
        children: [
          { icon: `mdi-weight` },
          {
            classes: [], //feature.carried ? `interactible` : [],
            label: `<b>${feature.weight.extended}</b> kg`,
          },
          {
            classes: [`interactible`],
            icon: feature.carried ? `mdi-bag-carry-on` : `mdi-bag-carry-on-off`,
            label: feature.carried ? undefined : `Not Carried`,
          },
        ],
      })

      // if (!main.actions?.right) set(main, `actions.right`, [])
      // main.actions.right.splice(main.actions.right.length ? 1 : 0, 0, {
      //   classes: [`horizontal`],
      //   children: [
      //     {
      //       icon: feature.carried ? `mdi-bag-carry-on-off` : `mdi-bag-carry-on`,
      //       classes: [`target`, `action-carry`],
      //     },
      //   ],
      // })
    }

    // COST
    if (!isNil(feature.cost?.extended)) {
      tags.type(`type`).push({
        type: `quantity`,
        classes: [`box`],
        children: [
          {
            icon: `mdi-currency-usd`,
          },
          {
            classes: `interactible`,
            label: `<b>${feature.cost.extended}</b> cp`,
          },
        ],
      })
    }

    variant.tags = tags.tags
    return [variant]
  }

  static base(context: IFeatureContext, specs: EquipmentFeatureContextSpecs, manager: ContextManager): IFeatureContext {
    super.base(context, specs, manager)

    const feature = getSpec(specs, `feature`)
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
