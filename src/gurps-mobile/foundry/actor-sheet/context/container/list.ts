import { get, isNil } from "lodash"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../context"
import ContextManager from "../manager"
import GenericFeature from "../../../actor/feature/generic"
import LOGGER from "../../../../logger"

export interface IListContext extends IContext {
  list: string
  id: string | null
  index: number | null
  path?: string
  label: string
  //
  expanded: boolean
  displayHidden: boolean
  children: {
    collapsed: IContext[]
    shown: IContext[]
  }
}

export interface ListContextSpecs extends ContextSpecs {
  id: string
  classes?: string[]
  label: string | undefined
  displayHidden?: (id?: string) => boolean
  expanded?: (id?: string) => boolean
  //
  feature?: GenericFeature
  children: IContext[]
}

export default class ListContextTemplate extends BaseContextTemplate {
  static pre(context: IListContext, specs: ContextSpecs, manager: ContextManager): IListContext {
    super.pre(context, specs, manager)

    context._template.push(`list-feature`)

    return context
  }

  static base(context: IListContext, specs: ListContextSpecs, manager: ContextManager): IListContext {
    super.base(context, specs, manager)

    const classes = getSpec(specs, `classes`, [] as string[])

    const id = getSpec(specs, `id`)
    const feature = getSpec(specs, `feature`)
    const index = getSpec(specs, `index`, feature ? feature.key.value : null)
    // LOGGER.warn(`list`, feature?.data?.name ?? `no feature`, `index`, index)

    const displayHidden = get(specs, `displayHidden`)?.(id) ?? true
    const expanded = get(specs, `expanded`)?.(id) ?? true

    const children = getSpec(specs, `children`, [])

    const indexedChildren = ContextManager.indexFeatureWrapper(children)
    const { collapsed, shown } = ContextManager.splitCollapsedAndShown(indexedChildren)

    if (displayHidden) classes.push(`display-hidden`)

    context = {
      ...context,
      classes,
      //
      list: id,
      id: feature ? feature?.id : null,
      path: feature?.path ?? undefined,
      index,
      //
      label: getSpec(specs, `label`),
      expanded,
      children: { collapsed, shown },
    }

    return context
  }
}
