import { get, isFunction, isObjectLike, isString, uniqueId, isNil, isEmpty, isArray, uniq, GetFieldType } from "lodash"
import { v4 as uuidv4 } from "uuid"
import { isNilOrEmpty, xget } from "../../../../december/utils/lodash"
import BaseFeature from "../../../core/feature/base"
import ContextManager from "./manager"
import GenericFeature from "../../actor/feature/generic"

export function getSpec<TObject extends ContextSpecs, TPath extends string, TValue = GetFieldType<TObject, TPath>>(specs: TObject, path: TPath): TValue
export function getSpec<TObject extends ContextSpecs, TPath extends string, TValue = GetFieldType<TObject, TPath>>(specs: TObject, path: TPath, defaultValue?: TValue): TValue
export function getSpec<TObject extends ContextSpecs, TPath extends string, TValue = GetFieldType<TObject, TPath>>(specs: TObject, path: TPath, defaultValue?: TValue): TValue {
  const value = get(specs, path) as TValue | ((...args: any[]) => TValue)

  if (isFunction(value)) return (value() ?? defaultValue) as TValue

  return (value ?? defaultValue) as TValue
}

export interface IContext {
  _template: string[]
  _context: string
  _metadata?: Record<string, any>
  _wrapper?: string
  //
  classes: string[]
  variantClasses?: string[]
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ContextSpecs {
  feature: GenericFeature
  list?: string
  //
  hidden: (id: string) => boolean
  pinned: (id: string) => boolean
  expanded: (id: string, variantId: string) => boolean
  roller: (id: string) => boolean
  _context?: string
  //
  classes?: string[]
}

export default class BaseContextTemplate {
  static pre(context: IContext, specs: ContextSpecs, manager: ContextManager): IContext {
    if (!context) context = {} as IContext

    if (!isArray(context._template)) context._template = isNil(context._template) ? [] : [context._template]
    context._template.push(`context`)
    context._template = uniq(context._template)

    return context
  }

  static base(context: IContext, specs: ContextSpecs, manager: ContextManager) {
    return context
  }

  static post(context: IContext, specs: ContextSpecs, manager: ContextManager) {
    // removes empty classes
    context.classes = (context.classes ?? []).filter(_class => !isNilOrEmpty(_class) && (_class as any) !== false)

    // only inject context uuid at the end for some fucking reason
    //    this uuid identifies the context generation
    context._context = getSpec(specs, `_context`, uuidv4())

    return context
  }
}
