/* eslint-disable no-debugger */
import { cloneDeep, flatten, flattenDeep, get, intersection, isArray, isNil, isNumber, isString, omit, orderBy, set, sum } from "lodash"
import { FeatureBaseContextSpecs } from "./base"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../context"
import { IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "./interfaces"
import TagBuilder, { FastTag } from "../tag"
import { IFeatureValue } from "./interfaces"
import ContextManager from "../manager"
import BaseFeature from "../../../../core/feature/base"
import { parseBonus, parseSign } from "../../../../../gurps-extension/utils/bonus"
import { FeatureState, stateToString } from "../../../../core/feature/utils"
import { IActiveDefenseLevel, activeDefenseFeatures, activeDefenseLevel } from "../../../../../gurps-extension/utils/defense"
import GenericFeature from "../../../actor/feature/generic"
import { IAttributeBonusComponent, IComponentDefinition } from "../../../../../gurps-extension/utils/component"
import { push } from "../../../../../december/utils/lodash"
import LOGGER from "../../../../logger"
import { IDefenseLevel } from "../../../actor/feature/pipelines/defense"
import { levelToHTML, levelToTex } from "../../../../../gurps-extension/utils/level"
import SkillFeature from "../../../actor/feature/skill"

interface DefenseSpecs {
  activeDefense: `block` | `dodge` | `parry`
  components: IAttributeBonusComponent[]
  adls: IActiveDefenseLevel[]
}

export interface DefenseFeatureContextSpecs extends FeatureBaseContextSpecs {
  feature: GenericFeature
  //
  defense: `block` | `dodge` | `parry`
  levels: IDefenseLevel[]
}

export default class DefenseFeatureContextTemplate extends BaseContextTemplate {
  static pre(context: IContext, specs: ContextSpecs, manager: ContextManager): IContext {
    super.pre(context, specs, manager)

    context._template.push(`defense-feature`)
    if (context._metadata?.childrenKeys === undefined) set(context, `_metadata.childrenKeys`, [])
    context._metadata?.childrenKeys.push([4, `features`])

    return context
  }

  static features(defense: DefenseSpecs, specs: DefenseFeatureContextSpecs, manager: ContextManager): IFeatureDataContext[] | null {
    const feature = getSpec(specs, `feature`)

    const { activeDefense, components, adls } = defense
    const actorBonus = sum(components.map(component => component.amount))

    if (adls.length === 0) return null

    LOGGER.warn(`defense`, activeDefense, adls, components)
    const sourcesSpecs = get(specs, `sources`) ?? {}

    const data = [] as IFeatureDataContext[]
    for (const adl of adls) {
      // prepare base specs
      const _specs = { ...cloneDeep(adl.source?.__?.context?.specs ?? {}), ...cloneDeep(sourcesSpecs) } as FeatureBaseContextSpecs
      _specs.list = specs.list
      push(_specs, `innerClasses`, `swipe-variant`)

      let main = null as any as IFeatureDataContext
      if (adl.source) {
        const context = manager.feature(adl.source, {
          ..._specs,
          showParent: adl.type === `weapon`,
          ignoreSpecialization: adl.type === `weapon` ? adl.base.ignoreSpecialization : false,
          ignoreUsage: activeDefense === `block`,
        } as any)

        main = context.children.main[0]
        main.id = `activedefense-${activeDefense}-${adl.source.id}`
      } else {
        main = {
          classes: [],
          id: `activedefense-${activeDefense}-${adl.base.attribute}`,
          //
          variants: [
            {
              classes: [],
              id: `main-variant`,
              //
              icon: {
                classes: [],
                main: `attribute`,
              },
              label: {
                classes: [],
                main: adl.base.attribute,
              },
              tags: [],
            },
          ],
          actions: false,
        }
      }

      if (isNil(main)) debugger // COMMENT

      main.actions = false

      main.variants[0].notes = undefined
      main.variants[0].value = { value: adl.level + adl.sourceBonus + actorBonus }

      const tags = new TagBuilder(main.variants[0].tags as any)

      if (adl.type === `weapon`) {
        const skill = adl.base.skill

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
              label: `${adl.base.ignoreSpecialization ? skill.data.name : skill.specializedName}${skill.data.training === `untrained` ? `` : stringTrained}`,
            },
            {
              label: skill.data.level!.level.toString(),
            },
          ],
        })

        // showing number of equivalent skills
        const ESN = adl.breakdown.skills.filter(s => s.id !== skill.id).length
        if (ESN > 0)
          tags.add({
            type: `skill`,
            classes: [`box`],
            children: [
              {
                classes: [`interactible`, `italic`, `regular`], //, `discreet`],
                label: `Equivalent skills`,
              },
              {
                label: ESN.toString(),
              },
            ],
          })

        tags.tags = tags.tags
          .map(tag => {
            tag.children = tag.children.filter(child => !child.classes?.includes(`quantity`))
            return tag
          })
          .filter(tag => tag.children.length > 0)
          .filter(tag => intersection(tag.type, [`feature`, `weight`, `cost`]).length === 0)
      } else if (adl.type === `attribute`) {
        // debugger
      } else if (adl.type === `power`) {
        debugger
      } else {
        // ERROR: Unimplemented
        debugger
      }

      main.variants[0].tags = tags.tags
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
    const actor = getSpec(specs, `actor`)

    let variant = variants[0] ?? {}

    // const { activeDefense, components, adls } = defense

    const activeDefense = getSpec(specs, `defense`) as `block` | `dodge` | `parry`
    const components = getSpec(specs, `components`) as { value: number; component: string }[]
    const levels = getSpec(specs, `levels`) as IDefenseLevel[]

    // const noSecondary = adls.every(adl => adl.weapon === undefined && adl.skill === undefined)

    // const mark = ((feature.sources.gcs as any).default ? `Ruler` : undefined) as string | undefined
    // const classes = [...(variant.classes ?? []), !!mark && `marked`] as string[]

    // VALUE
    const level = levels[0]
    if (!level) debugger

    variant.value = { value: `-` }
    variant.value.value = level.level.value.toString()
    // TODO: Implement MathNode -> HTMLTex manually (base on mathjax) with levelToTex(...)
    variant.value.label = levelToHTML(level.level, { acronym: true, simplify: [/_MODIFIER$/i, /^STAT_Power Parry /i] })

    // if (!variant.rolls) variant.rolls = []
    // // TODO: Add in content explanation of modifiers sources (proficiency, actor components, defaults, etc)
    // variant.rolls.push(parseRollContext(createRoll(level, `regular`), variant.rolls.length))

    // // LINKS
    // const links = feature.links ?? []

    // // COMPOUNDING TAGS
    // const tags = new TagBuilder(variant.tags ?? [])
    // tags.add(...links)

    // if (tags.tags.length > 0) value.asterisk = true

    // TAGS
    const tags = new TagBuilder(variant.tags as any)

    // only keep state/type tags
    tags.tags = tags.tags
      .map(tag => {
        tag.children = tag.children.filter(child => child.classes?.includes(`type`) || child.classes?.includes(`state`))
        return tag
      })
      .filter(tag => tag.children.length > 0)

    // add base level
    const base = {} as { icon?: string; label: string; level?: number }
    if (level.base.type === `skill`) {
      const skill = actor.cache?.features?.[level.base.id] as SkillFeature

      base.icon = skill.type.icon ?? undefined
      base.label = skill.specializedName
      base.level = skill.data.level!.value
    } else if (level.base.type === `attribute`) {
      const attribute = actor.system.attributes[level.base.id.toUpperCase()] ?? actor.system[level.base.id.toLowerCase().replaceAll(` `, ``)]

      base.icon = `attribute`
      base.label = level.base.id
      base.level = attribute?.value
    } else {
      // ERROR: Unimplemented
      debugger
    }

    const baseTagChildren = [] as any[]
    if (base.icon) baseTagChildren.push({ icon: base.icon })
    baseTagChildren.push({ classes: [`interactible`], label: base.label })
    if (base.level) baseTagChildren.push({ label: base.level.toString() })

    tags.add({
      type: `base`,
      classes: [`box`, `collapsed`],
      children: baseTagChildren,
    })

    // #region BONUSES
    // aggregate all bonuses in tags (index first in case the same feature gives more than one bonus)
    const modifierSources = {} as Record<string, GenericFeature>
    const modifierBonuses = {} as Record<string, number[]>

    // add source modifier
    //    only add source defense modifier if it is bigger than ZERO
    if (level.base.modifier !== 0) {
      modifierSources[feature.id] = feature
      push(modifierBonuses, feature.id, level.base.modifier)
    }

    // showing state for actor bonuses
    for (const { component: componentId, value: componentValue } of components) {
      const component = actor.cache.components?.index?.[componentId] as IComponentDefinition
      if (!component) debugger

      if (isNil(componentValue) || isNaN(componentValue)) continue

      const componentFeature = actor.cache.features?.[component.feature] as GenericFeature
      if (!componentFeature) debugger

      modifierSources[componentFeature.id] = componentFeature
      push(modifierBonuses, componentFeature.id, component.amount)
    }

    for (const id of Object.keys(modifierSources)) {
      const source = modifierSources[id]
      const bonuses = modifierBonuses[id] ?? []

      if (bonuses.length === 0) continue

      const isActive = [FeatureState.PASSIVE, FeatureState.ACTIVE].some(state => source.data.state & state)
      const stringState = ` <span style="opacity: 0.5; margin-left: var(--s0-5); color: white;">${stateToString(source.data.state)}</span>`

      const totalModifier = sum(bonuses)

      let icon = source.type.icon ?? undefined
      if (source.id === feature.id && level.base.type === `attribute`) icon = `attribute`

      tags.add({
        type: `bonus`,
        classes: [`box`, `collapsed`],
        children: [
          {
            icon,
          },
          {
            classes: [`interactible`].concat(!isActive ? [`italic`, `regular`, `discreet`] : []),
            label: `${source.specializedName}${isActive ? `` : stringState}`,
          },
          {
            classes: [isActive ? `` : `risked`],
            label: isActive ? parseSign(totalModifier) : `(${parseSign(totalModifier)})`,
          },
        ],
      })
    }

    // #endregion

    // STATS
    variant.stats = []

    // // COLLAPSED
    // //    showing tags of best option
    // const newTags = [] as FastTag[]
    // if (ADL && ADL.skill) {
    //   const stringTrained = ` <span style="opacity: 0.5; margin-left: var(--s0-5); color: white;">${`Untrained`}</span>`
    //   newTags.push({
    //     type: `skill`,
    //     classes: [`box`, `collapsed-only`],
    //     children: [
    //       {
    //         icon: ADL.skill.type.icon ?? undefined,
    //       },
    //       {
    //         classes: [`interactible`],
    //         label: `${ADL.ignoreSpecialization ? ADL.skill.name : ADL.skill.specializedName}${ADL.skill.training === `untrained` ? `` : stringTrained}`,
    //       },
    //       {
    //         label: ADL.skill.calcLevel().level.toString(),
    //       },
    //     ],
    //   })
    // }

    // if (ADL && ADL.weapon && ADL.bonus !== 0) {
    //   newTags.push({
    //     type: `weapon`,
    //     classes: [`box`, `collapsed-only`],
    //     children: [
    //       {
    //         icon: ADL.weapon.parent.type.icon ?? undefined,
    //       },
    //       {
    //         classes: [`interactible`],
    //         label: ADL.weapon.parent.name,
    //       },
    //       {
    //         label: parseSign(ADL.bonus),
    //       },
    //     ],
    //   })
    // }

    // tags.at(0).add(...newTags)

    // variant = {
    //   ...(variant ?? {}),
    //   classes,
    //   //
    //   value,
    //   mark,
    //   //
    //   tags: tags.tags,
    // }

    if (!variant.icon) variant.icon = { classes: [] }
    variant.icon.secondary = `minimal_${activeDefense}`

    variant.tags = tags.tags
    return [variant]
  }

  static base(context: IFeatureContext, specs: DefenseFeatureContextSpecs, manager: ContextManager): IFeatureContext {
    super.base(context, specs, manager)

    const feature = getSpec(specs, `feature`)
    const actor = getSpec(specs, `actor`)

    // ERROR: Unimplemented actorless feature
    if (!actor) debugger

    const children = get(context, `children`) ?? {}

    const activeDefense = feature.id.replace(`activedefense-`, ``) as `block` | `dodge` | `parry`
    // const components = actor.getComponents(`attribute_bonus`, (component: IAttributeBonusComponent) => component.attribute.includes(activeDefense), null)
    // const adls = activeDefenseLevel(activeDefense as any, actor)

    // COMPOUNDING CLASSES
    // const classes = [...(context.classes ?? []), `set-move-default`]

    const main = this.main(children.main?.[0]?.variants ?? [], specs, manager)
    if (main) set(children, `main.0.variants`, main)

    // const features = this.features({ activeDefense, components, adls }, specs, manager)
    // if (features) children.features = features

    context = {
      ...context,
      //
      children: omit(children, `weapons`),
      //
      // classes: [...new Set(classes)],
      //
    }

    return context
  }
}
