/**
 *
 * @param {number} duration - ms
 */
export default function delay(duration: number) {
  return new Promise(resolve => setTimeout(resolve, duration))
}

/**
 *
 * @param el
 */
export function waitForElementVisible(el: HTMLElement): Promise<{ element: HTMLElement; box: DOMRect }> {
  return new Promise((resolve, reject) => {
    el.style.overflow = `hidden`
    requestAnimationFrame(timeStamp => {
      let box = el.getBoundingClientRect()
      el.style.overflow = ``
      resolve({ element: el, box })
    })
  })
}
