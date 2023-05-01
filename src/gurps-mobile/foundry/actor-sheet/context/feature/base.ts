import { flattenDeep, get, isArray, isNil, isNumber, set, uniq } from "lodash"
import BaseContextTemplate, { ContextSpecs, IContext, getSpec } from "../context"
import ContextManager from "../manager"
import { IFeatureAction, IFeatureActionChild, IFeatureContext, IFeatureDataContext, IFeatureDataVariant } from "./interfaces"
import { isNilOrEmpty, push } from "../../../../../december/utils/lodash"
import LOGGER from "../../../../logger"
import GenericFeature from "../../../actor/feature/generic"
import { GurpsMobileActor } from "../../../actor/actor"

export interface FeatureDataVariantActionSpecs {
  noDefault?: boolean
}

export interface FeatureBaseContextSpecs extends ContextSpecs {
  actor: GurpsMobileActor
  feature: GenericFeature
  label?: string
  ignoreSpecialization?: boolean
  proxyTo?: GenericFeature[]
  //
  index?: number
  innerClasses?: string[]
  actions?: false | { left: FeatureDataVariantActionSpecs; right: FeatureDataVariantActionSpecs }
}

export default class FeatureBaseContextTemplate extends BaseContextTemplate {
  static pre(context: IContext, specs: ContextSpecs, manager: ContextManager): IContext {
    super.pre(context, specs, manager)

    context._template.push(`base-feature`)
    if (context._metadata?.childrenKeys === undefined) set(context, `_metadata.childrenKeys`, [])

    return context
  }

  /**
   * Wrap feature data-variants into a data-context (which by now is mostly building actions)
   */
  static data(id: string, variants: IFeatureDataVariant[], specs: FeatureBaseContextSpecs, manager: ContextManager): IFeatureDataContext {
    const feature = getSpec(specs, `feature`)

    const _classes = getSpec(specs, `innerClasses`) ?? []
    const _actions = getSpec(specs, `actions`)

    const hidden = get(specs, `hidden`)?.(feature.id) ?? false
    const pinned = get(specs, `pinned`)?.(feature.id) ?? false
    const expanded = get(specs, `expanded`)?.(feature.id, id) ?? false
    const roller = get(specs, `roller`)?.(feature.id) ?? false

    // COMPOUNDING CLASSES
    const classes = [
      ..._classes,
      //
      !!expanded && `expanded`,
      !!roller && `roller`,
    ] as string[]

    let actions = false as any as { left: IFeatureAction[]; right: IFeatureAction[] }
    if (_actions !== false) {
      classes.push(`has-swipe`)
      actions = {} as any

      if (get(_actions, `left`, true)) {
        set(actions, `left`, [])

        if (!_actions?.left?.noDefault) {
          actions.left.push({
            classes: [],
            children: [
              {
                icon: hidden ? `mdi-eye` : `mdi-eye-off`,
                classes: [`target`, `action-hide`],
              },
            ],
          })
        }
      } else classes.push(`no-left`)

      if (get(_actions, `right`, true)) {
        set(actions, `right`, [])

        if (!_actions?.right?.noDefault) {
          actions.right.push({
            classes: [`horizontal`],
            children: [
              {
                icon: `mdi-dice-d6`,
                classes: [`target`, `action-roller`],
              },
              {
                icon: pinned ? `mdi-pin-off` : `mdi-pin`,
                classes: [`target`, `action-pin`],
              },
            ],
          })
        }
      } else classes.push(`no-right`)
    }

    const wrapper: IFeatureDataContext = {
      classes: uniq(classes),
      id,
      //
      variants: isArray(variants) ? variants : [variants],
      actions,
    }

    return wrapper
  }

  static base(context: IFeatureContext, specs: FeatureBaseContextSpecs, manager: ContextManager): IFeatureContext {
    super.base(context, specs, manager)

    const feature = getSpec(specs, `feature`)

    const _classes = getSpec(specs, `classes`, [] as string[])

    const hidden = get(specs, `hidden`)?.(feature.id) ?? false
    const pinned = get(specs, `pinned`)?.(feature.id) ?? false

    // COMPOUNDING CLASSES
    const classes = [
      ..._classes,
      //
      !!hidden && `hidden`,
      !!pinned && `pinned`,
    ] as string[]

    context = {
      ...context,
      classes,
      //
      id: feature.id,
      path: feature.path,
      index: getSpec(specs, `index`, feature.key.value),
      //
      hidden,
      //
      //
      children: {} as any, // {key: FeatureData[]} -> {main, ...secondaries}
    }

    return context
  }

