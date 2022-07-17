/**
 * This is your TypeScript entry file for Foundry VTT.
 * Register custom settings, sheets, and constants using the Foundry API.
 * Change this heading to be more descriptive to your module, or remove it.
 * Author: [your name]
 * Content License: [copyright and-or license] If using an existing system
 * 					you may want to put a (link to a) license or copyright
 * 					notice here (e.g. the OGL).
 * Software License: [your license] Put your desired license here, which
 * 					 determines how others may use and modify your module.
 */

// Import TypeScript modules
import settings, { getSetting, registerSettings } from "./settings"
import { preloadTemplates } from "./preloadTemplates"
import LOGGER from "./logger"

import { MobileGurpsActorSheet } from "./actor/actor-sheet"

// injecting styles
// document.querySelector(`head`)?.appendChild($(`<link rel="stylesheet" href="http://cdn.jsdelivr.net/npm/@mdi/font@6.9.96/css/materialdesignicons.min.css">`)[0])
document.querySelector(`head`)?.appendChild($(`<link rel="stylesheet" href="https://rsms.me/inter/inter.css">`)[0])
document.querySelector(`head`)?.appendChild($(`<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap"/>`)[0])
document.querySelector(`head`)?.appendChild($(`<link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">`)[0])
// document.querySelector(`head`)?.appendChild($(`<script src="https://unpkg.com/react@17/umd/react.development.js" crossorigin></script>`)[0])
// document.querySelector(`head`)?.appendChild($(`<script src="https://unpkg.com/react-dom@17/umd/react-dom.development.js" crossorigin></script>`)[0])
$.getScript(`https://unpkg.com/react@17/umd/react.development.js`)
$.getScript(`https://unpkg.com/react-dom@17/umd/react-dom.development.js`)
$.getScript(`https://unpkg.com/@mui/material@latest/umd/material-ui.development.js`)
// $.getScript(`https://cdn.jsdelivr.net/npm/mdi-material-ui@7.4.0/index.min.js`)

// Initialize module
Hooks.once(`init`, async () => {
  LOGGER.info(`Initializing...`)

  // Assign custom classes and constants here

  // Register custom module settings
  registerSettings({
    // [settings.SHOW_MOBILE_TOGGLE]: Mobile.toggleMobileButton,
    // [settings.MOBILE_MODE]: Mobile.onModeChange,
  })

  // Preload Handlebars templates
  await preloadTemplates()

  // Register custom sheets (if any)
  Actors.registerSheet(`gurps`, MobileGurpsActorSheet, {
    // Add this sheet last
    label: `Mobile`,
    makeDefault: false,
  })
})

// Setup module
Hooks.once(`setup`, async () => {
  // Do anything after initialization but before
  // ready
})

// When ready
Hooks.once(`ready`, async () => {
  // Do anything once the module is ready
})

// Add any additional hooks if necessary
