import { GURPS4th } from "./gurps4th"

export namespace GCS {
  type Entry = {
    id: string
    name: string
    description?: string
    specialization?: string
    type?: string
    calc?: {
      points: number
      rsl: string | null
    }
    points_per_level?: number
    defaults?: EntryDefault[]
    //
    weapons: {
      type: never
    }[]
    notes?: string | string[]
    vtt_notes?: string
    tags?: string[]
    features?: Feature[]
    //
    reference: string[]
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
    ammount?: number
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
