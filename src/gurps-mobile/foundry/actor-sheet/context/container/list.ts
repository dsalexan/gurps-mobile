import { get, isNil } from "lodash"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../context"
import ContextManager from "../manager"

export interface IListContext extends IContext {
  id: string
  index: number
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
  classes: string[]
  label: string | undefined
  displayHidden?: (id?: string) => boolean
  expanded?: (id?: string) => boolean
  //
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
      id,
      label: getSpec(specs, `label`),
      expanded,
      children: { collapsed, shown },
    }

    return context
  }
}
