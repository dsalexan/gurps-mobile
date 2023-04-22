import { findIndex, indexOf, isArray } from "lodash"
import { isNilOrEmpty } from "./lodash"

declare global {
  interface Window {
    __LOGGERS__: Record<string, Logger> | undefined
  }
}

/**
 *
 */
function hasStyles(message: any[]) {
  const last = message[message.length - 1]
  return isArray(last) && last.some(item => typeof item === `string` && !!item.match(/.*(color|padding|margin|font-size|font-weight):.*/))
}

export default class Logger {
  name: string
  openGroups: { collapsed: boolean }[]
  closeGroups: number
  timers: Record<string, { time: Date }>
  styles: Record<string, string>

  constructor(name: string) {
    this.name = name

    this.openGroups = []
    this.closeGroups = 0

    this.timers = {}
  }

  build({ ignoreName = false }: { ignoreName?: boolean } = {}, ...message: any[]): any[] {
    ignoreName = false

    const styles = hasStyles(message) ? message.pop() : []

    const args = [] as string[]
    const formats = [] as string[]

    if (!ignoreName) {
      args.push(`color: #999; font-weight: regular;`, this.name, `|`, `color: #000; font-weight: regular;`)
      formats.push(`%c`, `%s`, `%s`, `%c`)
    }

    for (let i = 0; i < message.length; i++) {
      const component = message[i]
      const style = styles[i]

      if (style && !isNilOrEmpty(style)) {
        // if (i === 0 && !ignoreName) {
        //   args.splice(0, 0, style)
        //   formats.splice(0, 0, `%c`)
        // } else {
        args.push(style)
        formats.push(`%c`)
        // }
      }

      if (typeof component === `string`) {
        formats.push(`%s`)
      } else if (typeof component === `number`) {
        if (component % 1 > 0) formats.push(`%f`)
        else formats.push(`%d`)
      } else formats.push(`%O`)

      args.push(component)
    }

    let formatString = ``
    for (const format of formats) formatString += format + (format === `%c` ? `` : ` `)
    if (formatString[formatString.length - 1] === ` `) formatString = formatString.substring(0, formatString.length - 1)

    return [formatString, ...args]
  }

  info(...message: any[]) {
    const doGroup = this.openGroups.pop()
    if (doGroup) {
      const m = this.build({}, ...message)

      if (doGroup.collapsed) console.groupCollapsed(...m)
      else console.group(...m)

      this.closeGroups++
    } else {
      const m = this.build({ ignoreName: this.closeGroups > 0 }, ...message)

      console.log(...m)
    }

    return this
  }

  warn(...message: any[]) {
    console.warn(...this.build({ ignoreName: this.closeGroups > 0 }, ...message))
    return this
  }

  error(...message: any[]) {
    console.error(...this.build({}, ...message))
    return this
  }

  group(collapsed?: boolean) {
    const needsClosing = this.closeGroups > 0

    if (needsClosing) {
      console.groupEnd()
      this.closeGroups--
      return this
    } else {
      this.openGroups.push({ collapsed: !!collapsed })

      return this
    }
  }

  openGroup(collapsed?: boolean) {
    this.openGroups.push({ collapsed: !!collapsed })

    return this
  }

  time(key: string | number, ...message: any[]) {
    this.timers[key] = { time: new Date() }

    if (hasStyles(message) || message.length > 1) {
      const args = [] as any[]
      if (hasStyles(message) && message.length === 1) args.push(key)
      args.push(...message)

      console.log(...this.build({ ignoreName: this.closeGroups > 0 }, ...args))
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const loggerInstance = this
    const endMessageFunction = function (...endMessage: any[]) {
      return loggerInstance.timeEnd(key, ...endMessage)
    }
    endMessageFunction.group = function (collapsed?: boolean) {
      loggerInstance.group(collapsed)
      return endMessageFunction
    }
    return endMessageFunction
  }

  timeEnd(key: string | number, ...endMessage: any[]) {
    const elapsedTime = new Date().getTime() - this.timers[key].time.getTime()

    const styles = [] as string[]
    styles.push(...(hasStyles(endMessage) ? endMessage.pop() : Array(endMessage.length)))

    let timestamp = endMessage.length === 0 ? [`Elapsed Time:`, `${elapsedTime}ms`] : [`(${elapsedTime}ms)`]
    styles.push(...(endMessage.length === 0 ? [`font-style: italic; font-weight: regular; color: #999;`, `font-weight: bold;`] : [`font-style: italic; font-weight: bold;`]))

    const m = this.build({ ignoreName: this.closeGroups > 0 }, ...endMessage, ...timestamp, styles)
    console.log(...m)

    return this
  }

  get(name: string) {
    return Logger.get(`${this.name}∙${name}`)
  }

  static get(name: string) {
    if (window.__LOGGERS__ === undefined) window.__LOGGERS__ = {}

    let instance: Logger
    if (window.__LOGGERS__[name] !== undefined) instance = window.__LOGGERS__[name]
    else {
      instance = new Logger(name)
      window.__LOGGERS__[name] = instance
    }

    return instance
  }
}
