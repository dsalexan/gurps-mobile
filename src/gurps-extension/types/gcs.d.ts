import { GURPS4th } from "./gurps4th"

export namespace GCS {
  interface Entry extends Record<string, unknown> {
    id: string
    name: string
    description?: string
    specialization?: string
    type?: string
    calc?: {
      points: number
      rsl: string | null
      extended_value?: number
      extended_weight?: string
    }
    points_per_level?: number
    defaults?: EntryDefault[]
    //
    weapons?: Entry[]
    notes?: string | string[]
    vtt_notes?: string
    tags?: string[]
    features?: Feature[]
    tech_level?: string
    //
    reference: string[]
    conditional?: string[]
    // weapons
    usage?: string
  }

  interface EntryDefault {
    type: `skill` | Lowercase<GURPS4th.Attributes>
    name?: string
    specialization?: string
    modifier?: string
  }

  interface Feature {
    type: string
    attribute?: string
    amount?: number
    situation?: string
  }

  // interface SkillDefault {
  //   name: string
  //   specialization?: string
  //   type: `skill` | Lowercase<GURPS4th.Attributes>
  //   modifier: never
  // }

  // interface WeaponDefault {
  //   type: string
  //   attribute?: Lowercase<GURPS4th.Attributes>
  //   fullName?: string
  //   name?: string
  //   specialization?: string
  //   modifier: string
  //   trained: boolean
  // }
}
