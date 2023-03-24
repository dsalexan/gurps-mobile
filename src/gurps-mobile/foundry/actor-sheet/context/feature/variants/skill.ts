import { flatten, flattenDeep, get, isArray, isNil, isNumber, isString, orderBy, set, uniq } from "lodash"
import { FeatureBaseContextSpecs } from "../base"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../../context"
import { FastDisplayable, IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "../interfaces"
import TagBuilder, { PartialTag } from "../../tag"
import { IFeatureValue } from "../interfaces"
import ContextManager from "../../manager"
import { push } from "../../../../../../december/utils/lodash"
import { ISkillFeature } from "../../../../../core/feature/compilation/templates/skill"
import SkillFeature from "../../../../../core/feature/variants/skill"
import { ILevelDefinition, IRollDefinition, parseLevelDefinition } from "../../../../../../gurps-extension/utils/roll"

export interface SkillFeatureContextSpecs extends FeatureBaseContextSpecs {
  feature: ISkillFeature
  //
  showDefaults?: boolean
  difficulty?: boolean
}

export default class SkillFeatureContextTemplate extends BaseContextTemplate {
  static pre(context: IContext, specs: ContextSpecs, manager: ContextManager): IContext {
    super.pre(context, specs, manager)

    context._template.push(`skill-feature`)

    return context
  }

  /**
   * Build main data-variant of feature
   */
  static main(variants: IFeatureDataVariant[], specs: SkillFeatureContextSpecs, manager: ContextManager): IFeatureDataVariant[] {
    const feature = getSpec(specs, `feature`)
    let variant = variants[0] ?? { classes: [] }

    variant.classes.push(`value-interactible`)
    const tags = new TagBuilder(variant.tags)

    // #region VALUE
    let rsl = feature.rsl,
      sl = feature.sl
    if (isNil(rsl) || isNil(sl)) {
      if (feature.rolls) {
        const rolls = feature.rolls
          .map(roll => parseLevelDefinition(roll, feature as SkillFeature, (feature as SkillFeature)._actor))
          .filter(level => !isNil(level)) as ILevelDefinition[]
        const levels = orderBy(rolls, `level`, `desc`)

        // if (feature.specializedName === `Armoury (Body Armor)`) debugger

        if (levels.length > 0) {
          sl = levels[0].level.toString()
          rsl = levels[0].relative as any
        }
      }
    }

    variant.value = { value: sl ?? `-` }
    if (!isNil(rsl)) variant.value.label = rsl.toString({ skillAcronym: true })
    // #endregion

    // TAGS
    if (feature.untrained) {
      tags.type(`type`).update(tag => {
        tag.children[0].label = `Untrained Skill`
        tag.children[0].icon = `untrained_skill`

        return tag
      })
    }

    // DIFFICULTY
    if (specs.difficulty !== false) {
      tags.type(`type`).update(tag => {
        tag.children.push({
          label: { E: `Easy`, A: `Average`, H: `Hard`, VH: `Very Hard` }[feature.difficulty] ?? feature.difficulty,
        })

        return tag
      })
    }

    // DEFAULTS
    if (feature.untrained || specs.showDefaults) {
      tags.at(1).add(
        ...flatten(
          (feature.rolls ?? []).map((roll: IRollDefinition) => {
            const levelDefinition = parseLevelDefinition(roll, feature as SkillFeature, (feature as SkillFeature)._actor)

            if (!isNil(levelDefinition)) {
              const { level, relative } = levelDefinition

              const types = uniq(Object.values(relative?.definitions ?? []).map(definition => definition.type)) as string[]

              const sl = level.toString()
              const rsl = relative?.toString()

              // ERROR: Not implemented
              if (types.filter(t => ![`me`].includes(t)).length > 1) debugger

              const tag = {
                type: `default`,
                classes: [`box`],
                children: [{ classes: [`interactible`], label: rsl }] as FastDisplayable[],
              }

              if (types[0] === `skill`) {
                tag.children.splice(0, 0, {
                  classes: [`interactible`],
                  icon: types[0] === `skill` ? `skill` : undefined,
                })
              }

              tag.children.push({ label: sl })

              return [tag]
            }

            return []
          }),
        ),
      )
    }

    variant.tags = tags.tags
    return [variant]
  }

  static base(context: IFeatureContext, specs: SkillFeatureContextSpecs, manager: ContextManager): IFeatureContext {
    super.base(context, specs, manager)

    const feature = getSpec(specs, `feature`)
    const children = get(context, `children`) ?? {}

    // COMPOUNDING CLASSES
    const classes = [...(context.classes ?? []), `inline-tags`, `top-marked`]

    const main = this.main(children.main?.[0]?.variants ?? [], specs, manager)
    if (main) set(children, `main.0.variants`, main)

    if (feature.proxy && children?.main?.[0]) push(children.main[0], `classes`, `no-swipe`)

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
