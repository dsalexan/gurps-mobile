import { flatten, flattenDeep, get, isArray, isNil, isNumber, isString, orderBy, set } from "lodash"
import { FeatureBaseContextSpecs } from "../base"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../../context"
import { IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "../interfaces"
import TagBuilder from "../../tag"
import { IFeatureValue } from "../interfaces"
import GenericFeature from "../../../../../core/feature/variants/generic"
import ContextManager from "../../manager"
import { orderRolls, parseRollDefinition } from "../../../../../../gurps-extension/utils/roll"
import BaseFeature from "../../../../../core/feature/base"

export interface DefenseFeatureContextSpecs extends FeatureBaseContextSpecs {
  feature: GenericFeature
  //
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
    const features = (specs.features ?? []) as BaseFeature[]

    if (features.length === 0) return null

    const activeDefense = feature.id.replace(`activedefense-`, ``)

    let related = [] as any[]
    if (activeDefense === `block` || activeDefense === `parry`) {
      related = features.map(feature => {
        const weapons = feature.weapons ?? []
        return weapons.filter(weapon => weapon[activeDefense] !== false)
      })
    } else if (activeDefense === `dodge`) related = []

    related = orderBy(
      flatten(related),
      weapon => {
        let defaultRolls = weapon.rolls
        if (isNil(defaultRolls)) defaultRolls = [parseRollDefinition({ type: `dx` })]

        if (defaultRolls.length > 0) {
          const rolls = orderRolls(defaultRolls, weapon, weapon._actor)
          const roll = rolls[0]

          return roll.level
        }

        // ERROR: All related should have rolls to determine active defense level
        debugger
      },
      `desc`,
    )

    const data = [] as IFeatureDataContext[]
    for (const weapon of related) {
      const context = manager.feature(weapon, { showParent: true } as any)

      const main = context.children.main[0]
      main.actions = false

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
    let variant = variants[0] ?? {}

    // const mark = ((feature.__compilation.sources.gcs as any).default ? `Ruler` : undefined) as string | undefined
    // const classes = [...(variant.classes ?? []), !!mark && `marked`] as string[]

    // // VALUE
    // let value: IFeatureValue = { value: feature.value }

    // // LINKS
    // const links = feature.links ?? []

    // // COMPOUNDING TAGS
    // const tags = new TagBuilder(variant.tags ?? [])
    // tags.add(...links)

    // if (tags.tags.length > 0) value.asterisk = true

    // variant = {
    //   ...(variant ?? {}),
    //   classes,
    //   //
    //   value,
    //   mark,
    //   //
    //   tags: tags.tags,
    // }

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
