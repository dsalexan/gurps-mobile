import { flatten, flattenDeep, get, isArray, isEmpty, isNil, set } from "lodash"
import { Type } from "../../type"
import { MigrationValue, MigrationDataObject, FastMigrationDataObject, isOrigin, OVERWRITE, WRITE, PUSH, MigratableObject } from "../migration"
import CompilationTemplate, { CompilationContext, GURPSSources } from "../template"
import { GCS } from "../../../../../gurps-extension/types/gcs"
import { typeFromGCA, typeFromGCS } from "../../utils"
import { isNilOrEmpty, isNumeric, push } from "../../../../../december/utils/lodash"
import { GCA } from "../../../gca/types"
import { ManualSourceProperty } from "../../base"
import { ISkillFeature } from "./skill"
import { parseComponentDefinition } from "../../../../../gurps-extension/utils/component"

export interface GenericFeatureManualSource {
  id?: ManualSourceProperty<string>
  tl?: ManualSourceProperty<number>
}

export interface GenericFeatureCompilationContext extends CompilationContext {
  id: string
  type: Type
}

export default class GenericFeatureCompilationTemplate extends CompilationTemplate {
  static manual(sources: GURPSSources & { manual?: GenericFeatureManualSource }, context: GenericFeatureCompilationContext): FastMigrationDataObject<any> | null {
    if (sources.manual?.id) return { id: sources.manual?.id }

    return null
  }

  static gcs(GCS: GCS.Entry, context: GenericFeatureCompilationContext): FastMigrationDataObject<any> | null {
    const isContainer = !!get(GCS, `type`, ``).match(/_container$/)

    const type = typeFromGCS(GCS)
    // CONTEXT
    context.type = type

    const container = isContainer ? OVERWRITE(`container`, true) : WRITE(`container`, false)
    const id = get(GCS, `id`)
    // CONTEXT
    context.id = id

    let name = get(GCS, `name`)
    // CONTEXT
    context.humanId = name

    let specialization = get(GCS, `specialization`)
    if (isNilOrEmpty(specialization) && !isNilOrEmpty(name)) {
      const _hasSpecialization = / \((.*)\)$/

      const hasSpecialization = name.match(_hasSpecialization)
      if (hasSpecialization) {
        name = name.replace(hasSpecialization[0], ``)
        specialization = hasSpecialization[1].replaceAll(/[\[\]]/g, ``)
      }
    }

    let tl: { level: number } = get(GCS, `tech_level`) as any
    if (tl) {
      tl = { level: parseInt(tl as any) }
      // CONTEXT
      context.tl = tl.level
    }

    const label = get(GCS, `label`)
    // @ts-ignore
    const notes = flattenDeep([get(GCS, `notes`, [])])
    const meta = get(GCS, `vtt_notes`)

    const _reference = get(GCS, `reference`)
    const reference = flatten(
      flattenDeep(isArray(_reference) ? _reference : [_reference])
        .filter(r => !isNil(r))
        .map(r => r.split(/ *, */g)),
    ).filter(ref => ref !== ``)

    let tags = get(GCS, `tags`)
    if (tags) tags = tags.filter(tag => tag !== context.type.name)

    // @ts-ignore
    const conditional = flattenDeep([get(GCS, `conditional`, [])])
    const components = get(GCS, `features`, []).map(f => parseComponentDefinition(f as any))

    return {
      type,
      id,
      name,
      //
      container,
      specialization,
      tl,
      //
      label,
      notes,
      meta,
      //
      reference: PUSH(`reference`, reference),
      tags,
      conditional,
      levels: [],
      //
      components,
    }
  }

  static gca(GCA: GCA.Entry, context: GenericFeatureCompilationContext): FastMigrationDataObject<any> | null {
    const type = typeFromGCA(GCA)
    // CONTEXT
    if (context.type === undefined) context.type = type

    const name = get(GCA, `name`)
    // CONTEXT
    if (context.humanId === undefined) context.humanId = name

    const label = get(GCA, `label`)
    let specialization = get(GCA, `nameext`)
    if (specialization) specialization = specialization.replaceAll(/[\[\]]/g, ``)
    const specializationRequired = get(GCA, `specializationRequired`)

    const tl = get(GCA, `tl`)
    const _tl = {} as Record<string, any>
    if (tl) {
      _tl.required = true
      _tl.rande = tl
    }

    const reference = PUSH(`reference`, flattenDeep([get(GCA, `page`, [])]))
    const categories = flattenDeep([get(GCA, `cat`, [])])
    const notes = PUSH(`notes`, flattenDeep([get(GCA, `itemnotes`, [])]))

    const activeDefense = {} as Record<`block` | `parry` | `dodge`, string[]>

    const blockat = get(GCA, `blockat`)
    if (blockat && !isEmpty(blockat)) push(activeDefense, `block`, blockat)

    const parryat = get(GCA, `parryat`)
    if (parryat && !isEmpty(parryat)) push(activeDefense, `parry`, parryat)

    // if (Object.keys(activeDefense).length) debugger

    return {
      type,
      //
      name,
      label,
      specialization,
      specializationRequired,
      ..._tl,
      //
      reference,
      categories,
      notes,
      //
      ...(Object.keys(activeDefense).length ? { activeDefense } : {}),
    }
  }

  static conflict(key: string, migrations: MigrationValue<any>[], context: CompilationContext, sources: GURPSSources): FastMigrationDataObject<unknown> {
    let MDO = super.conflict(key, migrations, context, sources) ?? {}

    if (key === `type`) {
      const types = flatten(Object.values(migrations)).map(migration => migration.value) as Type[]
      const nonGeneric = types.filter(type => !type.isGeneric)
      if (nonGeneric.length === 1) MDO[key] = nonGeneric[0]
      else {
        const trees = Type.uniq(nonGeneric)
        if (trees.length === 1) MDO[key] = nonGeneric[0]
        // ERROR: Unimplemented multiple trees conflict resolution
        debugger
      }
    } else if (key === `specialization`) {
      if (sources.gca.specializationRequired) {
        const gcsMigrations = migrations.filter(migration => isOrigin(migration._meta.origin, [`gcs`]))
        if (gcsMigrations.length === 1) MDO[key] = gcsMigrations[0]
        else {
          // ERROR: Unimplemented, too many migrations to decide
          debugger
        }
      } else {
        // ERROR: Unimplemented conflict between two different non-required specializations
        debugger
      }
    }

    return MDO
  }

  static post(data: MigratableObject & ISkillFeature, context: CompilationContext, sources: Record<string, object>): FastMigrationDataObject<any> | null {
    const MDO = {} as FastMigrationDataObject<any>

    if (data.tl?.required && isNilOrEmpty(data.tl)) {
      if (isNil(context.tl)) debugger
      set(data, `tl.level`, context.tl)
    }

    return MDO
  }
}
