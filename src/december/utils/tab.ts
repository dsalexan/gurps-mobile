/**
 *
 */
export default function (html: JQuery<HTMLElement>, root = ``, callback: (value: any) => void) {
  /**
   *
   */
  function select(value: any) {
    const tabs = $(html.find(`${root} .tabs`))
    const currentValue = tabs.data(`value`)

    if (value === currentValue) return

    tabs.data(`value`, value)
    tabs.find(`.tab.selected`).removeClass(`selected`)
    tabs.find(`.tab[data-value="${value}"]`).addClass(`selected`)

    const panels = $(html.find(`${root} .panels`))

    panels.find(`.panel.selected`).removeClass(`selected`)
    panels.find(`.panel[data-value="${value}"]`).addClass(`selected`)

    callback(value)
  }

  // listen
  html.find(`${root} .tabs .tab`).on(`click`, function () {
    select($(this).data(`value`))
  })
}
