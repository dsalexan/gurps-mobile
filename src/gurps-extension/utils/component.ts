import BaseFeature from "../../gurps-mobile/core/feature/base"
import { GCS } from "../types/gcs"

export interface IComponentDefinition {
  feature: BaseFeature
  type: string
  attribute?: string
  ammount?: number
}

export function parseComponentDefinition(raw: GCS.Feature) {
  return raw as IComponentDefinition
}
