import { flatten, flattenDeep, get, intersection, isArray, isNil, isNumber, isString, orderBy, set, sum } from "lodash"
import { FeatureBaseContextSpecs } from "../base"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../../context"
import { IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "../interfaces"
import TagBuilder, { FastTag } from "../../tag"
import { IFeatureValue } from "../interfaces"
import ContextManager from "../../manager"
import { orderLevels, parseLevelDefinition } from "../../../../../../gurps-extension/utils/level"
import BaseFeature from "../../../../../core/feature/base"
import { parseBonus, parseSign } from "../../../../../../gurps-extension/utils/bonus"
import { FeatureState, stateToString } from "../../../../../core/feature/utils"
import { activeDefenseFeatures, activeDefenseLevel, featureActiveDefenseLevel } from "../../../../../../gurps-extension/utils/defense"
import GenericFeature from "../../../../actor/feature/generic"

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

  static features(defense, specs: DefenseFeatureContextSpecs, manager: ContextManager): IFeatureDataContext[] | null {
    const feature = getSpec(specs, `feature`)

    const { activeDefense, components, adls } = defense
    const actorBonus = sum(components.map(component => component.amount))

    if (adls.length === 0) return null

    const data = [] as IFeatureDataContext[]
    for (const { level, bonus, ignoreSpecialization, skill, weapon, equivalentUsages, equivalentSkills } of adls) {
      if (weapon === undefined) continue
      const context = manager.feature(weapon, { showParent: true, ignoreSpecialization, ignoreUsage: activeDefense === `block` } as any)

      const main = context.children.main[0]
      main.actions = false
      main.variants[0].buttons = undefined
      main.variants[0].classes.push(`value-interactible`)
      main.variants[0].notes = undefined
      main.variants[0].value = {
        value: level + bonus + actorBonus,
      }

      const tags = new TagBuilder(main.variants[0].tags)

      // information about skill
      const stringTrained = ` <span style="opacity: 0.5; margin-left: var(--s0-5); color: white;">${`Untrained`}</span>`
      tags.add({
        type: `skill`,
        classes: [`box`],
        children: [
          {
            icon: skill.type.icon ?? undefined,
          },
          {
            classes: [`interactible`],
            label: `${ignoreSpecialization ? skill.name : skill.specializedName}${skill.training === `untrained` ? `` : stringTrained}`,
          },
          {
            label: skill.calcLevel().level.toString(),
          },
        ],
      })

      // showing number of equivalent skills
      const ESN = equivalentSkills.filter(s => s.id !== skill.id).length
      if (ESN > 0)
        tags.add({
          type: `skill`,
          classes: [`box`],
          children: [
            {
              classes: [`interactible`, `italic`, `regular`, `discreet`],
              label: `Equivalent skills`,
            },
            {
              label: ESN.toString(),
            },
          ],
        })

      main.variants[0].tags = tags.tags
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
  static main(defense, variants: IFeatureDataVariant[], specs: DefenseFeatureContextSpecs, manager: ContextManager): IFeatureDataVariant[] {
    const feature = getSpec(specs, `feature`)

    let variant = variants[0] ?? {}

    const { activeDefense, components, adls } = defense
    const actorBonus = sum(components.map(component => component.amount))

    const ADL = adls?.[0]
    const noSecondary = adls.every(adl => adl.weapon === undefined && adl.skill === undefined)

    // const mark = ((feature.sources.gcs as any).default ? `Ruler` : undefined) as string | undefined
    // const classes = [...(variant.classes ?? []), !!mark && `marked`] as string[]

    // VALUE
    let value = {} as IFeatureValue
    if (ADL) value = { value: ADL.level + ADL.bonus + actorBonus }
    else value = { value: `-` }

    variant.classes.push(`value-interactible`)
    if (!noSecondary) variant.classes.push(`hide-value-expanded`)
    variant.value = value

    // // LINKS
    // const links = feature.links ?? []

    // // COMPOUNDING TAGS
    // const tags = new TagBuilder(variant.tags ?? [])
    // tags.add(...links)

    // if (tags.tags.length > 0) value.asterisk = true

    // TAGS
    const tags = new TagBuilder(variant.tags)

    // remove state from defense
    tags.tags = tags.tags
      .map(tag => {
        tag.children = tag.children.filter(child => !child.classes?.includes(`state`))
        return tag
      })
      .filter(tag => tag.children.length > 0)

    // showing state for actor bonuses
    for (const component of components) {
      if (isNil(component.amount)) continue

      const isFeatureActive = [FeatureState.PASSIVE, FeatureState.ACTIVE].some(state => component.feature.state & state)
      const stringState = ` <span style="opacity: 0.5; margin-left: var(--s0-5); color: white;">${stateToString(component.feature.state)}</span>`

      tags.add({
        type: `bonus`,
        classes: [`box`, `collapsed`],
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

    // COLLAPSED
    //    showing tags of best option
    const newTags = [] as FastTag[]
    if (ADL && ADL.skill) {
      const stringTrained = ` <span style="opacity: 0.5; margin-left: var(--s0-5); color: white;">${`Untrained`}</span>`
      newTags.push({
        type: `skill`,
        classes: [`box`, `collapsed-only`],
        children: [
          {
            icon: ADL.skill.type.icon ?? undefined,
          },
          {
            classes: [`interactible`],
            label: `${ADL.ignoreSpecialization ? ADL.skill.name : ADL.skill.specializedName}${ADL.skill.training === `untrained` ? `` : stringTrained}`,
          },
          {
            label: ADL.skill.calcLevel().level.toString(),
          },
        ],
      })
    }

    if (ADL && ADL.weapon && ADL.bonus !== 0) {
      newTags.push({
        type: `weapon`,
        classes: [`box`, `collapsed-only`],
        children: [
          {
            icon: ADL.weapon.parent.type.icon ?? undefined,
          },
          {
            classes: [`interactible`],
            label: ADL.weapon.parent.name,
          },
          {
            label: parseSign(ADL.bonus),
          },
        ],
      })
    }

    tags.at(0).add(...newTags)

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

    const feature = getSpec(specs, `feature`)
    const actor = feature.actor

    // ERROR: Unimplemented actorless feature
    if (!actor) debugger

    const children = get(context, `children`) ?? {}

    const activeDefense = feature.id.replace(`activedefense-`, ``)
    const components = actor.getComponents(`attribute_bonus`, component => component.attribute === activeDefense, null)
    const adls = activeDefenseLevel(activeDefense as any, actor)

    // COMPOUNDING CLASSES
    // const classes = [...(context.classes ?? []), `set-move-default`]

    const main = this.main({ activeDefense, components, adls }, children.main?.[0]?.variants ?? [], specs, manager)
    if (main) set(children, `main.0.variants`, main)

    const features = this.features({ activeDefense, components, adls }, specs, manager)
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
