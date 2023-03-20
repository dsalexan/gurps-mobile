import type { Entry, PreCompiledIndex } from "./types"

declare global {
  interface Window {
    GCA_ENTRIES: Record<number, Entry>
    GCA_INDEX: PreCompiledIndex<Record<string, number[]>>
  }
}

export {}
