/* eslint-disable @typescript-eslint/ban-types */
export function readCSSfile(): Promise<void>
export function parseCss(text: any): Promise<
  {
    selectorText: string
    style: {}
  }[]
>
export function parseRule(css: any): Promise<{}>
export function stringifyRule(style: any): Promise<string>
export function findSelectorRule(parsedCSS: any, selector: any, rule: any): Promise<any>
export function processFoundRule(rule: any, foundRule: any): Promise<any>
export function hex(x: any): Promise<string>
export function getColorArr(x: any): Promise<string[]>
