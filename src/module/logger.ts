import { MODULE_ID } from "./config"

class Logger {
  name: string

  constructor(name: string) {
    this.name = name
  }

  build(...message: any[]) {
    // return `${this.name} | ${message.join(`  `)}`

    const formats = []

    for (const component of message) {
      if (typeof component === `string`) formats.push(`%s`)
      else if (typeof component == `number`) {
        if (component % 1 > 0) formats.push(`%f`)
        else formats.push(`%d`)
      } else formats.push(`%O`)
    }

    return [`${this.name} | ${formats.join(` `)}`, ...message]
  }

  info(...message: any[]) {
    console.log(...this.build(...message))
  }

  warning(...message: any[]) {
    console.warn(...this.build(...message))
  }
}

const LOGGER = new Logger(MODULE_ID)

export default LOGGER
