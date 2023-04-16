import { cloneDeep, has, orderBy, sortBy } from "lodash"

import WrapperContextTemplate, { IWrapperContext, WrapperContextSpecs } from "./container/wrapper"
import BaseContextTemplate, { ContextSpecs, IContext } from "./context"
import FeatureBaseContextTemplate, { FeatureBaseContextSpecs } from "./feature/base"
import { IFeatureContext } from "./feature/interfaces"
import ListContextTemplate, { IListContext, ListContextSpecs } from "./container/list"
import FeatureMainVariantContextTemplate from "./feature/main"
import PinnedFeatureContextTemplate from "./feature/pinned"
import QueryResultFeatureContextTemplate from "./feature/queryResult"
import { GurpsMobileActor } from "../../actor/actor"
import Feature from "../../actor/feature"

export type IgnoreFeatureFallbacks<TSpecs> = Omit<TSpecs, `feature` | `hidden` | `pinned` | `collapsed`>
export interface PinnedFeatureContextSpecs extends IgnoreFeatureFallbacks<FeatureBaseContextTemplate> {
  list?: undefined
}

export default class ContextManager {
  actor: GurpsMobileActor

  constructor(actor: GurpsMobileActor) {
    this.actor = actor
  }

  build<TTemplate extends typeof BaseContextTemplate, TContext extends IContext>(templates: TTemplate[], specs: ContextSpecs): TContext {
    let context = {} as TContext

    for (const template of templates) context = template.pre(context, specs, this) as any
    for (const template of templates) context = template.base(context, specs, this) as any
    for (const template of templates) context = template.post(context, specs, this) as any

    return context
  }

  feature<TFeature extends Feature, TTemplate extends typeof BaseContextTemplate>(
    feature: TFeature,
    _specs: IgnoreFeatureFallbacks<FeatureBaseContextSpecs>,
    ...templates: TTemplate[]
  ) {
    const specs = (_specs || {}) as FeatureBaseContextSpecs

    specs.feature = feature

    // Inject fallback state getters
    if (specs.list !== undefined)
      specs.hidden = specs.hidden ?? ((id: string) => this.actor.getFlag(`gurps`, `mobile.features.hidden.${id}.${specs.list.replaceAll(/\./g, `-`)}`) as boolean)
    specs.pinned = specs.pinned ?? ((id: string) => this.actor.getFlag(`gurps`, `mobile.features.pinned.${id}`) as boolean)
    specs.collapsed = specs.collapsed ?? ((id: string) => this.actor.getFlag(`gurps`, `mobile.features.collapsed.${id}`) as boolean)

    templates.push(...(feature.__.context.templates as TTemplate[]))

    return this.build([FeatureBaseContextTemplate, FeatureMainVariantContextTemplate, ...templates], specs) as IFeatureContext
  }

  pinned<TFeature extends Feature>(feature: TFeature, specs: PinnedFeatureContextSpecs) {
    return this.feature(feature, specs as any, PinnedFeatureContextTemplate)
  }

  queryResult<TFeature extends Feature>(feature: TFeature, specs: IgnoreFeatureFallbacks<FeatureBaseContextSpecs>) {
    return this.feature(feature, specs, QueryResultFeatureContextTemplate)
  }

  wrapper(specs: WrapperContextSpecs) {
    return this.build([WrapperContextTemplate], specs) as IWrapperContext
  }

  list(specs: ListContextSpecs) {
    // Inject fallback state getters
    specs.expanded = specs.expanded ?? ((id: string) => this.actor.getLocalStorage(`${id.replaceAll(/\./g, `-`)}.expanded`, true) as boolean)
    specs.displayHidden = specs.displayHidden ?? ((id: string) => this.actor.getLocalStorage(`${id.replaceAll(/\./g, `-`)}.displayHidden`, true) as boolean)

    return this.build([ListContextTemplate], specs) as IListContext
  }

