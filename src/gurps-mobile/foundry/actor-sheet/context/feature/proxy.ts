import { cloneDeep, difference, flattenDeep, get, isArray, isNil, isNumber, isString, set } from "lodash"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../context"
import ContextManager from "../manager"
import { Displayable, IFeatureAction, IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "./interfaces"
import { isNilOrEmpty, push } from "../../../../../december/utils/lodash"
import LOGGER from "../../../../logger"
import TagBuilder, { FastTag } from "../tag"
import FeatureBaseContextTemplate, { FeatureBaseContextSpecs } from "./base"

import WeaponFeatureContextTemplate, { WeaponFeatureContextSpecs } from "./variants/weapon"
import GenericFeature from "../../../actor/feature/generic"

export interface FeatureProxiesDataContextSpecs extends ContextSpecs {
  feature: GenericFeature
  //
  weapons: ContextSpecs
}

export interface IProxyFeatureContext extends IContext {
  children: Record<string, IFeatureDataContext[]> & { proxies?: IFeatureDataContext[] }
}

export default class FeatureProxiesDataContextTemplate extends BaseContextTemplate {
  static pre(context: IContext, specs: ContextSpecs, manager: ContextManager): IContext {
    super.pre(context, specs, manager)

    const feature = getSpec(specs, `feature`)

    if (feature.data.proxy) {
      context._template.push(`feature-proxies`)
      if (context._metadata?.childrenKeys === undefined) set(context, `_metadata.childrenKeys`, [])
      context._metadata?.childrenKeys.push([6, `proxies`])
    }

    return context
  }

  /**
   * Builds N FeatureData's, one for every proxy linked to feature AND for specialization attached directly to feature (if it exists)
   */
  static proxies(data: IFeatureDataContext[], specs: FeatureProxiesDataContextSpecs, manager: ContextManager): IFeatureDataContext[] | null {
    if (data === undefined) data = []
    const feature = getSpec(specs, `feature`)

    if (!feature.data.proxy) return null

    // WARN: Unimplemented pre-defined featureData array
    // eslint-disable-next-line no-debugger
    if (data.length > 0) debugger

    const proxyTo: GenericFeature[] = get(specs, `proxyTo`) ?? []
    const specialization = feature.data.specialization

    //   proxyTo - render related trained/untrained skills as featureData

    const proxiesSpecs = get(specs, `proxies`) ?? {}

    for (const proxy of proxyTo) {
      const _specs = { ...cloneDeep(proxy.__.context.specs ?? {}), ...cloneDeep(proxiesSpecs) } as FeatureBaseContextSpecs
      _specs.list = specs.list
      push(_specs, `innerClasses`, `swipe-variant`)

      const context = manager.feature(proxy, _specs)

      const main = context.children.main[0]
      main.id = `proxy-${proxy.id}`
      for (const variant of main.variants) {
        const tags = new TagBuilder(variant.tags)

        // REFERENCE
        // only show reference tag if there are new references (those not present in main)
        const newReferences = difference(feature.data.reference, proxy.data.reference)
        tags.type(`reference`).update(tag => {
          if (newReferences.length === 0)
            return {
              type: `reference`,
              classes: [`box`],
            }

          return {
            type: `reference`,
            classes: [`box`],
            children: {
              classes: `interactible`,
              label: `References`,
            },
          }
        })

        // TODO: Move this to Skill template? Or too much trouble for too little gain?
        if (feature.type.compare(`skill`)) {
          // TRAINING
          // show prefix "trained" in type
          if (proxy.data.training === `trained`) {
            tags.type(`type`).update(tag => {
              tag.children[0].label = `Trained Skill`

              return tag
            })
          }

          // DIFFICULTY
          // hide difficulty if it is same from main
          if (feature.data.difficulty === proxy.data.difficulty) {
            tags.type(`type`).update(tag => {
              tag.children = tag.children.map(child => {
                if (!child.classes?.includes(`difficulty`)) return child

                child.label = undefined
                return child
              })
              return tag
            })
          }
        }

        variant.tags = tags.tags
      }
      // main.variants = WeaponFeatureContextTemplate.skillsVariants(main.variants, _specs, manager)

      // main.actions = false
      // main.classes = main.classes.filter(classe => classe !== `has-swipe`)

      const expanded = get(specs, `expanded`)?.(feature.id, main.id) ?? false
      if (expanded && !main.classes.includes(`expanded`)) main.classes.push(`expanded`)
      else main.classes = main.classes.filter(classe => classe !== `expanded`)

      data.push(main)
    }

    if (data.length === 0) return null
    return data
  }

  static base(context: IFeatureContext, specs: FeatureProxiesDataContextSpecs, manager: ContextManager): IProxyFeatureContext {
    super.base(context, specs, manager)

    const children = get(context, `children`) ?? {}

    const proxies = this.proxies(children.proxies, specs, manager)
    if (!proxies) return context

    context = {
      ...context,
      // {key: FeatureData} -> {main, ...secondaries}
      children: {
        ...children,
        proxies,
      },
    }

    return context
  }
}