  static post(context: IFeatureContext, specs: FeatureBaseContextSpecs, manager: ContextManager): IFeatureContext {
    super.post(context, specs, manager)

    const feature = getSpec(specs, `feature`)

    // inject feature reference
    context._feature = feature as any

    let everyMainRoller = context.children[`main`]?.every(data => data.classes.includes(`roller`))
    let someMainRoller = context.children[`main`]?.some(data => data.classes.includes(`roller`))

    // ERROR: Unimplemented
    if (everyMainRoller !== someMainRoller) debugger

    let mainRoller = everyMainRoller

    // for each FeatureData[] in children
    for (const key of Object.keys(context.children ?? {})) {
      // remove empty undefined values (ease to read on console) and classes
      context.children[key].map((data, dataIndex) => {
        if (!data.id) debugger //data.id = `${key}-${dataIndex}`
        if (mainRoller) data.classes = uniq([...data.classes, `roller`])

        data.variants.map((variant, variantIndex) => {
          variant.classes = variant.classes.filter(_class => !isNilOrEmpty(_class) && (_class as any) !== false)

          if (!variant.id) debugger //  variant.id = `${key}-${dataIndex}-${variantIndex}`
          if (!variant.label) {
            variant.label = {}
          } else {
            if (variant.label.classes) variant.label.classes = variant.label.classes.filter(_class => !isNilOrEmpty(_class) && (_class as any) !== false)
            if (!variant.label.main) delete variant.label.main
            if (!variant.label.secondary) delete variant.label.secondary
          }
          if (!variant.value) delete variant.value
          if (!variant.icon) delete variant.icon
          if (!variant.mark) delete variant.mark
          if (!variant.notes) delete variant.notes
          if (!variant.stats) delete variant.stats
          if (!variant.rolls) delete variant.rolls
        })
      })

      // remove unnecessary dividers on actions
      context.children[key].map(data => {
        if (!data.actions) return

        const sides = Object.keys(data.actions)
        for (const side of sides) {
          if (!data.actions[side]) continue
          const sideActions = data.actions[side] as IFeatureAction[]

          const actions = [] as IFeatureAction[]

          for (let i = 0; i < sideActions.length; i++) {
            const current = sideActions[i]
            const next = sideActions[i + 1]

            // TODO: remove roller if there is no rolls
            // const children = [] as IFeatureActionChild[]
            // for (const child of current.children) {
            //   if (child.classes.includes(`action-roller`)) {
            //     debugger
            //   }

            //   children.push(child)
            // }

            // if (children.length === 0) continue
            // current.children = children

            // if action IS NOT a divider, pass it
            if (!current.classes.includes(`divider`)) actions.push(current)
            else {
              // if class IS a divider
              //    ignore it if next action IS a divider /OR/ if action IS the last action
              if (!next || next.classes.includes(`divider`)) {
                // ignore it
              }
              // else, pass it
              else actions.push(current)
            }
          }

          // if no actions passed and there IS a action that should have passed
          if (actions.length === 0 && !!sideActions[0]) {
            // if that action IS NOT  a divider, pass it
            if (!sideActions[0].classes.includes(`divider`)) {
              actions.push(sideActions[0])
            }
          }

          // flag no-action as class
          if (actions.length === 0) push(data, `classes`, `no-${side}`)

          data.actions[side] = actions
        }
      })
    }

    // pre-compile childrenKeys and check for inconsistencies
    if (context._metadata?.childrenKeys) {
      const childrenKeys = context._metadata?.childrenKeys

      const prioritizedKeys = []
      for (let i = 0; i < childrenKeys.length; i++) {
        let priority = i
        let key = childrenKeys[i]

        if (isArray(key)) {
          if (isNumber(key[0])) priority = key.shift()
        }

        if (isNil(key) || key.length === 0) continue
        push(prioritizedKeys, priority, ...flattenDeep([key]))
      }

      // flatten keys
      const keys = flattenDeep(prioritizedKeys).filter(key => !isNil(key)) as string[]

      const allKeys = Object.keys(context.children ?? {})
      const missingKeys = allKeys.filter(key => !keys.includes(key))
      if (missingKeys.length > 0) {
        LOGGER.error(`Missing children keys order for:  [${missingKeys.join(`, `)}]`, context)
      }

      context._metadata.childrenKeys = [...keys, ...missingKeys]
    }

    return context
  }
}
