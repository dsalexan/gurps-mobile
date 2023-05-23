import { flatten, flattenDeep, get, intersection, isArray, isNil, isNumber, isString, orderBy, set, uniq } from "lodash"
import { FeatureBaseContextSpecs } from "../base"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../../context"
import { Displayable, FastDisplayable, IFeatureContext, IFeatureDataContext, IFeatureDataVariant, ITag } from "../interfaces"
import TagBuilder, { FastTag, PartialTag } from "../../tag"
import { IFeatureValue } from "../interfaces"
import ContextManager from "../../manager"
import { isNilOrEmpty, isNumeric, push } from "../../../../../../december/utils/lodash"
import {
  ILevelDefinition,
  ILevel,
  parseLevelDefinition,
  levelToHTML,
  calculateLevel,
  nonSkillVariables,
  allowedSkillVariables,
  levelToString,
  prepareLevel,
  viabilityTest,
} from "../../../../../../gurps-extension/utils/level"
import BaseFeature from "../../../../../core/feature/base"
import { GurpsMobileActor } from "../../../../actor/actor"
import FeatureUsage from "../../../../actor/feature/usage"
import { createRoll, parseRollContext, parseRollContextWithContent } from "../../../../../../gurps-extension/utils/roll"
import { FeatureState, parseModifier, stateToString } from "../../../../../core/feature/utils"
import GenericFeature from "../../../../actor/feature/generic"
import { IHitTargetMelee, IHitTargetRanged, IUsageEffectDamage, getUsageType } from "../../../../actor/feature/pipelines/usage/usage"
import { parseSign } from "../../../../../../gurps-extension/utils/bonus"
import mathInstance, { preprocess } from "../../../../../../december/utils/math"
import LOGGER from "../../../../../logger"
import SkillFeature from "../../../../actor/feature/skill"

export interface FeatureUsageContextSpecs extends FeatureBaseContextSpecs {
  //
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
   * Builds usage skills as FeatureVariant[]
   */
  static skillsVariants(_variants: IFeatureDataVariant[], specs: FeatureUsageContextSpecs, manager: ContextManager): IFeatureDataVariant[] {
    const usage = getSpec(specs, `feature`) as FeatureUsage
    const parentFeature = usage.parent as GenericFeature
    const actor = getSpec(specs, `actor`)

    // ERROR: Unimplemented actorless feature
    if (!actor) debugger

    // GET ALL TRAINED SKILLS
    const _knownSkills = actor.getSkills(`known`)
    const knownSkills = _knownSkills.map(feature => feature.sources.gca?._index).filter(index => !isNil(index))

    // // set usage as label
    // if (!_variants[0].label) _variants[0].label = {}
    // _variants[0].label.main = usage.data.label ?? undefined

    // // if there is no rolls attached to usage, just returns its default main variant
    // if (isNil(feature.data.rolls) || feature.data.rolls.length === 0) {
    //   _variants[0].value = undefined
    //   return _variants
    // }

    const main = _variants[0]

    // use first variant as a model for weapon skills -> FeatureVariant[]
    const variants = [] as IFeatureDataVariant[]

    // USE
    if (usage.data.use && usage.data.use.rule !== `automatic`) {
      debugger
    }

    // HIT
    if (usage.data.hit) {
      if (usage.data.hit.rule === `roll_to_hit` || usage.data.hit.rule === `roll_to_resist`) {
        let rolls = usage.data.hit.rolls

        // ERROR: Unimplemented
        if (isNil(rolls)) {
          LOGGER.error(`Missing "rolls" in ${usage.data.hit.rule} usage`, usage.data, usage)
        } else {
          // ERROR: Unimplemented actorless feature
          if (!actor) debugger

          // split into viable/unviable defaults
          //    usually a viable default is a trained skill default OR a attribute default
          //    usually a unviable default is a untrained/unknown skill default
          // split trained/untrained skills
          const unviable = [] as ILevelDefinition[]
          const viable = [] as ILevel[]

          for (const definition of rolls) {
            if (viabilityTest(definition, [nonSkillVariables, allowedSkillVariables], { allowedSkillList: knownSkills }).viable) {
              // calculate level should be source feature, right? (since FeatureUsage is not a GCA concept, most of the formulas would not require a me::)
              const level = calculateLevel(definition, parentFeature, actor)

              if (level) {
                viable.push(level!)
                continue
              }
            }

            unviable.push(definition)
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
              label: levelToHTML(level, { acronym: true, simplify: [/modifier/i] }),
            }

            if (!variant.rolls) variant.rolls = []

            // TODO: Add in content explanation of modifiers sources (proficiency, actor components, defaults, etc)
            variant.rolls[0] = parseRollContext(createRoll(level, `regular`), 0)

            variants.push({ ...variant, tags: tags.tags })
          }
        }
      }
    }

