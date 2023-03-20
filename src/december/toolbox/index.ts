import { EventEmitter } from "@billjs/event-emitter"
import LOGGER from "./logger"

export class Toolbox extends EventEmitter {
  DOM?: {
    toolbox: JQuery<HTMLElement>
    openActor: JQuery<HTMLElement>
  }

  // #region DOM

  onLoad() {
    // Inject HTML
    this.build()

    // DOM events
    document.addEventListener(`fullscreenchange`, () => setTimeout(this.onResize.bind(this), 100))
    window.addEventListener(`resize`, this.onResize.bind(this))
    window.addEventListener(`scroll`, this.onResize.bind(this))

    this.onResize()
  }

  onResize() {
    // pass
  }

  // #endregion

  // #region FOUNDRY

  // FOUNDRY EVENTS
  onInit() {
    LOGGER.info(`Initializing Toolbox...`)
  }

  onReady() {
    // pass
  }

  // #endregion

  // #region METHODS

  build() {
    const toolbox = $(`<div id="december-toolbox" class="toolbox"></div>`)

    const openActor = $(`<a class="button-wrapper open-actor disabled">
      <div class="label name">
        Open Actor
      </div>
      <div class="label disabled">
        —
      </div>
      <div class="button">
        <i class="icon fas fa-user"></i>
      </div>
    </a>`)
      .appendTo(toolbox)
      .on(`click`, () => {
        this.fire(`open-actor`)
      })

    toolbox.appendTo(`body`)

    this.DOM = {
      toolbox,
      openActor,
    }
  }

  // #endregion
}