  static groupBy(features: Feature[], getGroup: (feature: Feature) => string, getSortKey?: (feature: Feature) => number, order: `asc` | `desc` = `asc`) {
    const groups: Record<string, Feature[]> = {} // map of grouped features
    const keys: Record<string, number> = {} // list of groups

    for (const feature of features) {
      const group = getGroup(feature)

      // initialize group
      if (!has(keys, group)) {
        keys[group] = Infinity
        groups[group] = []
      }

      // group
      groups[group].push(feature)

      // sort key if needed
      if (getSortKey) {
        const _key = getSortKey(feature)
        if (keys[group] > _key) keys[group] = _key
      } else {
        keys[group] = Object.keys(keys).length
      }
    }

    // sort keys by some order (like parens by order of appearance in sheet)
    const sortedKeys = orderBy(Object.entries(keys), e => e[1], order).map(e => e[0])

    return {
      keys: sortedKeys,
      groups,
    }
  }

  static indexFeatureWrapper(
    children: (IWrapperContext | IListContext | IFeatureContext)[],
    _wrapper: string | null = null,
    base = 0,
    e = 0,
    parentScopedIndex: number | null = null,
  ): (IWrapperContext | IListContext | IFeatureContext)[] {
    return children
      .map((featureOrWrapperOrList, _index) => {
        if (parentScopedIndex !== null) _index = featureOrWrapperOrList.index - parentScopedIndex

        const index = base + _index / 10 ** e

        if (featureOrWrapperOrList._template.includes(`list-feature`)) {
          const list = featureOrWrapperOrList as IListContext

          const collapsed = list.children.collapsed as (IWrapperContext | IListContext | IFeatureContext)[]
          const shown = list.children.shown as (IWrapperContext | IListContext | IFeatureContext)[]

          // list children should already have proper indexes, so we are replacing them for ones with this new context
          return {
            ...list,
            index,
            children: {
              collapsed: ContextManager.indexFeatureWrapper(collapsed, null, index, e + 1, list.index ?? 0),
              shown: ContextManager.indexFeatureWrapper(shown, null, index, e + 1, list.index ?? 0),
            },
          } as IListContext
        } else if (featureOrWrapperOrList._template.includes(`wrapper-feature`)) {
          const wrapper = featureOrWrapperOrList as IWrapperContext

          return {
            ...wrapper,
            index,
            children: ContextManager.indexFeatureWrapper(wrapper.children as (IWrapperContext | IListContext | IFeatureContext)[], wrapper.id, index, e + 1, null),
          } as IWrapperContext
        }

        return featureOrWrapperOrList
      })
      .map(obj => {
        if (_wrapper !== null) obj._wrapper = _wrapper
        return obj
      })
  }

  static splitCollapsedAndShown(children: (IWrapperContext | IListContext | IFeatureContext)[]) {
    const collapsed = [] as (IWrapperContext | IListContext | IFeatureContext)[]
    const shown = [] as (IWrapperContext | IListContext | IFeatureContext)[]

    for (const featureOrWrapperOrList of children) {
      if (featureOrWrapperOrList._template.includes(`list-feature`)) {
        const list = featureOrWrapperOrList as IListContext
        // a list cannot be collapsed (its expanded state is its own thing)
        shown.push(list)
        continue
      } else if (featureOrWrapperOrList._template.includes(`wrapper-feature`)) {
        const wrapper = featureOrWrapperOrList as IWrapperContext

        const { collapsed: _collapsed, shown: _shown } = ContextManager.splitCollapsedAndShown(wrapper.children as (IWrapperContext | IListContext | IFeatureContext)[])

        collapsed.push(..._collapsed)
        shown.push({ ...wrapper, children: _shown })

        continue
      }

      // feature
      const feature = featureOrWrapperOrList as IFeatureContext

      if (feature.hidden) collapsed.push(feature)
      else shown.push(feature)
    }

    return { collapsed, shown }
  }
}