    return variants
  }

  /**
   * Build main data-variant of feature
   */
  static main(variants: IFeatureDataVariant[], specs: FeatureUsageContextSpecs, manager: ContextManager): IFeatureDataVariant[] {
    const usage = getSpec(specs, `feature`) as FeatureUsage
    const parentFeature = usage.parent as GenericFeature
    const actor = getSpec(specs, `actor`)

    const _classes = getSpec(specs, `variantClasses`, [] as string[])
    const secondary = getSpec(specs, `secondary`) ?? false

    // GET ALL TRAINED SKILLS
    const _knownSkills = actor.getSkills(`known`)
    const knownSkills = _knownSkills.map(feature => feature.sources.gca?._index).filter(index => !isNil(index))

    let variant = variants[0] ?? { classes: [] }

    if (!variant.stats) variant.stats = [[], []]
    if (!variant.rolls) variant.rolls = []
    if (!variant.label) variant.label = {}
    if (!variant.icon) variant.icon = {}

    const tags = new TagBuilder(variant.tags)

    // COMPOUNDING CLASSES
    const classes = [
      ..._classes, //
      ...variant.classes,
      secondary && `small-icon`,
    ] as string[]

    // LABEL
    if (secondary) variant.label.main = (usage.data.label ?? usage.data.type).capitalize()
    else {
      variant.label.main = parentFeature.data.name
      variant.label.secondary = (usage.data.label ?? usage.data.type).capitalize()

      if (parentFeature.data.name === `Natural Attacks`) variant.label.main = usage.data.label
    }

    const defenses = intersection(usage.data.tags, [`block`, `dodge`, `parry`])
    if (defenses.length > 1) debugger
    if (usage.data.type === `defense`) {
      if (secondary) {
        variant.label.main = defenses[0].capitalize()
        variant.label.secondary = usage.data.label ?? undefined
      } else {
        variant.label.secondary = defenses[0].capitalize()
      }
    }

    if (variant.label.main === variant.label.secondary) variant.label.secondary = undefined

    // ICON
    // variant.icon = undefined
    if (secondary) {
      variant.icon.main = usage.data.type
      variant.icon.secondary = usage.data.type === `defense` ? `minimal_${defenses[0]}` : undefined
    } else {
      variant.icon.main = parentFeature.type.icon ?? undefined
      variant.icon.secondary = usage.data.type === `defense` ? `minimal_${defenses[0]}` : usage.data.type
    }

    // TYPE
    tags.at(0).add({
      type: `type`,
      classes: [`box`, `collapsed`],
      children: [
        {
          classes: `bold`,
          label: (usage.data.type !== `defense` ? usage.data.type : defenses[0]).capitalize(),
          icon: usage.data.type !== `defense` ? usage.data.type : `minimal_${defenses[0]}`,
        },
        ...(usage.data.state & FeatureState.PASSIVE
          ? []
          : [
              {
                classes: `state`,
                label: stateToString(usage.data.state),
              },
            ]),
      ],
    })

    // TAGS
    tags.type(`tag`).remove()

    // USE
    if (usage.data.use && usage.data.use.rule !== `automatic`) {
      debugger
    }

    // HIT
    if (usage.data.hit) {
      if (usage.data.hit.rule === `roll_to_hit` || usage.data.hit.rule === `roll_to_resist`) {
        let levels = usage.data.hit.levels

        // ERROR: Unimplemented
        if (isNil(levels)) {
          LOGGER.error(`Missing "levels" in ${usage.data.hit.rule} usage`, usage.data, usage)
        } else {
          // ERROR: Unimplemented actorless feature
          if (!actor) debugger

          const level = levels[0]!

          // ERROR: Untested
          if (isNil(level) || isNil(level.value)) variant.value = { value: `-` }
          else {
            const simplify = [/modifier/i]
            variant.value = {
              value: level.value ?? `-`,
              label: levelToHTML(level, { acronym: true, simplify }),
            }

            // TODO: Add in content explanation of modifiers sources (proficiency, actor components, defaults, etc)
            variant.rolls.push(parseRollContextWithContent([{ primary: `To Hit`, secondary: usage.data.label ?? undefined }], createRoll(level, `regular`), variant.rolls.length))

            const scope = level.scope ?? {}
            const variables = Object.values(level.definition.variables ?? {})
            for (const variable of variables) {
              // ignore simplified variables
              if (simplify.some(regex => regex.test(variable.handle))) continue

              let icon: string | undefined = undefined
              let label: string = undefined as any as string
              let value: number | undefined = undefined

              const scopedVariable = scope[`VAR_${variable.handle}`]!
              if (variable.type === `skill`) {
                const skill = actor.cache.features?.[scopedVariable.reference!] as SkillFeature

                // ERROR: Unimplemented
                if (!skill) debugger

                icon = skill.data.training === `trained` ? `skill` : `untrained_skill`
                label = scopedVariable.string!
                value = scopedVariable.number

                // ERROR: Unimplemented
                if (!label) debugger
                if (isNil(value)) debugger
              } else if (variable.type === `attribute`) {
                icon = `attribute`
                label = scopedVariable.string ?? variable.meta?.name ?? variable.value
                value = actor.getAttribute(variable.value)?.value ?? undefined
              } else {
                // ERROR: Unimplemented
                debugger
              }

              const tag = {
                type: `tag`,
                classes: [`box`],
                children: [],
              } as any

              if (icon) tag.children.push({ icon })
              tag.children.push({
                classes: `interactible`,
                label,
              })
              if (value !== undefined) tag.children.push({ label: value.toString() })

              tags.add(tag)
            }
          }

          // // show unviable defaults as tags
          // const unviable = levels.filter(level => isNil(level?.value))
          // const unviableTag = unviable.length && {
          //   classes: `box`,
          //   children: [
          //     { icon: `untrained_skill` },
          //     {
          //       classes: `interactible`,
          //       label: `<b>${unviable.length}</b> skills`,
          //     },
          //     // ...untrained.map(skill => {
          //     //   return {
          //     //     label: `${skill.fullName ?? skill.attribute.toUpperCase()}${parseModifier(skill.modifier)}`,
          //     //   }
          //     // }),
          //   ],
          // }
        }
      }

      // TARGET
      if (usage.data.hit.target) {
        if (usage.data.hit.target.rule === `melee`) {
          const melee = usage.data.hit.target as IHitTargetMelee

          if (melee.reach) {
            variant.stats[0].push({
              classes: [],
              icon: [`mdi-hexagon-slice-6`],
              // icon: feature.data.reach.map(letter => (isNumeric(letter) ? `mdi-numeric-${letter}` : `mdi-alpha-${letter}`)),
              value: `${melee.reach.join(`, `)}`,
            })
          }
        } else if (usage.data.hit.target.rule === `ranged`) {
          // TODO: shots
          // TODO: bulk
          // TODO: ammo

          const ranged = usage.data.hit.target as IHitTargetRanged

          if (ranged.range) {
            const range = ranged.range

            // ERROR: Unimplemented
            if (range.startsWith(`x`)) debugger

            variant.stats[0].push({
              classes: [],
              icon: [`mdi-hexagon-slice-6`],
              value: `${range}`,
            })
          }

          if (ranged.accuracy) {
            variant.stats[0].push({
              classes: [],
              icon: [`mdi-target`],
              value: `${ranged.accuracy}`,
            })
          }

          if (ranged.rof && ranged.rof != `1`) {
            variant.stats[0].push({
              classes: [],
              icon: [`mdi-alpha-r`, `mdi-alpha-o`, `mdi-alpha-f`],
              value: `${ranged.rof}`,
            })
          }

          if (ranged.recoil && ranged.recoil != `1`) {
            variant.stats[0].push({
              classes: [],
              icon: [`mdi-pistol`],
              value: `${ranged.recoil}`,
            })
          }
        } else if (usage.data.hit.target.rule === `self`) {
          // pass
        } else {
          // ERROR: Unimplemented
          debugger
        }
      }

      // REQUIREMENTS FOR USE
      if (usage.data.use && usage.data.use.requirements?.minimumStrength) {
        variant.stats[0].push({
          classes: [],
          icon: [`mdi-dumbbell`],
          value: `${usage.data.use.requirements?.minimumStrength}`,
        })
      }

      // EFFECTS

      // ERROR: Unimplemented
      if (usage.data.hit.failure?.length) debugger

      if (usage.data.hit.success) {
        for (const effect of usage.data.hit.success) {
          // ERROR: Unimplemented
          if (effect.target) debugger

          if (effect.rule === `damage`) {
            const damage = effect as IUsageEffectDamage

            if (damage.damage) {
              if (damage.damage.type !== `-` && !damage.damage.type.match(/special/i)) {
                const preparedLevel = prepareLevel(damage.damage.definition, null, actor)

                const preExpression = levelToString(preparedLevel, { simplify: Object.keys(preparedLevel.scope).filter(key => key !== `VAR_ST`) })
                const expression = preparedLevel.scope[`VAR_ST`] ? preExpression.replace(`VAR_ST`, preparedLevel.scope[`VAR_ST`].string) : preExpression

                const math = mathInstance()
                const node = math.parse(expression)
                const simple = math.simplify(node)

                const simpleExpression = simple.toString().replace(/((?<!\d)d)/, `1d`)

                LOGGER.error(`damage`, damage.damage, usage.data.label, parentFeature.data.name)
                variant.stats[0].push({
                  classes: [],
                  icon: [`damage`],
                  value: `${simpleExpression} ${damage.damage.type}`,
                  roll: variant.rolls.length,
                })

                // TODO: Add in content explanation of modifiers sources (proficiency, actor components, defaults, etc)
                variant.rolls.push(parseRollContextWithContent([{ primary: `Damage` }], createRoll(simpleExpression, `damage`, damage.damage), variant.rolls.length))
              }
            }
          } else {
            // ERROR: Unimplemented
            debugger
          }
        }
      }
    }

    variant.classes = uniq(classes.filter(c => !isNil(c)))
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
