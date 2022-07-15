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
