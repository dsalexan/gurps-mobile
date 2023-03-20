import _list from "./list.json"

const list = _list as Record<
  string,
  {
    name: string
    viewbox: string
    svg: string
  }
>
export const ICONS = Object.keys(list)

export const SVGS = ICONS.reduce((obj, icon) => {
  const viewbox = list[icon].viewbox ? `viewBox="${list[icon].viewbox}"` : ``

  obj[icon] = `<svg class="icon custom" fill="currentColor" ${viewbox}>${list[icon].svg}</svg>`
  return obj
}, {}) as Record<string, string>
