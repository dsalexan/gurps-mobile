import { GurpsMobileActorSheet } from ".."

const SHEET_SERVER = [`G:\\My Drive\\RPG\\GURPS\\GCS\\`, `http://localhost:3456/`]

/**
 *
 */
export function render(sheet: GurpsMobileActorSheet, html: JQuery<HTMLElement>) {
  // Portrait
  html.find(`.header .overlay`).on(`click`, () => html.find(`.portrait-viewer`).removeClass(`hidden`))
  html.find(`.portrait-viewer .header .close`).on(`click`, () => html.find(`.portrait-viewer`).addClass(`hidden`))

  // Bar
  html.find(`.header .header-bar .close`).on(`click`, () => december.closeWindow())
  html.find(`.header .header-bar .fullgcs`).on(`click`, () => sheet.openDesktopSheet())
  html
    .find(`.header .header-bar .import`)
    .on(`click`, () => sheet.actor.importCharacter({ pattern: new RegExp(`${SHEET_SERVER[0].split(`\\`).join(`[/\\\\]`)}(.*)`), server: SHEET_SERVER[1] }))
}
