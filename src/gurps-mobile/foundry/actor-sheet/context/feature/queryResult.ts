import { flattenDeep, get, intersection, isArray, isNil, isNumber, isString, set } from "lodash"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../context"
import ContextManager from "../manager"
import { Displayable, IFeatureAction, IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "./interfaces"
import { isNilOrEmpty, push } from "../../../../../december/utils/lodash"
import LOGGER from "../../../../logger"
import TagBuilder, { FastTag } from "../tag"
import GenericFeature from "../../../actor/feature/generic"

export interface QueryResultFeatureContextSpecs extends ContextSpecs {
  feature: GenericFeature
  //
  hidden: boolean
  pinned: (id: string) => boolean
  collapsed: (id: string) => boolean
  //
  index?: number
  tags?: FastTag[]
  variantClasses?: string[]
}

export default class QueryResultFeatureContextTemplate extends BaseContextTemplate {
  static pre(context: IContext, specs: ContextSpecs, manager: ContextManager): IContext {
    super.pre(context, specs, manager)

    context._template.push(`pinned-feature`)

    return context
  }

  static base(context: IFeatureContext, specs: QueryResultFeatureContextSpecs, manager: ContextManager): IFeatureContext {
    super.base(context, specs, manager)

    const feature = getSpec(specs, `feature`)
    const proxyTo: GenericFeature[] = get(specs, `proxyTo`) ?? []

    context.classes.push(`alternative`)

    // ignore highlighting for pinned
    context.classes = context.classes?.filter(c => c !== `pinned`)
    context.classes.push(`ignore-pinned`)

    // ignore hidden
    context.classes = context.classes?.filter(c => c !== `hidden`)
    context.classes.push(`ignore-hidden`)
    context.hidden = false

    // remove some actions for main featureData
    const main = context.children.main[0]
    let excludeActions = [`action-roller`, `action-hide`]

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
                    if (action.classes?.includes(`action-pin`)) {
                      if (feature.data.proxy && proxyTo.length > 0) return null // only remove pin for a proxied proxy
                      else action.icon = `mdi-pin-off`
                    }

                    return action
                  })
                  .filter(action => !isNil(action)),
              } as IFeatureAction
            })
            .filter(container => container.children.length > 0)
        }
      }
    }

    // remove some actions for proxies featureData
    excludeActions = [`action-roller`, `action-hide`]
    // if (feature.data.name === `Smith`) debugger
    for (const proxy of context.children.proxies ?? []) {
      if (proxy?.actions) {
        const sides = [`left`, `right`] as const
        for (const side of sides) {
          if (proxy.actions[side]) {
            proxy.actions[side] = proxy.actions[side]
              .map(container => {
                return {
                  ...container,
                  children: container.children
                    .map(action => {
                      if (intersection(excludeActions, action?.classes ?? []).length > 0) return null
                      if (action.classes?.includes(`action-pin`)) action.icon = `mdi-pin-off`

                      return action
                    })
                    .filter(action => !isNil(action)),
                } as IFeatureAction
              })
              .filter(container => container.children.length > 0)
          }
        }
      }
    }

    return context
  }
}
