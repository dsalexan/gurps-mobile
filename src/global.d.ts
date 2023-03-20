import type { December } from "./december"

declare global {
  let december: December

  interface Window {
    december: December
  }
}
