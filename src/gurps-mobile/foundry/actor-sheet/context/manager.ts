import _, { cloneDeep, has, includes, isNil, isString, omit, orderBy, range, sortBy } from "lodash"

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
import { push } from "../../../../december/utils/lodash"
import GenericFeature from "../../actor/feature/generic"
import LOGGER from "../../../logger"

export type IgnoreFeatureFallbacks<TSpecs> = Omit<TSpecs, `feature` | `hidden` | `pinned` | `expanded`>
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PinnedFeatureContextSpecs extends IgnoreFeatureFallbacks<FeatureBaseContextTemplate> {
  //
}

export type ContextGroup = {
  keys: string[]
  groups: Record<string, ContextGroup>
}

export interface ContextNode {
  feature: string | undefined
  children: ContextNode[]
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

  feature<TFeature extends GenericFeature, TTemplate extends typeof BaseContextTemplate, TSpecs extends FeatureBaseContextSpecs = FeatureBaseContextSpecs>(
    feature: TFeature,
    _specs: IgnoreFeatureFallbacks<TSpecs>,
    ...templates: TTemplate[]
  ) {
    const specs = (_specs || {}) as TSpecs

    specs.feature = feature

    // Inject fallback state getters
    if (specs.list !== undefined)
      specs.hidden = specs.hidden ?? ((id: string) => this.actor.getFlag(`gurps`, `mobile.features.hidden.${id}.${specs.list!.replaceAll(/\./g, `-`)}`) as boolean)
    specs.pinned = specs.pinned ?? ((id: string) => this.actor.getFlag(`gurps`, `mobile.features.pinned.${id}`) as boolean)
    specs.expanded = specs.expanded ?? ((id: string) => this.actor.getFlag(`gurps`, `mobile.features.expanded.${id}`) as boolean)
    specs.roller = specs.roller ?? ((id: string) => this.actor.getFlag(`gurps`, `mobile.features.roller.${id}`) as boolean)

    const finalTemplates = [...(feature.__.context.templates as TTemplate[]), ...templates]

    return this.build([FeatureBaseContextTemplate, FeatureMainVariantContextTemplate, ...finalTemplates], specs) as IFeatureContext
  }

  pinned<TFeature extends Feature>(feature: TFeature, specs: PinnedFeatureContextSpecs) {
    return this.feature(feature, specs as any, PinnedFeatureContextTemplate)
  }

