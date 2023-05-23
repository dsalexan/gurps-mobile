import { flatten, flattenDeep, get, isArray, isNil, isNumber, isString, orderBy, set, uniq } from "lodash"
import { FeatureBaseContextSpecs } from "../base"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../../context"
import { FastDisplayable, IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "../interfaces"
import TagBuilder, { PartialTag } from "../../tag"
import { IFeatureValue } from "../interfaces"
import ContextManager from "../../manager"
import { push } from "../../../../../../december/utils/lodash"
import SkillFeature from "../../../../actor/feature/skill"
import { createRoll, parseRollContext } from "../../../../../../gurps-extension/utils/roll"
import { levelToHTML } from "../../../../../../gurps-extension/utils/level"
import { parseSign } from "../../../../../../gurps-extension/utils/bonus"
import GenericFeature from "../../../../actor/feature/generic"

export interface SkillFeatureContextSpecs extends FeatureBaseContextSpecs {
  feature: SkillFeature
  //
  showDefaults?: boolean
  difficulty?: boolean
  tl?: number
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
    const actor = getSpec(specs, `actor`)
    let variant = variants[0] ?? { classes: [] }

    const tags = new TagBuilder(variant.tags)

    // #region VALUE
    variant.value = { value: `-` }
    if (feature.data.proxy) variant.value = undefined
    else {
      const level = feature.data.level
      if (level) {
        const simplify = [/modifier/i]
        variant.value.value = level.value.toString()
        variant.value.label = levelToHTML(level, { acronym: true, simplify })

        if (!variant.rolls) variant.rolls = []
        // TODO: Add in content explanation of modifiers sources (proficiency, actor components, defaults, etc)
        variant.rolls.push(parseRollContext(createRoll(level, `regular`), variant.rolls.length))

        const scope = level.scope ?? {}
        const variables = Object.values(level.definition.variables ?? {})
        for (const variable of variables) {
          let icon: string | undefined = undefined
          let label: string = undefined as any as string
          let value: number | undefined = undefined
          const classes = [] as string[]

          const scopedVariable = scope[`VAR_${variable.handle}`] ?? {}

          // FLAG
          if (variable.flags?.includes(`actor-component`)) {
            const components = feature.calcActorModifier(actor, true)
            for (const { component, value } of components) {
              const source = actor.cache.features?.[component.feature] as GenericFeature

              icon = source.type.icon ?? undefined
              label = source.data.name

              tags.at(-2).add({
                type: `variable`,
                classes: [`box`],
                children: [
                  { icon: source.type.icon ?? undefined },
                  {
                    classes: [`interactible`],
                    label: source.specializedName,
                  },
                  { label: parseSign(value) },
                ],
              })
            }

            continue
          }

          // TYPE
          if (variable.type === `skill`) {
            const skill = actor.cache.features?.[scopedVariable.reference!] as SkillFeature

            // ERROR: Unimplemented
            if (!skill) debugger

            icon = skill.data.training === `trained` ? `skill` : `untrained_skill`
            label = scopedVariable.string!
            value = scopedVariable.number

            classes.push(`interactible`)

            // ERROR: Unimplemented
            if (!label) debugger
            if (isNil(value)) debugger
          } else if (variable.type === `attribute`) {
            icon = `attribute`
            label = scopedVariable.string ?? variable.meta?.name ?? variable.value
            value = actor.getAttribute(variable.value)?.value ?? undefined

            classes.push(`interactible`)
          } else if (variable.type === `constant`) {
            label = variable.label
            value = parseSign(scopedVariable.number)

            // ERROR: Unimplemented
            if (!label) debugger
          } else {
            // ERROR: Unimplemented
            debugger
          }

          const tag = {
            type: `variable`,
            classes: [`box`],
            children: [],
          } as any

          if (icon) tag.children.push({ icon })
          tag.children.push({ classes, label })
          if (value !== undefined) tag.children.push({ label: value.toString() })

          tags.at(-2).add(tag)
        }
      }
    }

    // #endregion

    // TAGS

    if (feature.data.proxy) {
      const proxyTo = get(specs, `proxyTo`) ?? []

      // if is proxy, but actor has no trained/untrained skills attached
      //    show label and icon in type tag (otherwise show nothing, let that to featureData proxies)
      if (proxyTo.length === 0) {
        tags.type(`type`).update(tag => {
          tag.children[0].label = `Unknown Skill`
          tag.children[0].icon = `untrained_skill`

          return tag
        })
      }
    } else if (feature.data.training === `untrained` || feature.data.training === `unknown`) {
      tags.type(`type`).update(tag => {
        tag.children[0].label = `${feature.data.training === `untrained` ? `Untrained` : `Unknown`} Skill`
        tag.children[0].icon = `untrained_skill`

        return tag
      })
    }

    // DIFFICULTY
    if (specs.difficulty !== false) {
      tags.type(`type`).update(tag => {
        tag.children.push({
          classes: [`difficulty`],
          label: { E: `Easy`, A: `Average`, H: `Hard`, VH: `Very Hard` }[feature.data.difficulty] ?? feature.data.difficulty ?? `—`,
        })

        return tag
      })
    }

    // ATTRIBUTE
    if (feature.data.proxy) {
      tags.type(`type`).update(tag => {
        tag.children.push({
          label: feature.data.attribute,
        })

        return tag
      })
    }

    // DEFAULTS
    if (feature.data.training === `untrained` || specs.showDefaults) {
      // ERROR: Unimplemented actorless feature
      if (!actor) debugger

      const levelTags = [] as {
        type: string
        classes: string[]
        children: FastDisplayable[]
      }[][]

      debugger
      // there must be so many bugs here
      for (const roll of feature.data.defaults ?? []) {
        const levelDefinition = roll.parse(feature, actor)

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

          levelTags.push([tag])
        } else {
          levelTags.push([])
        }
      }

      tags.at(1).add(...flatten(levelTags))
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

    if (feature.data.proxy && children?.main?.[0]) push(children.main[0], `classes`, `no-swipe`)

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
