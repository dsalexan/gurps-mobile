import GURPSIcons from "gurps-extension/icons.mjs"
import * as CustomIcons from "../assets/icons"

export class TemplatePreloader {
  static preloadHandlebarsHelpers() {
    Handlebars.registerHelper(`isCustomIcon`, value => !!CustomIcons.SVGS[value])

    Handlebars.registerHelper(`customIcon`, function (value: string) {
      const icon = CustomIcons.SVGS[value]

      if (!icon) return `<div>custom icon "${value}" not found</div>`

      return new Handlebars.SafeString(icon)
    })

    Handlebars.registerHelper(`gurpsIcon`, function (value: string) {
      if (value.includes(`mdi-`)) return new Handlebars.SafeString(`<i class="icon mdi ${value}"></i>`)

      const icon = GURPSIcons[value] as string

      if (icon?.includes(`mdi-`)) return new Handlebars.SafeString(`<i class="icon mdi ${icon}"></i>`)

      const node = CustomIcons.SVGS[icon]

      if (node) return new Handlebars.SafeString(node)

      return `<div>${icon ? `custom` : `gurps`} icon "${icon ? icon : value}" not found</div>`
    })

    Handlebars.registerHelper(`gurpsLabel`, function (value: string) {
      return HandlebarsHelpers.localize(GURPS.Maneuvers.get(value)?.label ?? `unknown`, {} as HandlebarsHelpers.LocalizeOptions)
    })
  }
}
