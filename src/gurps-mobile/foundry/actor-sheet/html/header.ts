import { GurpsMobileActorSheet } from ".."

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
}
