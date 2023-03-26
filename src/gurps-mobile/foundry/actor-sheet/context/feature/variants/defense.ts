import { flatten, flattenDeep, get, intersection, isArray, isNil, isNumber, isString, orderBy, set } from "lodash"
import { FeatureBaseContextSpecs } from "../base"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../../context"
import { IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "../interfaces"
import TagBuilder from "../../tag"
import { IFeatureValue } from "../interfaces"
import GenericFeature from "../../../../../core/feature/variants/generic"
import ContextManager from "../../manager"
import { orderLevels, parseLevelDefinition } from "../../../../../../gurps-extension/utils/level"
import BaseFeature from "../../../../../core/feature/base"
import { parseSign } from "../../../../../../gurps-extension/utils/bonus"
import { FeatureState, stateToString } from "../../../../../core/feature/utils"
import { activeDefenseFeatures, activeDefenseLevel, featureActiveDefenseLevel } from "../../../../../../gurps-extension/utils/defense"

export interface DefenseFeatureContextSpecs extends FeatureBaseContextSpecs {
  feature: GenericFeature
  //
  features?: GenericFeature[]
}

export default class DefenseFeatureContextTemplate extends BaseContextTemplate {
  static pre(context: IContext, specs: ContextSpecs, manager: ContextManager): IContext {
    super.pre(context, specs, manager)

    context._template.push(`defense-feature`)
    if (context._metadata?.childrenKeys === undefined) set(context, `_metadata.childrenKeys`, [])
    context._metadata?.childrenKeys.push([4, `features`])

    return context
  }

  static features(specs: DefenseFeatureContextSpecs, manager: ContextManager): IFeatureDataContext[] | null {
    const feature = getSpec(specs, `feature`)

    const activeDefense = feature.id.replace(`activedefense-`, ``)
    const features = activeDefenseFeatures(activeDefense as any, feature._actor)

    if (features.length === 0) return null

    const featuresWithDefense = features
      .map(feature => ({ feature, level: featureActiveDefenseLevel(activeDefense as any, feature, feature._actor) }))
      .filter(({ level }) => level !== null)

    const related = orderBy(featuresWithDefense, def => def.level.skill.level + def.level.bonus, `desc`)

    const data = [] as IFeatureDataContext[]
    for (const { feature, level } of related) {
      const context = manager.feature(feature, { showParent: true } as any)

      const main = context.children.main[0]
      main.actions = false
      main.variants[0].buttons = undefined
      main.variants[0].classes.push(`value-interactible`)
      main.variants[0].notes = undefined
      main.variants[0].value = {
        value: level.skill.level + level.bonus,
      }

      main.variants[0].tags = main.variants[0].tags
        .map(tag => {
          tag.children = tag.children.filter(child => !child.classes?.includes(`quantity`))
          return tag
        })
        .filter(tag => tag.children.length > 0)
        .filter(tag => intersection(tag.type, [`feature`, `weight`, `cost`]).length === 0)

      data.push(main)
    }

    if (data.length === 0) return null
    return data
  }

  /**
   * Build main data-variant of feature
   */
  static main(variants: IFeatureDataVariant[], specs: DefenseFeatureContextSpecs, manager: ContextManager): IFeatureDataVariant[] {
    const feature = getSpec(specs, `feature`)
    const actor = feature._actor

    let variant = variants[0] ?? {}

    const activeDefense = feature.id.replace(`activedefense-`, ``)
    const features = activeDefenseFeatures(activeDefense as any, feature._actor)
    const components = actor.getComponents(`attribute_bonus`, component => component.attribute === activeDefense, null)

    // const mark = ((feature.__compilation.sources.gcs as any).default ? `Ruler` : undefined) as string | undefined
    // const classes = [...(variant.classes ?? []), !!mark && `marked`] as string[]

    // VALUE
    if (features.length === 0) {
      const adl = activeDefenseLevel(activeDefense as any, actor, true)

      let value = {} as IFeatureValue
      if (adl) value = { value: adl.bonus + adl.skill.level }
      else value = { value: `-` }

      variant.classes.push(`value-interactible`)
      variant.value = value
    }

    // // LINKS
    // const links = feature.links ?? []

    // // COMPOUNDING TAGS
    // const tags = new TagBuilder(variant.tags ?? [])
    // tags.add(...links)

    // if (tags.tags.length > 0) value.asterisk = true

    // TAGS
    const tags = new TagBuilder(variant.tags)

    tags.tags = tags.tags
      .map(tag => {
        tag.children = tag.children.filter(child => !child.classes?.includes(`state`))
        return tag
      })
      .filter(tag => tag.children.length > 0)

    for (const component of components) {
      if (isNil(component.amount)) continue

      const isFeatureActive = [FeatureState.PASSIVE, FeatureState.ACTIVE].some(state => component.feature.state & state)
      const stringState = ` <span style="opacity: 0.5; margin-left: var(--s0-5); color: white;">${stateToString(component.feature.state)}</span>`

      tags.add({
        type: `bonus`,
        classes: [`box`],
        children: [
          {
            icon: component.feature.type.icon ?? undefined,
          },
          {
            classes: [`interactible`].concat(!isFeatureActive ? [`italic`, `regular`, `discreet`] : []),
            label: `${component.feature.specializedName}${isFeatureActive ? `` : stringState}`,
          },
          {
            classes: [isFeatureActive ? `bold` : `risked`],
            label: isFeatureActive ? parseSign(component.amount) : `(${parseSign(component.amount)})`,
          },
        ],
      })
    }

    // variant = {
    //   ...(variant ?? {}),
    //   classes,
    //   //
    //   value,
    //   mark,
    //   //
    //   tags: tags.tags,
    // }

    variant.tags = tags.tags
    return [variant]
  }

  static base(context: IFeatureContext, specs: DefenseFeatureContextSpecs, manager: ContextManager): IFeatureContext {
    super.base(context, specs, manager)

    const children = get(context, `children`) ?? {}

    // COMPOUNDING CLASSES
    // const classes = [...(context.classes ?? []), `set-move-default`]

    const main = this.main(children.main?.[0]?.variants ?? [], specs, manager)
    if (main) set(children, `main.0.variants`, main)

    const features = this.features(specs, manager)
    if (features) children.features = features

    context = {
      ...context,
      //
      children,
      //
      // classes: [...new Set(classes)],
      //
    }

    return context
  }
}
