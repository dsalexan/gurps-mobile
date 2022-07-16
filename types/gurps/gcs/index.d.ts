/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable quotes */
declare namespace GCS {
  namespace V2 {
    namespace Partial {
      export type Attritubes = {
        data: {
          attributes: any
          HP: any
          FP: any
          basiclift: any
          basicmove: any
          basicspeed: any
          thrust: any
          swing: any
          currentmove: number
          frightcheck: any
          hearing: any
          tastesmell: any
          touch: any
          vision: any
          liftingmoving: {
            basiclift: string
            carryonback: string
            onehandedlift: string
            runningshove: string
            shiftslightly: string
            shove: string
            twohandedlift: string
          }
          currentdodge: number
          "-=encumbrance": any
          encumbrance: {}
          QP: any
        }
      }

      export type Traits = {
        data: {
          "-=traits": any
          traits: {
            race: string
            height: any
            weight: any
            age: any
            title: any
            player: any
            createdon: any
            modifiedon: any
            religion: any
            birthday: any
            hand: any
            techlevel: any
            gender: any
            eyes: any
            hair: any
            skin: any
          }
        }
      }

      export type Protection = {
        data: {
          "-=hitlocations": null
          hitlocations: any
          additionalresources: {
            bodyplan: string
          }
        }
      }

      export type PointTotals = {
        data: {
          totalpoints: {
            attributes: number
            ads: number
            disads: number
            quirks: number
            skills: number
            spells: number
            unspent: any
            total: any
            race: number
          }
        }
      }

      export type Reactions = {
        data: {
          "-=reactions": any
          reactions: {}
          "-=conditionalmods": any
          conditionalmods: {}
        }
      }

      export type Combat = {
        data: {
          "-=melee": any
          melee: {}
          "-=ranged": any
          ranged: {}
        }
      }
    }
  }
}
