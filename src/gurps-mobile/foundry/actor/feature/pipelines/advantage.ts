import { IDerivationPipeline, proxy } from "."
import { ILevelDefinition, parseLevelDefinition } from "../../../../../gurps-extension/utils/level"
import { MigrationDataObject, OVERWRITE, PUSH } from "../../../../core/feature/compilation/migration"
import { IGenericFeatureData } from "./generic"
import { IWeaponizableFeatureData } from "./weaponizable"

export interface IAdvantageFeatureData extends IGenericFeatureData, IWeaponizableFeatureData {
  rolls?: ILevelDefinition[]
  cost: string
}

export const AdvantageFeaturePipeline: IDerivationPipeline<IAdvantageFeatureData> = [
  // #region GCS
  // #endregion
  // #region GCA
  proxy.gca(`cost`),
  // #endregion
]

AdvantageFeaturePipeline.name = `AdvantageFeaturePipeline`
AdvantageFeaturePipeline.conflict = {}

AdvantageFeaturePipeline.post = function postAdvantage(data) {
  const MDO = {} as MigrationDataObject<any>

  if (data.has(`meta`)) {
    const meta = data.get(`meta`)
    if (meta.includes(`:`)) {
      const [meta1, links] = linkFromVTTNotes(meta)

      MDO.meta = OVERWRITE(`meta`, meta1)
      MDO.links = PUSH(`links`, links)
    }
  }

  if (data.has(`notes`)) {
    const notes = data.get(`notes`)
    if (notes.length > 0) {
      const _notes = [] as string[]
      const rolls = [] as ILevelDefinition[]

      for (const note of notes) {
        if (!note.includes(`CR`)) _notes.push(note)
        else {
          const [notes2, cr] = selfControlRolls(note)

          _notes.push(notes2)
          rolls.push(cr)
        }
      }

      MDO.notes = OVERWRITE(`notes`, _notes)
      MDO.rolls = PUSH(`rolls`, rolls)
    }
  }

  return MDO
}

function linkFromVTTNotes(_meta: string) {
  const pattern = / ?\w+:([\w:]+)\w+\b ?/gi
  const links = _meta.match(pattern)
  const meta = _meta.replace(pattern, ``)

  return [meta, links ? links.map(match => match.replace(/ */gi, ``).replace(/:/gi, `.`)) : []] as [string, string[]]
}

function selfControlRolls(_notes: string) {
  const pattern = /\[CR: (\d+) \(([\w ]+)\): (.+)\]/
  const cr = _notes.match(pattern)
  const notes = _notes.replace(pattern, ``)

  debugger

  const definition = parseLevelDefinition({
    type: `flat`,
    name: cr?.[2],
    specialization: `Self-Control Roll`,
    value: cr?.[1],
  })
  definition.tags = [`self_control`]

  debugger
  return [notes, definition] as const
}
