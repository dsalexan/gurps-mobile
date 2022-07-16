const defaultTheme = require(`tailwindcss/defaultTheme`)
const daisyui = require(`daisyui`)

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [`./src/templates/**/*.{html,hbs}`],
  theme: {
    extend: {
      fontFamily: {
        sans: [`Inter var`, ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [daisyui],

  // daisyUI config (optional)
  daisyui: {
    styled: true,
    themes: true,
    base: true,
    utils: true,
    logs: true,
    rtl: false,
    prefix: ``,
    darkTheme: `light`,
  },
}
