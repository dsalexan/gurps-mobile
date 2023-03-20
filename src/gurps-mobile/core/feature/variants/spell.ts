import { flattenDeep, get, has, isEmpty, isNil, set } from "lodash"
import { v4 as uuidv4 } from "uuid"

import { fromValue, SPELL } from "../types"

import { GurpsMobileActor } from "../../../foundry/actor"

import BaseFeature, { FeatureTemplate } from "../base"
import SkillFeature from "./skill"
import SpellFeatureCompilationTemplate from "../compilation/templates/spell"
import { ISpellFeature } from "../compilation/templates/spell"

export default class SpellFeature extends SkillFeature implements ISpellFeature {
  spellClass: string
  cost: string
  castingTime: string
  maintain: string
  duration: string
  resist?: string
  powerSorce?: string

  constructor(key: string | number, prefix = `system.melee.`, parent: BaseFeature | null = null, template: FeatureTemplate<any>) {
    super(key, prefix, parent, template)
    this.addCompilation(SpellFeatureCompilationTemplate)
  }

  // INTEGRATING
  integrate(actor: GurpsMobileActor) {
    super.integrate(actor)

    return this
  }
}
