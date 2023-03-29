import { isArray, isNil } from "lodash"

import { FeatureCollection } from "./collection"

// import BaseFeature, { FeatureTemplate } from "./base"
import GenericFeature from "./variants/generic"
import AdvantageFeature from "./variants/advantage"
import SkillFeature from "./variants/skill"
import SpellFeature from "./variants/spell"
import EquipmentFeature from "./variants/equipment"
import WeaponFeature from "./variants/weapon"
import Feature, { FeatureTemplate } from "../../foundry/actor/feature"

export type FeatureFactoryTypes = `base` | `generic` | `advantage` | `skill` | `spell` | `equipment` | `weapon`

export default class FeatureFactory {
  cls(type: FeatureFactoryTypes): typeof Feature {
    if (type === `base`) return Feature
    // else if (type === `generic`) return GenericFeature
    // else if (type === `advantage`) return AdvantageFeature
    // else if (type === `skill`) return SkillFeature
    // else if (type === `spell`) return SpellFeature
    // else if (type === `equipment`) return EquipmentFeature
    // else if (type === `weapon`) return WeaponFeature

    throw new Error(`Feature of type "${type}" is not implemented`)
  }

  build<TFeature extends Feature<any, any>>(type: FeatureFactoryTypes, id: string, key: string | number, parent: Feature<any, any> | null, template: FeatureTemplate): Feature {
    const cls = this.cls(type)

    const instance = new cls(id, key, parent, template)
    instance.factory = this

    return instance as TFeature
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
  parse<TFeature extends BaseFeature>(type: FeatureFactoryTypes, GCS: object, prefix = `system.`, parent: TFeature | null, template: FeatureTemplate<unknown> = {}) {
    const collection = new FeatureCollection()
    if (!GCS) return collection
    const map = isArray(GCS) ? Object.fromEntries(GCS.map((c, i) => [i, c])) : GCS

    if (!map) debugger
    for (const [key, gcs] of Object.entries(map)) {
      const feature = this.build(type, key, prefix, parent, template)
      feature.addSource(`gcs`, gcs)
      feature.compile()
      collection.add(feature)

      if (!isNil(gcs.children)) {
        const children = isArray(gcs.children) ? Object.fromEntries(gcs.children.map((c, i) => [i, c])) : gcs.children

        const childrenCollection = this.parse(type, children, `${prefix}${key}.children.`, feature, template)
        feature.children.push(...childrenCollection.items)
        collection.add(...childrenCollection.items)
      }
    }

    return collection
  }
}
