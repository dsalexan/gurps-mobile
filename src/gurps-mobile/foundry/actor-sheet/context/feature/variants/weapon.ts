import { flatten, flattenDeep, get, isArray, isNil, isNumber, isString, orderBy, set, uniq } from "lodash"
import { FeatureBaseContextSpecs } from "../base"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../../context"
import { FastDisplayable, IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "../interfaces"
import TagBuilder, { PartialTag } from "../../tag"
import { IFeatureValue } from "../interfaces"
import ContextManager from "../../manager"
import { isNilOrEmpty, push } from "../../../../../../december/utils/lodash"
import { IWeaponFeature } from "../../../../../core/feature/compilation/templates/weapon"
import WeaponFeature from "../../../../../core/feature/variants/weapon"
import { ILevelDefinition, ILevel, orderLevels, parseLevelDefinition } from "../../../../../../gurps-extension/utils/level"
import BaseFeature from "../../../../../core/feature/base"
import { GurpsMobileActor } from "../../../../actor/actor"

export interface WeaponFeatureContextSpecs extends FeatureBaseContextSpecs {
  feature: IWeaponFeature
  //
  showParent?: boolean
  showDefaults?: boolean
  difficulty?: boolean
  ignoreUsage?: boolean
}

export default class WeaponFeatureContextTemplate extends BaseContextTemplate {
  static pre(context: IContext, specs: ContextSpecs, manager: ContextManager): IContext {
    super.pre(context, specs, manager)

    context._template.push(`weapon-feature`)

    return context
  }

  /**
   * Builds weapon skills as FeatureVariant[]
   */
  static skillsVariants(_variants: IFeatureDataVariant[], specs: WeaponFeatureContextSpecs, manager: ContextManager): IFeatureDataVariant[] {
    const feature = getSpec(specs, `feature`)
    const actor = (feature as any)._actor

    // set usage as label
    _variants[0].label = feature.usage ?? undefined

    // if there is no defaults attached to weapon, just returns its default main variant
    if (isNil(feature.levels) || feature.levels.length === 0) {
      _variants[0].value = undefined
      return _variants
    }

    const main = _variants[0]

    // use first variant as a model for weapon skills -> FeatureVariant[]
    const variants = [] as IFeatureDataVariant[]

    // split trained/untrained skills
    const untrained = [] as ILevelDefinition[],
      trained = [] as { definition: ILevelDefinition; level: ILevel }[]

    const levels = feature.levels ?? []
    for (const levelDefinition of levels) {
      const targets = Object.values(levelDefinition.targets ?? [])

      const allSkillsAreTrained = targets.every(target => {
        if (target.type !== `skill`) return true

        return !isNil(actor.cache._skill?.trained?.[target.fullName])
      })

      if (allSkillsAreTrained || targets.length === 0) {
        trained.push({
          definition: levelDefinition,
          level: levelDefinition.parse(feature as any, actor) ?? { level: -Infinity },
        })
      } else untrained.push(levelDefinition)
    }

    // if there is some untrained skills, show it
    const untrainedTag = untrained.length && {
      classes: `box`,
      children: [
        { icon: `untrained_skill` },
        {
          classes: `interactible`,
          label: `<b>${untrained.length}</b> skills`,
        },
        // ...untrained.map(skill => {
        //   return {
        //     label: `${skill.fullName ?? skill.attribute.toUpperCase()}${parseModifier(skill.modifier)}`,
        //   }
        // }),
      ],
    }

    // order skills by level, and for each skill, yield a variant
    const levelssByLevel = orderBy(trained, ({ level }) => level.level, `desc`)
    for (const levels of levelssByLevel) {
      const variant = deepClone(main)

      const tags = new TagBuilder(variant.tags)
      // tags.at(0).remove() // remove type tag

      // USAGE
      if (isNil(variant.label)) {
        const prefix = ``
        // const prefix = `<div class="wrapper-icon"><i class="icon">${Handlebars.helpers[`gurpsIcon`](`skill`)}</i></div>`
        variant.label = `${prefix}${levels.level.relative?.toString()}`
      }
      // if (feature.usage) {
      //   tags.type(`type`).update(tag => {
      //     tag.children.push({ label: feature.usage })
      //     return tag
      //   })
      // }

      // NON-TRAINED ALTERNATIVE SKILLS
      // WHAT?
      if (untrainedTag) tags.type(`type`).push(untrainedTag)

      // VALUE
      variant.value = {
        value: levels.level.level,
        label: levels.level.relative?.toString({ skillAcronym: true }),
      }

      variants.push({ ...variant, tags: tags.tags })
    }

    return variants
  }

  /**
   * Build main data-variant of feature
   */
  static main(variants: IFeatureDataVariant[], specs: WeaponFeatureContextSpecs, manager: ContextManager): IFeatureDataVariant[] {
    const feature = getSpec(specs, `feature`)
    let variant = variants[0] ?? { classes: [] }

    variant.classes.push(`value-interactible`)
    const tags = new TagBuilder(variant.tags)

    if (specs.showParent && feature.parent) {
      let suffix = ``
      if (!isNilOrEmpty(feature.usage) && !specs.ignoreUsage) {
        suffix = ` <span style="opacity: 0.75; font-weight: 400; color: rgb(var(--light-main-color), 0.95);">(${feature.usage})</span>`
      }
      variant.label = `${feature.parent.name}${suffix}`

      tags.type(`type`).update(tag => {
        tag.children[0].label = undefined
        tag.children.splice(
          0,
          0,
          {
            icon: feature.parent.type.icon ?? undefined,
          },
          {
            classes: [`interactible`],
            label: feature.parent.type.name,
          },
        )

        return tag
      })
    }

    let defaultLevels = feature.levels
    if (isNil(defaultLevels)) {
      defaultLevels = [parseLevelDefinition({ type: `dx` })]

      tags.type(`parent`, `type`).push({
        type: `feature`,
        classes: [`box`],
        children: [
          {
            label: `Default`,
          },
          {
            classes: [`bold`],
            label: `DX`,
          },
        ],
      })
    }

    if (!isNil(defaultLevels) && defaultLevels.length > 0) {
      const levels = orderLevels(defaultLevels, feature, feature._actor)
      const level = levels[0]

      variant.value = {
        value: level.level,
        label: level.relative?.toString({ skillAcronym: true }),
      }
    }

    variant.buttons = [
      {
        classes: [],
        icon: `minimal_parry`,
        value: 10,
      },
      {
        classes: [`disabled`],
        icon: `minimal_block`,
        value: `No`,
      },
      {
        classes: [`small`],
        icon: `damage`,
        value: `2d-4 cut`,
      },
      {
        classes: [`small`],
        icon: `mdi-help`,
        value: `C, 1`,
      },
      {
        classes: [`small`],
        icon: `mdi-help`,
        value: `???`,
      },
    ]

    variant.tags = tags.tags
    return [variant]
  }

  static base(context: IFeatureContext, specs: WeaponFeatureContextSpecs, manager: ContextManager): IFeatureContext {
    super.base(context, specs, manager)

    const feature = getSpec(specs, `feature`)
    const children = get(context, `children`) ?? {}

    // COMPOUNDING CLASSES
    const classes = [...(context.classes ?? []), `inline-tags`, `top-marked`]

    const main = this.main(children.main?.[0]?.variants ?? [], specs, manager)
    if (main) set(children, `main.0.variants`, main)

    context = {
      ...context,
      //
      children,
      //
      classes: uniq(classes),
      //
    }

    return context
  }
}
