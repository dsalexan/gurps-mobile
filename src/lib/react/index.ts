import React, { Attributes } from "react"
import ReactDOM from "react-dom"

export default function render<T>(component: React.FC<T>, args: Attributes & T, id = `react`) {
  ReactDOM.render(React.createFactory(component)(args), document.getElementById(id))
}
