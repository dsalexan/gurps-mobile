import { cloneDeep, flattenDeep, get, isArray, isNil, isNumber, isString, max, orderBy, set } from "lodash"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../context"
import ContextManager from "../manager"
import { Displayable, IFeatureAction, IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "./interfaces"
import { isNilOrEmpty, push } from "../../../../../december/utils/lodash"
import LOGGER from "../../../../logger"
import TagBuilder, { FastTag } from "../tag"
import FeatureBaseContextTemplate, { FeatureBaseContextSpecs } from "./base"

import FeatureUsageContextTemplate, { FeatureUsageContextSpecs } from "./variants/usage"
import GenericFeature from "../../../actor/feature/generic"
import { calculateLevel, nonSkillVariables, allowedSkillVariables, viabilityTest } from "../../../../../gurps-extension/utils/level"
import { GurpsMobileActor } from "../../../actor/actor"
import FeatureUsage from "../../../actor/feature/usage"
import { FeatureMainVariantContextSpecs } from "./main"
import Feature from "../../../actor/feature"

export interface FeatureChildrenDataContextSpecs extends ContextSpecs {
  feature: GenericFeature
  //
  child: ContextSpecs
  childFilter?: (child: Feature<any, any>) => boolean
}

export interface IUsableFeatureContext extends IContext {
  children: Record<string, IFeatureDataContext[]> & { weapons?: IFeatureDataContext[] }
}

export default class FeatureChildrenDataContextTemplate extends BaseContextTemplate {
  static pre(context: IContext, specs: ContextSpecs, manager: ContextManager): IContext {
    super.pre(context, specs, manager)

    const feature = getSpec(specs, `feature`)

    const isNotContainer = !feature.data.container
    const hasChildren = feature.data.children && feature.data.children.length > 0

    if (isNotContainer && hasChildren) {
      context._template.push(`feature-usages`)
      if (context._metadata?.childrenKeys === undefined) set(context, `_metadata.childrenKeys`, [])
      context._metadata?.childrenKeys.push([3, `children`])
    }

    return context
  }

  /**
   * Builds N FeatureData's, one for every feature fathered(?) to feature
   */
  static children(data: IFeatureDataContext[], specs: FeatureChildrenDataContextSpecs, manager: ContextManager): IFeatureDataContext[] | null {
    if (data === undefined) data = []

    const feature = getSpec(specs, `feature`)
    const actor = getSpec(specs, `actor`) as GurpsMobileActor

    if (!actor) debugger

    const isNotContainer = !feature.data.container
    const hasChildren = feature.data.children && feature.data.children.length > 0
    if (!hasChildren || !isNotContainer) return null

    // WARN: Unimplemented pre-defined featureData array
    // eslint-disable-next-line no-debugger
    if (data.length > 0) debugger

    const childSpecs = get(specs, `child`) ?? {}
    const childFilter = get(specs, `childFilter`)

    const features = actor.cache.features!
    const children = feature.data.children!.map(id => features[id])

    const filteredChildren = childFilter ? children.filter(child => childFilter(child)) : children

    for (const child of filteredChildren) {
      const _specs = { ...cloneDeep(child.__.context.specs ?? {}), ...cloneDeep(childSpecs) } as FeatureBaseContextSpecs & FeatureMainVariantContextSpecs
      _specs.list = specs.list
      _specs.secondary = true
      // push(_specs, `innerClasses`, `swipe-variant`)

      const context = manager.feature(child, _specs)

      const main = context.children.main[0]
      main.id = `child-${child.id}`

      // main.variants = FeatureUsageContextTemplate.skillsVariants(main.variants, _specs, manager)

      main.actions = false
      main.classes = main.classes.filter(classe => classe !== `has-swipe`)

      const expanded = get(specs, `expanded`)?.(feature.id, main.id) ?? false

      if (expanded && !main.classes.includes(`expanded`)) main.classes.push(`expanded`)
      else if (!expanded && main.classes.includes(`expanded`)) main.classes = main.classes.filter(classe => classe !== `expanded`)

      data.push(main)
    }

    if (data.length === 0) return null
    return data
  }

  static base(context: IFeatureContext, specs: FeatureChildrenDataContextSpecs, manager: ContextManager): IUsableFeatureContext {
    super.base(context, specs, manager)

    const contextChildren = get(context, `children`) ?? {}

    const children = this.children(contextChildren.children, specs, manager)
    if (!children) return context

    context = {
      ...context,
      // {key: FeatureData} -> {main, ...secondaries}
      children: {
        ...contextChildren,
        children,
      },
    }

    return context
  }
}
