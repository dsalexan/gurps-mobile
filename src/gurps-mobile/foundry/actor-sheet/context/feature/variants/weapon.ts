import { flatten, flattenDeep, get, isArray, isNil, isNumber, isString, orderBy, set, uniq } from "lodash"
import { FeatureBaseContextSpecs } from "../base"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../../context"
import { FastDisplayable, IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "../interfaces"
import TagBuilder, { PartialTag } from "../../tag"
import { IFeatureValue } from "../interfaces"
import ContextManager from "../../manager"
import { isNilOrEmpty, push } from "../../../../../../december/utils/lodash"
import { ILevelDefinition, ILevel, orderLevels, parseLevelDefinition, nonSkillOrTrainedSkillTargets } from "../../../../../../gurps-extension/utils/level"
import BaseFeature from "../../../../../core/feature/base"
import { GurpsMobileActor } from "../../../../actor/actor"
import WeaponFeature from "../../../../actor/feature/weapon"

export interface WeaponFeatureContextSpecs extends FeatureBaseContextSpecs {
  feature: WeaponFeature
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
    const actor = getSpec(specs, `actor`)

    // ERROR: Unimplemented actorless feature
    if (!actor) debugger

    // GET ALL TRAINED SKILLS
    const allTrainedSkills = Object.values(actor.cache._skill?.trained ?? {}).filter(skill => skill.data.training === `trained`)
    const trainedSkillsGCA = allTrainedSkills.map(feature => feature.sources.gca?._index).filter(index => !isNil(index))

    // set usage as label
    if (!_variants[0].label) _variants[0].label = {}
    _variants[0].label.main = feature.data.usage ?? undefined

    // if there is no defaults attached to weapon, just returns its default main variant
    if (isNil(feature.data.defaults) || feature.data.defaults.length === 0) {
      _variants[0].value = undefined
      return _variants
    }

    const main = _variants[0]

    // use first variant as a model for weapon skills -> FeatureVariant[]
    const variants = [] as IFeatureDataVariant[]

    // split into viable/unviable defaults
    //    usually a viable default is a trained skill default OR a attribute default
    //    usually a unviable default is a untrained/unknown skill default
    // split trained/untrained skills
    const unviable = [] as ILevelDefinition[],
      viable = [] as { definition: ILevelDefinition; level: ILevel }[]

    const definitions = feature.data.defaults ?? []
    for (const defaultDefinition of definitions) {
      // viability check
      const targets = nonSkillOrTrainedSkillTargets(defaultDefinition, trainedSkillsGCA)

      // ERROR: Untested, no targets to begin with
      if (Object.keys(defaultDefinition.targets ?? {}).length === 0) debugger

      // if all targets pass viability check, then default IS viable
      if (targets.length === Object.keys(defaultDefinition.targets ?? {}).length) {
        const level = defaultDefinition.parse(feature as any, actor) ?? { level: -Infinity }

        viable.push({ definition: defaultDefinition, level })
      } else unviable.push(defaultDefinition)
    }

    // show unviable defaults as tags
    const unviableTag = unviable.length && {
      classes: `box`,
      children: [
        { icon: `untrained_skill` },
        {
          classes: `interactible`,
          label: `<b>${unviable.length}</b> skills`,
        },
        // ...untrained.map(skill => {
        //   return {
        //     label: `${skill.fullName ?? skill.attribute.toUpperCase()}${parseModifier(skill.modifier)}`,
        //   }
        // }),
      ],
    }

    // order defaults by level, and for each default, yield a variant
    const viableDefaults = orderBy(viable, ({ level }) => level.level, `desc`)
    for (const default_ of viableDefaults) {
      const variant = deepClone(main)

      variant.id = `skill-variant`

      const tags = new TagBuilder(variant.tags)
      // tags.at(0).remove() // remove type tag

      // USAGE
      if (isNil(variant.label)) {
        const prefix = ``
        // const prefix = `<div class="wrapper-icon"><i class="icon">${Handlebars.helpers[`gurpsIcon`](`skill`)}</i></div>`
        variant.label = { main: `${prefix}${default_.level.relative?.toString()}` }
      }
      // if (feature.usage) {
      //   tags.type(`type`).update(tag => {
      //     tag.children.push({ label: feature.usage })
      //     return tag
      //   })
      // }

      // NON-TRAINED ALTERNATIVE SKILLS
      // WHAT?
      if (unviableTag) tags.type(`type`).push(unviableTag)

      // VALUE
      variant.value = {
        value: default_.level.level,
        label: default_.level.relative?.toString({ skillAcronym: true }),
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
    const actor = getSpec(specs, `actor`)

    let variant = variants[0] ?? { classes: [] }

    const tags = new TagBuilder(variant.tags)

    if (specs.showParent && feature.parent) {
      if (!variant.label) variant.label = {}

      let suffix = ``
      if (!isNilOrEmpty(feature.data.usage) && !specs.ignoreUsage && feature.data.usage !== variant.label.main) {
        // suffix = ` <span style="opacity: 0.75; font-weight: 400; color: rgb(var(--light-main-color), 0.95);">${feature.parent.data.name}</span>`
        suffix = ` (${feature.data.usage})`
      }
      // variant.label.main = `${}`
      variant.label.secondary = `${feature.parent.data.name}${suffix}`

      tags.type(`type`).update(tag => {
        tag.children[0].label = undefined
        tag.children.splice(
          0,
          0,
          {
            icon: feature.parent!.type.icon ?? undefined,
          },
          {
            classes: [`interactible`],
            label: feature.parent!.type.name,
          },
        )

        return tag
      })
    }

    let defaultLevels = feature.data.defaults
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
      // ERROR: Unimplemented actorless feature
      if (!actor) debugger

      const levels = orderLevels(defaultLevels, feature, actor)
      const level = levels[0]

      variant.value = {
        value: level.level,
        label: level.relative?.toString({ skillAcronym: true }),
      }
    }

    variant.stats = [
      {
        classes: [],
        icon: `minimal_parry`,
        value: 10,
        roll: 1,
      },
      {
        classes: [`disabled`],
        icon: `minimal_block`,
        value: `No`,
        roll: 2,
      },
      {
        classes: [],
        icon: `damage`,
        value: `2d-4 cut`,
        roll: 3,
      },
      // {
      //   classes: [],
      //   icon: `mdi-help`,
      //   value: `C, 1`,
      // },
      // {
      //   classes: [],
      //   icon: `mdi-help`,
      //   value: `???`,
      // },
    ]

    variant.rolls = [
      {
        classes: [],
        icon: `minimal_parry`,
        value: 10,
        step: 0,
      },
      {
        classes: [],
        icon: `minimal_parry`,
        value: 10,
        step: 1,
      },
      {
        classes: [],
        icon: `damage`,
        value: `2d-4 cut`,
        step: 3,
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
