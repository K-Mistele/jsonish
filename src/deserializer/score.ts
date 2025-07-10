// Mirrors Rust jsonish/src/deserializer/score.rs

import type { BamlValueWithFlags } from './types'
import { score as scoreValue } from './types'

// Interface for types that can be scored
export interface WithScore {
  score(): number
}

// Export the score function for BamlValueWithFlags
export { scoreValue as score }