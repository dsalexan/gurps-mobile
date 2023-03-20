import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../context"
import ContextManager from "../manager"

export interface IWrapperContext extends IContext {
  id: string
  index: number
  children: IContext[]
}

export interface WrapperContextSpecs extends ContextSpecs {
  id: string
  index: number
  //
  children: IContext[]
}

export default class WrapperContextTemplate extends BaseContextTemplate {
  static pre(context: IContext, specs: ContextSpecs, manager: ContextManager): IContext {
    super.pre(context, specs, manager)

    context._template.push(`wrapper-feature`)

    return context
  }

  static base(context: IWrapperContext, specs: WrapperContextSpecs, manager: ContextManager): IWrapperContext {
    super.base(context, specs, manager)

    const id = getSpec(specs, `id`)
    const index = getSpec(specs, `index`)
    const children = getSpec(specs, `children`, [] as IContext[])

    context = {
      ...context,
      //
      id,
      classes: getSpec(specs, `classes`, [] as string[]),
      index,
      children: ContextManager.indexFeatureWrapper(children as any[], id, 0, 0, null),
    }

    return context
  }
}
