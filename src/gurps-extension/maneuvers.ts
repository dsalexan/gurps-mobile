import LOGGER from "logger"
import Icons from "./icons.mjs"

/**
 *
 */
function remakeManeuvers(moduleID: string) {
  const filepath = `modules/${moduleID}/icons/maneuvers/`

  const maneuvers = GURPS.Maneuvers._maneuvers
  for (const [name, maneuver] of Object.entries(maneuvers)) {
    const _icons = Icons[name]
    const iconArray = Array.isArray(_icons) ? _icons : [_icons]

    let iconName = undefined as string | undefined
    if (name === `do_nothing`) iconName = `man-do-nothing`
    else if (name === `move`) iconName = `man-move`
    else if (name === `aim`) iconName = `man-aim`
    // all out attack
    else if (name === `allout_attack`) iconName = `man-allout-attack`
    else if (name === `aoa_determined`) iconName = `man-aoa-determined`
    else if (name === `aoa_double`) iconName = `man-aoa-double`
    else if (name === `aoa_feint`) iconName = `man-aoa-feint`
    else if (name === `aoa_strong`) iconName = `man-aoa-strong`
    // all out defense
    else if (name === `allout_defense`) iconName = `man-allout-defense`
    else if (name === `aod_block`) iconName = `man-aod-block`
    else if (name === `aod_dodge`) iconName = `man-aod-dodge`
    else if (name === `aod_parry`) iconName = `man-aod-parry`
    else if (name === `aod_double`) iconName = `man-aod-double`
    else if (name === `aod_mental`) iconName = `man-aod-mental`
    //
    else if (name === `attack`) iconName = `man-attack`
    else if (name === `concentrate`) iconName = `man-concentrate`
    else if (name === `evaluate`) iconName = `man-evaluate`
    else if (name === `feint`) iconName = `man-feint`
    else if (name === `move_and_attack`) iconName = `man-move-and-attack`
    else if (name === `ready`) iconName = `man-ready`
    else if (name === `wait`) iconName = `man-wait`

    if (iconName === undefined) {
      LOGGER.warn(`No icon name provided for "${name}" override, skipping...`)
    } else {
      maneuver._data.icon = `${filepath}${iconName}.png`
      // maneuver._data.icons = iconArray.map((_, index) => `${filepath}${iconName}${index === 0 ? `` : `-` + index.toString()}.png`)
    }
  }
}

/**
 *
 */
// eslint-disable-next-line @typescript-eslint/no-empty-function
function hijackManeuvers() {}

/**
 *
 */
export default function (moduleID: string) {
  remakeManeuvers(moduleID)

  // hijack "Maneuvers" class exported from actor/maneuvers.js in gurps
  // token.js
  // Hooks.on(`hooks:before:createToken`, function (...args) {
  //   console.log(`a hook for create token is to be registered`, Hooks._hooks.createToken, `x`, ...args)
  // })

  // Hooks.on(`hooks:on:createToken`, function (hook, fn) {
  //   if (fn.includes(`async _createToken(`) && fn.includes(`/** @type {GurpsActor} */ (token.actor)`)) {
  //     const index = Hooks._hooks.createToken.indexOf(fn => fn === fn)
  //     const method = Hooks._hooks.createToken[index]

  //     console.log(`a hook for create token was registered`, Hooks._hooks.createToken, `x`, fn, `@`, fn)
  //   }
  // })

  // const GurpsToken = CONFIG.Token.objectClass
  // const original_drawEffects = GurpsToken.drawEffects

  // GurpsToken.drawEffects = (...args) => original_drawEffects.call({ Maneuvers: `kkkk` }, ...args)

  // const hooks = Hooks._hooks.createToken
  // for (let f of Hooks._hooks.createToken.filter(f => f.toString().includes(`createEmbeddedDocuments("Drawing"`))) Hooks.off(`preUpdateToken`, f)
}