  queryResult<TFeature extends Feature, TSpecs extends FeatureBaseContextSpecs = FeatureBaseContextSpecs>(feature: TFeature, specs: IgnoreFeatureFallbacks<TSpecs>) {
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

  toContext<TFeature extends GenericFeature>(feature: TFeature, specs: IgnoreFeatureFallbacks<FeatureBaseContextSpecs>) {
    if (feature.data.container) {
      return this.list({
        feature: feature,
        id: feature.id,
        label: feature.data.name,
        children: [],
      })
    }

    return this.feature(feature, specs)
  }

  featuresToContexts(
    parent: string | undefined,
    featureTree: ReturnType<typeof ContextManager.prepareTree>,
    listSpecs?: (feature: GenericFeature, parent?: GenericFeature) => Partial<ListContextSpecs>,
    featureSpecs?: (feature: GenericFeature, parent?: GenericFeature) => IgnoreFeatureFallbacks<FeatureBaseContextSpecs>,
  ) {
    const parentFeature = parent !== undefined ? featureTree.byId[parent] : parent
    const features = (featureTree.byParent[String(parent)] ?? []).map(id => featureTree.byId[id]) as any as GenericFeature[]

    const nonContainers = features.filter(feature => !feature.data.container)
    const containers = features.filter(feature => feature.data.container)

    const contexts = [] as (IListContext | IFeatureContext)[]

    if (nonContainers.length > 0) {
      // compile context for all non-containers
      for (const nonContainer of nonContainers) {
        const specs = featureSpecs ? featureSpecs(nonContainer, parentFeature as any) : ({} as IgnoreFeatureFallbacks<FeatureBaseContextSpecs>)

        const feature = this.feature(nonContainer, specs)
        contexts.push(feature)
      }
    }

    for (const container of containers) {
      const specs = omit((listSpecs ? listSpecs(container, parentFeature as any) : {}) ?? {}, [`children`])

      const list = this.list({
        feature: container,
        id: container.id,
        label: container.data.name,
        // children: container.children.map(feature => this.feature(feature, featureSpecs(feature) ?? {})),
        children: this.featuresToContexts(container.id, featureTree, listSpecs, featureSpecs),
        ...specs,
      })

      contexts.push(list)
    }

    return contexts
  }

  static prepareTree(features: Feature[], getSortKey?: (feature: Feature) => number, order: `asc` | `desc` = `asc`) {
    // first get all features without parents
    // then get all features children of those features
    // then get all features children of those features
    // etc
    // until there are no more features

    const byId = Object.fromEntries(features.map(feature => [feature.id, feature]))
    const byDepth = [] as string[][] // all features arranged by depth
    const byParent = {} as Record<string, string[]> // all features arranged by parent

    const allowedParents = [undefined, ...features.map(feature => feature.id)]
    let _features = features.map(feature => feature.id) // list of feature indexes
    let parents = [undefined] as (string | undefined)[] // current parents for next iteration
    let depth = 0 // current depth

    while (_features.length > 0) {
      let remove = [] as string[] // list of features to remove from _features

      for (const featureId of _features) {
        const feature = byId[featureId]

        const parent = allowedParents.includes(feature.parent?.id) ? feature.parent?.id : undefined

        if (includes(parents, parent)) {
          remove.push(featureId)

          push(byDepth, depth, feature.id)
          push(byParent, String(parent), feature.id)
        }
      }

      parents = cloneDeep(byDepth[depth]) // update parents for next iteration
      _features = _features.filter(featureId => !remove.includes(featureId)) // remove cataloged features

      // ERROR: This should not be possible
      if (remove.length === 0) debugger

      depth++
    }

    for (const key of Object.keys(byParent)) {
      byParent[key] = orderBy(
        byParent[key].map(id => byId[id]),
        getSortKey,
        order,
      ).map(feature => feature.id)
    }

    return {
      byId,
      byDepth,
      byParent,
    }
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

  static indexFeatureWrapper(children: (IWrapperContext | IListContext | IFeatureContext)[], _wrapper: string | null = null): (IWrapperContext | IListContext | IFeatureContext)[] {
    const indexedChildren = [] as (IWrapperContext | IListContext | IFeatureContext)[]

    for (let _index = 0; _index < children.length; _index++) {
      const featureOrWrapperOrList = children[_index]

      // let i = _index
      // if (parentScopedIndex !== null) i = featureOrWrapperOrList.index - parentScopedIndex

      // const index = base + i / 10 ** e

      // const e = 10 ** Math.ceil(Math.log10(children.length))
      const index = featureOrWrapperOrList.index

      // ERROR: Every child should have a index
      if (isNil(index)) debugger

      let obj: IListContext | IFeatureContext | IWrapperContext = featureOrWrapperOrList

      if (featureOrWrapperOrList._template.includes(`list-feature`)) {
        const list = featureOrWrapperOrList as IListContext

        const collapsed = list.children.collapsed as (IWrapperContext | IListContext | IFeatureContext)[]
        const shown = list.children.shown as (IWrapperContext | IListContext | IFeatureContext)[]

        // list children should already have proper indexes, so we are replacing them for ones with this new context
        obj = {
          ...list,
          index,
          children: {
            collapsed: ContextManager.indexFeatureWrapper(collapsed, null),
            shown: ContextManager.indexFeatureWrapper(shown, null),
          },
        } as IListContext
      } else if (featureOrWrapperOrList._template.includes(`wrapper-feature`)) {
        const wrapper = featureOrWrapperOrList as IWrapperContext

        obj = {
          ...wrapper,
          // index,
          children: ContextManager.indexFeatureWrapper(wrapper.children as (IWrapperContext | IListContext | IFeatureContext)[], wrapper.id),
        } as IWrapperContext
      }

      if (_wrapper !== null) obj._wrapper = _wrapper

      indexedChildren.push(obj)
    }

    return orderBy(indexedChildren, obj => obj.index! + (obj._template.includes(`list-feature`) ? 10 : 0), `asc`)
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
