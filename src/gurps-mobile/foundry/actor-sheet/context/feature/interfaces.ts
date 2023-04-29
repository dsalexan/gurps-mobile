import BaseFeature from "../../../../core/feature/base"
import { IContext } from "../context"

export interface Displayable {
  classes?: string[]
  label?: string
  value?: string | number
  icon?: string
}

export type FastDisplayable =
  | string
  | {
      classes?: string | string[]
      label?: string
      value?: string | number
      icon?: string
    }

export interface IFeatureContext extends IContext {
  _feature: BaseFeature
  //
  id: string
  index: number
  path: string | null
  hidden?: boolean
  //
  children: Record<string, IFeatureDataContext[]> & { main: IFeatureDataContext[] }
}

export interface IFeatureDataContext {
  classes: string[]
  //
  variants: IFeatureDataVariant[]
  actions: false | { left: IFeatureAction[]; right: IFeatureAction[] }
}

export interface IFeatureDataVariant {
  classes: string[]
  //
  icon?: {
    classes?: string[]
    value?: string
  }
  label?: {
    classes?: string[]
    main?: string
    secondary?: string
  }
  value?: IFeatureValue
  mark?: string
  //
  notes?: string[]
  stats?: Displayable[]
  tags: ITag[]
}

export interface IFeatureAction {
  classes: string[]
  //
  children: {
    classes: string[]
    icon?: string
  }[]
}

export type IFeatureValue =
  | string
  | number
  | boolean
  | {
      label?: string
      secondary_label?: string
      asterisk?: boolean
      value?: string | number
    }

export interface ITag {
  type: string[]
  classes: string[]
  children: Displayable[]
}
