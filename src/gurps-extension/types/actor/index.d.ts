// eslint-disable-next-line quotes
declare module "gurps/module/actor" {
  namespace MoveModes {
    const Ground: string
    const Air: string
    const Water: string
    const Space: string
  }

  class GurpsActor extends Actor {
    ignoreRender: boolean
    system: object & {
      _import: Record<string, object>
      attributes: Record<`ST` | `DX` | `IQ` | `HT`, { value: number }>
      basicspeed: { value: string; points: number }
      move: Record<
        string,
        {
          mode: string
          basic: string
          default: boolean
        }
      >
    }
    flags: Record<string, any>
    popOut: boolean

    updateSource(changes: object, options: object): object
    openSheet(sheetName: string): void

    setMoveDefault(path: string)
  }
}
