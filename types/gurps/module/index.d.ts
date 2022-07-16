import "./gurps"
import "./actor"
import "./token"
import "./chat"
import "./effects"
import "./pdf-refs"

import type { GURPS } from "./gurps"

declare global {
  const GURPS: GURPS
}
