import type GCAManager from "./core/gca"

declare global {
  let GCA: GCAManager

  interface Window {
    GCA: GCAManager
  }
}
