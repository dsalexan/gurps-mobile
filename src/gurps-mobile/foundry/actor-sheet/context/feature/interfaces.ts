import { IRollContext } from "../../../../../gurps-extension/utils/roll"
import BaseFeature from "../../../../core/feature/base"
import GenericFeature from "../../../actor/feature/generic"
import { IContext } from "../context"

export interface Displayable {
  classes?: string[]
  label?: string
  value?: string | number
  icon?: string[]
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
  _feature: GenericFeature
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
  id: string
  //
  variants: IFeatureDataVariant[]
  actions: false | { left: IFeatureAction[]; right: IFeatureAction[] }
}

export type IFeatureStat = Displayable & { roll?: number }

export interface IFeatureDataVariant {
  classes: string[]
  id: string
  //
  icon?: {
    classes?: string[]
    main?: string
    secondary?: string
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
  stats?: [IFeatureStat[], IFeatureStat[]]
  rolls?: IRollContext[]
  tags: ITag[]
}

export interface IFeatureActionChild {
  classes: string[]
  icon?: string
}

export interface IFeatureAction {
  classes: string[]
  //
  children: IFeatureActionChild[]
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
