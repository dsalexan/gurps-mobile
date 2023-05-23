import { cloneDeep, flattenDeep, get, isArray, isNil, isNumber, isString, max, orderBy, set } from "lodash"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../context"
import ContextManager from "../manager"
import { Displayable, IFeatureAction, IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "./interfaces"
import { isNilOrEmpty, push } from "../../../../../december/utils/lodash"
import LOGGER from "../../../../logger"
import TagBuilder, { FastTag } from "../tag"
import FeatureBaseContextTemplate from "./base"

import FeatureUsageContextTemplate, { FeatureUsageContextSpecs } from "./variants/usage"
import GenericFeature from "../../../actor/feature/generic"
import { calculateLevel, nonSkillVariables, allowedSkillVariables, viabilityTest } from "../../../../../gurps-extension/utils/level"
import { GurpsMobileActor } from "../../../actor/actor"
import FeatureUsage from "../../../actor/feature/usage"

export interface FeatureUsagesDataContextSpecs extends ContextSpecs {
  feature: GenericFeature
  //
  usages: ContextSpecs
  usageFilter?: (usage: FeatureUsage) => boolean
}

export interface IUsableFeatureContext extends IContext {
  children: Record<string, IFeatureDataContext[]> & { weapons?: IFeatureDataContext[] }
}

export default class FeatureUsagesDataContextTemplate extends BaseContextTemplate {
  static pre(context: IContext, specs: ContextSpecs, manager: ContextManager): IContext {
    super.pre(context, specs, manager)

    const feature = getSpec(specs, `feature`)
    const hasUsages = feature.data.usages && feature.data.usages.length > 0

    if (hasUsages) {
      context._template.push(`feature-usages`)
      if (context._metadata?.childrenKeys === undefined) set(context, `_metadata.childrenKeys`, [])
      context._metadata?.childrenKeys.push([5, `usages`])
    }

    return context
  }

  /**
   * Builds N FeatureData's, one for every weapon linked to feature
   */
  static usages(data: IFeatureDataContext[], specs: FeatureUsagesDataContextSpecs, manager: ContextManager): IFeatureDataContext[] | null {
    if (data === undefined) data = []

    const feature = getSpec(specs, `feature`)
    const actor = getSpec(specs, `actor`) as GurpsMobileActor

    if (!actor) debugger

    const hasUsages = feature.data.usages && feature.data.usages.length > 0
    if (!hasUsages) return null

    // WARN: Unimplemented pre-defined featureData array
    // eslint-disable-next-line no-debugger
    if (data.length > 0) debugger

    const usagesSpecs = get(specs, `usages`) ?? {}
    const usageFilter = get(specs, `usageFilter`)

    const filteredUsages = usageFilter ? feature.data.usages!.filter(usage => usageFilter(usage)) : feature.data.usages!

    const orderedUsages = orderBy(
      filteredUsages,
      usage => {
        let value = { attack: 3, affliction: 2, defense: 1 }[usage.data.type] ?? -Infinity
        let level = 0

        if (usage.data.use && usage.data.use.rule !== `automatic`) {
          debugger
        }

        if (usage.data.hit) {
          if (usage.data.hit.rule === `automatic`) {
            // pass
          } else if (usage.data.hit.rule === `roll_to_hit` || usage.data.hit.rule === `roll_to_resist`) {
            const levels = usage.data.hit.levels
            if (levels && levels[0].value) level = levels[0].value
          } else {
            debugger
          }
        }

        return value + level / 10
      },
      `desc`,
    )

    for (const usage of orderedUsages) {
      const _specs = { ...cloneDeep(usage.__.context.specs ?? {}), ...cloneDeep(usagesSpecs) } as FeatureUsageContextSpecs
      _specs.list = specs.list
      _specs.secondary = true
      push(_specs, `innerClasses`, `swipe-variant`)

      const context = manager.feature(usage, _specs)

      const main = context.children.main[0]
      main.id = `usage-${usage.id}`

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

  static base(context: IFeatureContext, specs: FeatureUsagesDataContextSpecs, manager: ContextManager): IUsableFeatureContext {
    super.base(context, specs, manager)

    const children = get(context, `children`) ?? {}

    const usages = this.usages(children.usages, specs, manager)
    if (!usages) return context

    context = {
      ...context,
      // {key: FeatureData} -> {main, ...secondaries}
      children: {
        ...children,
        usages,
      },
    }

    return context
  }
}
