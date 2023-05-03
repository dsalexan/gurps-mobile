import { cloneDeep, flattenDeep, get, isArray, isNil, isNumber, isString, set } from "lodash"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../context"
import ContextManager from "../manager"
import { Displayable, IFeatureAction, IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "./interfaces"
import { isNilOrEmpty, push } from "../../../../../december/utils/lodash"
import LOGGER from "../../../../logger"
import TagBuilder, { FastTag } from "../tag"
import FeatureBaseContextTemplate from "./base"

import WeaponFeatureContextTemplate, { WeaponFeatureContextSpecs } from "./variants/weapon"
import GenericFeature from "../../../actor/feature/generic"

export interface FeatureWeaponsDataContextSpecs extends ContextSpecs {
  feature: GenericFeature
  //
  weapons: ContextSpecs
}

export interface IWeaponizableFeatureContext extends IContext {
  children: Record<string, IFeatureDataContext[]> & { weapons?: IFeatureDataContext[] }
}

export default class FeatureWeaponsDataContextTemplate extends BaseContextTemplate {
  static pre(context: IContext, specs: ContextSpecs, manager: ContextManager): IContext {
    super.pre(context, specs, manager)

    const feature = getSpec(specs, `feature`)
    const hasWeapons = feature.data.weapons && feature.data.weapons.length > 0

    if (hasWeapons) {
      context._template.push(`feature-weapons`)
      if (context._metadata?.childrenKeys === undefined) set(context, `_metadata.childrenKeys`, [])
      context._metadata?.childrenKeys.push([5, `weapons`])
    }

    return context
  }

  /**
   * Builds N FeatureData's, one for every weapon linked to feature
   */
  static weapons(data: IFeatureDataContext[], specs: FeatureWeaponsDataContextSpecs, manager: ContextManager): IFeatureDataContext[] | null {
    if (data === undefined) data = []
    const feature = getSpec(specs, `feature`)

    const hasWeapons = feature.data.weapons && feature.data.weapons.length > 0
    if (!hasWeapons) return null

    // WARN: Unimplemented pre-defined featureData array
    // eslint-disable-next-line no-debugger
    if (data.length > 0) debugger

    const weaponsSpecs = get(specs, `weapons`) ?? {}

    for (const weapon of feature.data.weapons) {
      const _specs = { ...cloneDeep(weapon.__.context.specs ?? {}), ...cloneDeep(weaponsSpecs) } as WeaponFeatureContextSpecs
      _specs.list = specs.list
      push(_specs, `innerClasses`, `swipe-variant`)

      const context = manager.feature(weapon, _specs)

      const main = context.children.main[0]
      main.id = `weapon-${weapon.id}`
      main.variants = WeaponFeatureContextTemplate.skillsVariants(main.variants, _specs, manager)

      main.actions = false
      main.classes = main.classes.filter(classe => classe !== `has-swipe`)

      const expanded = get(specs, `expanded`)?.(feature.id, main.id) ?? false

      if (expanded && !main.classes.includes(`expanded`)) main.classes.push(`expanded`)
      else if (!expanded && main.classes.includes(`expanded`)) main.classes = main.classes.filter(classe => classe !== `expanded`)

      data.push(main)
    }

    if (data.length === 0) return null
    return data
  }

  static base(context: IFeatureContext, specs: FeatureWeaponsDataContextSpecs, manager: ContextManager): IWeaponizableFeatureContext {
    super.base(context, specs, manager)

    const children = get(context, `children`) ?? {}

    const weapons = this.weapons(children.weapons, specs, manager)
    if (!weapons) return context

    context = {
      ...context,
      // {key: FeatureData} -> {main, ...secondaries}
      children: {
        ...children,
        weapons,
      },
    }

    return context
  }
}
