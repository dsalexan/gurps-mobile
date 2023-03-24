import { flatten, flattenDeep, get, isArray, isNil } from "lodash"
import { Type } from "../../type"
import { MigrationValue, MigrationDataObject, FastMigrationDataObject, isOrigin, OVERWRITE, WRITE, PUSH } from "../migration"
import CompilationTemplate, { CompilationContext, GURPSSources } from "../template"
import { GCS } from "../../../../../gurps-extension/types/gcs"
import { typeFromGCA, typeFromGCS } from "../../utils"
import { isNilOrEmpty } from "../../../../../december/utils/lodash"
import { GCA } from "../../../gca/types"
import { GenericFeatureCompilationContext } from "./generic"
import { IFeature } from "../../base"
import { ILevelDefinition } from "../../../../../gurps-extension/utils/level"

export interface FeatureRoll {
  self_control?: boolean
  value: string | number
  label: string
}

export interface IAdvantageFeature extends IGenericFeature {
  cost: string
}

export default class AdvantageFeatureCompilationTemplate extends CompilationTemplate {
  static gcs(GCS: GCS.Entry, context: GenericFeatureCompilationContext): FastMigrationDataObject<any> | null {
    const MDO = {} as FastMigrationDataObject<any>

    const vtt_notes = get(GCS, `vtt_notes`)
    if (vtt_notes && vtt_notes.includes(`:`)) {
      const [meta1, links] = AdvantageFeatureCompilationTemplate.linkFromVTTNotes(vtt_notes)

      MDO.meta = OVERWRITE(`meta`, meta1)
      MDO.links = PUSH(`links`, links)
    }

    // @ts-ignore
    const notes = flattenDeep([get(GCS, `notes`, [])])

    if (notes) {
      const _notes = [] as string[]
      const rolls = [] as ILevelDefinition[]

      for (const note of notes) {
        if (!note.includes(`CR`)) _notes.push(note)
        else {
          const [notes2, cr] = AdvantageFeatureCompilationTemplate.selfControlRolls(note)

          debugger
          _notes.push(notes2)
          // rolls.push({
          //   tags: [`self_confol`]
          // })
        }
      }

      MDO.notes = OVERWRITE(`notes`, _notes)
      MDO.rolls = PUSH(`rolls`, rolls)
    }

    return MDO
  }

  static gca(GCA: GCA.Entry, context: GenericFeatureCompilationContext): FastMigrationDataObject<any> | null {
    return {
      cost: get(GCA, `cost`),
    }
  }

  // AUXILIAR
  static linkFromVTTNotes(_meta: string) {
    const pattern = / ?\w+:([\w:]+)\w+\b ?/gi
    const links = _meta.match(pattern)
    const meta = _meta.replace(pattern, ``)

    return [meta, links ? links.map(match => match.replace(/ */gi, ``).replace(/:/gi, `.`)) : []] as [string, string[]]
  }

  static selfControlRolls(_notes: string) {
    const pattern = /\[CR: (\d+) \(([\w ]+)\): (.+)\]/
    const cr = _notes.match(pattern)
    const notes = _notes.replace(pattern, ``)

    debugger
    return [
      notes,
      {
        value: cr?.[1],
        label: cr?.[2],
      },
    ] as [string, FeatureRoll]
  }
}
