const MOVE_NONE = `none`
const MOVE_ONE = `1`
const MOVE_STEP = `step`
const MOVE_ONETHIRD = `×1/3`
const MOVE_HALF = `half`
const MOVE_TWOTHIRDS = `×2/3`
const MOVE_FULL = `full`

const base = {
  hit_location: `body-scan-fill`,
  attribute: `mdi-account`,
  advantage: `mdi-arrow-up-thick`, // options
  disadvantage: `mdi-arrow-down-thick`, // options
  skill: `mdi-hexagon-multiple`,
  untrained_skill: `mdi-hexagon-multiple-outline`,
  spell: `spell`,
  equipment: `mdi-bag-personal`,
  hp: `mdi-heart`,
  fp: `mdi-lightning-bolt`,
  reeling: `heart-down`,
  tired: `lightning-bolt-down`,
  //
  reaction: `mdi-thumb-up`,
  reaction_negative: `mdi-thumb-down`,
  //
  ranged: `mdi-bow-arrow`,
  melee: `mdi-sword-cross`,
  // basic
  to_hit: `3d6`,
  damage: `critical-strike`,
  coin: `profit`,
  // move
  move_none: `no-move`,
  move: `move`,
  move_step: `move-step`,
  move_one_third: `move-fraction-one-third`,
  move_half: `move-fraction-one-half`,
  move_two_thirds: `move-fraction-two-thirds`,
  move_sprinting: `sprint`,
  // maneuvers
  maneuver: `mdi-strategy`,
  do_nothing: `mdi-cancel`,
  ready: `sword-over-shield`,
  concentrate: `mdi-meditation`,
  wait: `mdi-timer-sand`,
  move_and_attack: `move-sword`,
  attack: `mdi-sword`,
  aim: `target`,
  evaluate: `achilles-heel`,
  feint: `sword-mask`,
  allout_attack: `flaming-sword`,
  aoa_determined: `flaming-sword-plus-2`,
  aoa_double: `flaming-sword-2-times`,
  aoa_feint: `flaming-sword-mask`,
  aoa_strong: `flaming-sword-weight`,
  allout_defense: `medieval-shield`,
  aod_block: `medieval-shield-viking-shield`,
  aod_dodge: `medieval-shield-man-avoid-evade`,
  aod_parry: `medieval-shield-rapier`,
  aod_double: `medieval-shield-2-times`,
  aod_mental: `sword-and-shield-brain`,
  // defenses
  defense: `security`,
  block: `security-viking-shield`,
  dodge: `security-man-avoid-evade`,
  parry: `security-rapier`,
  minimal_block: `viking-shield`,
  minimal_dodge: `man-avoid-evade`,
  minimal_parry: `rapier`,
  no_defense: `security-no`,
  no_block: `security-viking-shield-no`,
  no_dodge: `security-man-avoid-evade-no`,
  no_parry: `security-rapier-no`,
}

const alternatives = {
  attributes: `attribute`,
  // move
  [`move_${MOVE_NONE}`]: `move_none`,
  [`move_${MOVE_ONE}`]: `move_step`,
  [`move_${MOVE_STEP}`]: `move_step`,
  [`move_${MOVE_ONETHIRD}`]: `move_one_third`,
  [`move_${MOVE_HALF}`]: `move_half`,
  [`move_${MOVE_TWOTHIRDS}`]: `move_two_thirds`,
  [`move_${MOVE_FULL}`]: `move`,
}

const composite = Object.assign({}, base)
for (let [key, alt] of Object.entries(alternatives)) {
  composite[key] = base[alt]
}
const keysWith_ = Object.keys(composite)
for (let key of keysWith_) {
  composite[key.replace(/_/gi, `-`)] = base[key]
}

export default composite
