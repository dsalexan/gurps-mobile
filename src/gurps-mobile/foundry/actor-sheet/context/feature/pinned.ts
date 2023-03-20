import { flattenDeep, get, intersection, isArray, isNil, isNumber, isString, set } from "lodash"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../context"
import ContextManager from "../manager"
import { Displayable, IFeatureAction, IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "./interfaces"
import BaseFeature from "../../../../core/feature/base"
import { isNilOrEmpty, push } from "../../../../../december/utils/lodash"
import LOGGER from "../../../../logger"
import TagBuilder, { FastTag } from "../tag"
import FeatureBaseContextTemplate, { FeatureBaseContextSpecs } from "./base"

export default class PinnedFeatureContextTemplate extends BaseContextTemplate {
  static pre(context: IContext, specs: ContextSpecs, manager: ContextManager): IContext {
    super.pre(context, specs, manager)

    context._template.push(`query-result-feature`)

    return context
  }

  static base(context: IFeatureContext, specs: FeatureBaseContextSpecs, manager: ContextManager): IFeatureContext {
    super.base(context, specs, manager)

    context.classes.push(`alternative`)

    // ignore hidden
    context.classes = context.classes?.filter(c => c !== `hidden`)
    context.classes.push(`ignore-hidden`)
    context.hidden = false

    // ignore collapsed
    context.classes = context.classes?.filter(c => c !== `collapsed`)
    context.classes.push(`ignore-collapsed`)

    // remove some actions for main featureData
    const main = context.children.main[0]
    const excludeActions = [`action-collapse`, `action-hide`]

    if (main?.actions) {
      const sides = [`left`, `right`] as const
      for (const side of sides) {
        if (main.actions[side]) {
          main.actions[side] = main.actions[side]
            .map(container => {
              return {
                ...container,
                children: container.children
                  .map(action => {
                    if (intersection(excludeActions, action?.classes ?? []).length > 0) return null

                    return action
                  })
                  .filter(action => !isNil(action)),
              } as IFeatureAction
            })
            .filter(container => container.children.length > 0)
        }
      }
    }

    return context

    return context
  }
}
