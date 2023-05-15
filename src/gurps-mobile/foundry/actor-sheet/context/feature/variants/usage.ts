import { flatten, flattenDeep, get, isArray, isNil, isNumber, isString, orderBy, set, uniq } from "lodash"
import { FeatureBaseContextSpecs } from "../base"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../../context"
import { Displayable, FastDisplayable, IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "../interfaces"
import TagBuilder, { PartialTag } from "../../tag"
import { IFeatureValue } from "../interfaces"
import ContextManager from "../../manager"
import { isNilOrEmpty, isNumeric, push } from "../../../../../../december/utils/lodash"
import { ILevelDefinition, ILevel, parseLevelDefinition, levelToHTML, calculateLevel, nonSkillOrAllowedSkillVariables } from "../../../../../../gurps-extension/utils/level"
import BaseFeature from "../../../../../core/feature/base"
import { GurpsMobileActor } from "../../../../actor/actor"
import FeatureUsage from "../../../../actor/feature/usage"
import { createRoll, parseRollContext, parseRollContextWithContent } from "../../../../../../gurps-extension/utils/roll"
import { parseModifier } from "../../../../../core/feature/utils"

export interface FeatureUsageContextSpecs extends FeatureBaseContextSpecs {
  //
  showParent?: boolean
  showDefaults?: boolean
  difficulty?: boolean
  ignoreUsage?: boolean
}

export default class FeatureUsageContextTemplate extends BaseContextTemplate {
  static pre(context: IContext, specs: ContextSpecs, manager: ContextManager): IContext {
    super.pre(context, specs, manager)

    context._template.push(`feature-usage`)

    return context
  }

  /**
   * Builds weapon skills as FeatureVariant[]
   */
  static skillsVariants(_variants: IFeatureDataVariant[], specs: FeatureUsageContextSpecs, manager: ContextManager): IFeatureDataVariant[] {
    const feature = getSpec(specs, `feature`) as FeatureUsage
    const actor = getSpec(specs, `actor`)

    // ERROR: Unimplemented actorless feature
    if (!actor) debugger

    debugger

    // GET ALL TRAINED SKILLS
    const allTrainedSkills = Object.values(actor.cache._skill?.trained ?? {}).filter(skill => skill.data.training === `trained`)
    const trainedSkillsGCA = allTrainedSkills.map(feature => feature.sources.gca?._index).filter(index => !isNil(index))

    // set usage as label
    if (!_variants[0].label) _variants[0].label = {}
    _variants[0].label.main = feature.data.name ?? undefined

    // if there is no rolls attached to usage, just returns its default main variant
    if (isNil(feature.data.rolls) || feature.data.rolls.length === 0) {
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
      viable = [] as ILevel[]

    const definitions = feature.data.rolls ?? []
    for (const defaultDefinition of definitions) {
      // viability check
      const variables = nonSkillOrAllowedSkillVariables(defaultDefinition, trainedSkillsGCA)

      // ERROR: Untested, no variables to begin with
      if (Object.keys(defaultDefinition.variables ?? {}).length === 0) debugger

      // if all variables pass viability check, then default IS viable
      if (variables.length === Object.keys(defaultDefinition.variables ?? {}).length) {
        debugger
        // calculate level should be source feature, right? (since FeatureUsage is not a GCA concept, most of the formulas would not require a me::)
        const level = calculateLevel(defaultDefinition, feature, actor) ?? ({ value: -Infinity, definition: defaultDefinition } as any as ILevel)

        viable.push(level)
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
    const viableDefaults = orderBy(viable, level => level.value, `desc`)
    for (const level of viableDefaults) {
      const variant = deepClone(main)

      variant.id = `skill-variant`

      const tags = new TagBuilder(variant.tags)
      // tags.at(0).remove() // remove type tag

      // USAGE
      if (isNil(variant.label)) {
        const prefix = ``
        // const prefix = `<div class="wrapper-icon"><i class="icon">${Handlebars.helpers[`gurpsIcon`](`skill`)}</i></div>`
        variant.label = { main: `${prefix}${levelToHTML(level, { acronym: true })}` }
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
        value: level.value,
        label: levelToHTML(level, { acronym: true }),
      }

      if (!variant.rolls) variant.rolls = []

      // TODO: Add in content explanation of modifiers sources (proficiency, actor components, defaults, etc)
      variant.rolls[0] = parseRollContext(createRoll(level, `regular`), 0)

      variants.push({ ...variant, tags: tags.tags })
    }

    return variants
  }

  /**
   * Build main data-variant of feature
   */
  static main(variants: IFeatureDataVariant[], specs: FeatureUsageContextSpecs, manager: ContextManager): IFeatureDataVariant[] {
    const feature = getSpec(specs, `feature`) as FeatureUsage
    const actor = getSpec(specs, `actor`)

    let variant = variants[0] ?? { classes: [] }

    const tags = new TagBuilder(variant.tags)

    if (specs.showParent && feature.parent) {
      if (!variant.label) variant.label = {}

      // let suffix = ``
      // if (!isNilOrEmpty(feature.data.usage) && !specs.ignoreUsage && feature.data.usage !== variant.label.main) {
      //   // suffix = ` <span style="opacity: 0.75; font-weight: 400; color: rgb(var(--light-main-color), 0.95);">${feature.parent.data.name}</span>`
      //   suffix = ` (${feature.data.usage})`
      // }
      // // variant.label.main = `${}`
      // variant.label.secondary = `${feature.parent.data.name}${suffix}`

      variant.label.main = feature.parent.data.name
      variant.label.secondary = feature.data.usage ?? undefined

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

    let rolls = feature.data.rolls
    if (isNil(rolls)) {
      rolls = [parseLevelDefinition({ type: `dx` })]

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

    if (!isNil(rolls) && rolls.length > 0) {
      // ERROR: Unimplemented actorless feature
      if (!actor) debugger

      debugger
      // calculate level should be source feature, right? (since FeatureUsage is not a GCA concept, most of the formulas would not require a me::)
      const levels = rolls.map(definition => calculateLevel(definition, feature, actor)).filter(l => !isNil(l))
      const orderedLevels = orderBy(levels, def => def!.value, `desc`)
      const level = orderedLevels[0]!

      // ERROR: Untested
      if (isNil(level)) debugger

      variant.value = {
        value: level.value,
        label: levelToHTML(level, { acronym: true }),
      }

      if (!variant.rolls) variant.rolls = []
      // TODO: Add in content explanation of modifiers sources (proficiency, actor components, defaults, etc)
      variant.rolls.push(parseRollContextWithContent([{ primary: `To Hit`, secondary: feature.data.name ?? undefined }], createRoll(level, `regular`), variant.rolls.length))
    }

    if (!variant.stats) variant.stats = [[], []]
    if (!variant.rolls) variant.rolls = []

    /**
     * TODO: Stats Sources
     *    shots
     *    bulk
     *    ammo
     */

    // if (feature.parent?.data?.name === `Light Cloak`) debugger

    // if (spacer) variant.stats[0].push({ classes: [`spacer`] })

    if (!isNil(feature.data.damage)) {
      if (feature.data.damage.type !== `-` && !(feature.data.damage.base === undefined && feature.data.damage.type.match(/special/i))) {
        let base = feature.data.damage.base
        if (base === undefined) {
          base = feature.data.damage.st === `sw` ? actor.system.swing : actor.system.thrust
        }

        variant.stats[0].push({
          classes: [],
          icon: [`damage`],
          value: `${base} ${feature.data.damage.type}`,
          roll: variant.rolls.length,
        })

        // TODO: Add in content explanation of modifiers sources (proficiency, actor components, defaults, etc)
        variant.rolls.push(parseRollContextWithContent([{ primary: `Damage` }], createRoll(base, `damage`, feature.data.damage), variant.rolls.length))
      }
    }

    if (!isNil(feature.data.reach)) {
      variant.stats[0].push({
        classes: [],
        icon: [`mdi-hexagon-slice-6`],
        // icon: feature.data.reach.map(letter => (isNumeric(letter) ? `mdi-numeric-${letter}` : `mdi-alpha-${letter}`)),
        value: `${feature.data.reach.join(`, `)}`,
      })
    }

    if (!isNil(feature.data.range)) {
      const range = feature.data.range

      // ERROR: Unimplemented
      if (range.startsWith(`x`)) debugger

      variant.stats[0].push({
        classes: [],
        icon: [`mdi-hexagon-slice-6`],
        value: `${range}`,
      })
    }

    if (!isNil(feature.data.accuracy)) {
      variant.stats[0].push({
        classes: [],
        icon: [`mdi-target`],
        value: `${feature.data.accuracy}`,
      })
    }

    if (!isNil(feature.data.rof) && feature.data.rof != `1`) {
      variant.stats[0].push({
        classes: [],
        icon: [`mdi-alpha-r`, `mdi-alpha-o`, `mdi-alpha-f`],
        value: `${feature.data.rof}`,
      })
    }

    if (!isNil(feature.data.recoil) && feature.data.recoil != `1`) {
      variant.stats[0].push({
        classes: [],
        icon: [`mdi-pistol`],
        value: `${feature.data.recoil}`,
      })
    }

    if (!isNil(feature.data.minimumStrength)) {
      variant.stats[0].push({
        classes: [],
        icon: [`mdi-dumbbell`],
        value: `${feature.data.minimumStrength}`,
      })
    }

    // TODO: Implement
    // if (!isNil(feature.data.shots)) debugger
    // if (!isNil(feature.data.bulk)) debugger
    // if (!isNil(feature.data.ammo)) debugger

    // active defenses
    const activeDefenses = [`block`, `parry`, `dodge`]
    for (const defense of activeDefenses) {
      const value = feature.data[defense]

      if (value !== false && !isNil(value)) {
        variant.stats[1]!.push({
          classes: [],
          icon: [`minimal_${defense}`],
          value: `X${parseModifier(value, [`-`, `+`], `+0`)}`,
          roll: variant.rolls.length,
        })

        // TODO: Add in content explanation of modifiers sources (proficiency, actor components, defaults, etc)
        variant.rolls.push(
          parseRollContextWithContent([{ primary: defense.capitalize() }], createRoll(`X${parseModifier(value, [`-`, `+`], `+0`)}`, `custom`), variant.rolls.length),
        )
      }
    }

    variant.tags = tags.tags
    return [variant]
  }

  static base(context: IFeatureContext, specs: FeatureUsageContextSpecs, manager: ContextManager): IFeatureContext {
    super.base(context, specs, manager)

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
