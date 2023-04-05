/* eslint-disable no-debugger */
import { isArray, isNil } from "lodash"

import { FeatureCollection } from "./collection"

// import BaseFeature, { FeatureTemplate } from "./base"
import SpellFeature from "./variants/spell"
import EquipmentFeature from "./variants/equipment"
import WeaponFeature from "./variants/weapon"
import Feature, { FeatureTemplate, IFeatureData } from "../../foundry/actor/feature"
import GenericFeature from "../../foundry/actor/feature/generic"
import AdvantageFeature from "../../foundry/actor/feature/advantage"
import SkillFeature from "../../foundry/actor/feature/skill"
import { GenericSource } from "../../foundry/actor/feature/pipelines"
import { IGenericFeatureData } from "../../foundry/actor/feature/pipelines/generic"
import { IAdvantageFeatureData } from "../../foundry/actor/feature/pipelines/advantage"
import { ISkillFeatureData } from "../../foundry/actor/feature/pipelines/skill"

export type FeatureDataByType = {
  base: IFeatureData
  generic: IGenericFeatureData
  advantage: IAdvantageFeatureData
  skill: ISkillFeatureData
  // spell: IFeatureData
  // equipment: IFeatureData
  weapon: IGenericFeatureData
}

export default class FeatureFactory {
  cls<T extends keyof FeatureDataByType>(type: T) {
    if (type === `base`) return Feature
    else if (type === `generic`) return GenericFeature
    else if (type === `advantage`) return AdvantageFeature
    else if (type === `skill`) return SkillFeature
    // else if (type === `spell`) return SpellFeature
    // else if (type === `equipment`) return EquipmentFeature
    else if (type === `weapon`) return GenericFeature //WeaponFeature

    throw new Error(`Feature of type "${type}" is not implemented`)
  }

  build<TManualSource extends GenericSource = never, T extends keyof FeatureDataByType = keyof FeatureDataByType>(
    type: T,
    id: string,
    key: number | number[],
    parent?: Feature<any, any>,
    template?: FeatureTemplate,
  ): Feature<FeatureDataByType[T], TManualSource> {
    const cls = this.cls<T>(type)

    const instance = new cls(id, key, parent, template)
    instance.factory = this

    return instance as any
  }

  /**
   * Compile a GCS map and return it as a collection of features
   *
   * @param type
   * @param GCS
   * @param prefix
   * @param parent
   * @param template
   * @returns
   */
  GCS<TManualSource extends GenericSource = never, T extends keyof FeatureDataByType = keyof FeatureDataByType>(
    type: T,
    GCS: object,
    rootKey: number | number[],
    parent?: Feature<any, any>,
    template?: FeatureTemplate,
  ) {
    const collection = new FeatureCollection()
    if (!GCS) return collection
    const map = isArray(GCS) ? Object.fromEntries(GCS.map((c, i) => [i, c])) : GCS

    if (!map) debugger // COMMENT
    for (const [key, gcs] of Object.entries(map)) {
      if (isNaN(parseInt(key))) debugger // COMMENT
      if (gcs.id === undefined) debugger // COMMENT

      const feature = this.build(type, gcs.id, [...(isArray(rootKey) ? rootKey : [rootKey]), parseInt(key)], parent, template)
      feature.addSource(`gcs`, gcs)
      collection.add(feature as any)

      if (!isNil(gcs.children)) {
        const children = isArray(gcs.children) ? Object.fromEntries(gcs.children.map((c, i) => [i, c])) : gcs.children

        const childrenCollection = this.GCS(type, children, [], feature, template)
        feature.children.push(...(childrenCollection.items as any[]))
        collection.add(...childrenCollection.items)
      }
    }

    return collection
  }
}
