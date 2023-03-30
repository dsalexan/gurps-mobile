/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
// process.env.NODE_ENV = process.env.NODE_ENV || `development`
// process.env.BABEL_ENV = process.env.BABEL_ENV || `development`

const fs = require(`fs`)
const path = require(`path`)

const prettierOptions = JSON.parse(fs.readFileSync(path.resolve(__dirname, `.prettierrc`), `utf8`))

module.exports = {
  env: {
    browser: true,
    es2021: true,
  },

  globals: {
    december: true,
    GURPS: true,
    JQuery: true,
    $: true,
    GCA: true,
  },

  extends: [`eslint:recommended`, `plugin:prettier/recommended`, `plugin:@typescript-eslint/recommended`, `@typhonjs-fvtt/eslint-config-foundry.js`],

  parser: `@typescript-eslint/parser`,

  parserOptions: {
    ecmaVersion: `latest`,
    sourceType: `module`,
  },

  plugins: [`prettier`, `@typescript-eslint`],

  rules: {
    "prettier/prettier": [`error`, prettierOptions],
    //
    // "json/*": [`error`, `allowComments`],
    //
    "prefer-const": [`off`],
    semi: [`off`],
    quotes: [`warn`, `backtick`],
    "no-undef": [`error`],
    "no-unused-vars": [`off`],
    "no-sparse-arrays": [`off`],
    "no-useless-escape": [`off`],
    "jsdoc/require-param": [`off`],
    "jsdoc/require-param-description": [`off`],
    "jsdoc/require-returns-description": [`off`],
    "jsdoc/require-returns": [`off`],
    //
    // "@typescript-eslint/no-shadow": [
    //   `error`,
    //   {
    //     builtinGlobals: true,
    //     hoist: `all`,
    //     allow: [`document`, `event`, `name`, `parent`, `status`, `top`, `GURPS`, `getType`, `context`, `origin`, 'logger'],
    //   },
    // ],
    //
    //
    "@typescript-eslint/ban-ts-comment": [`warn`],
    "@typescript-eslint/no-unsafe-call": [`off`],
    "@typescript-eslint/no-unsafe-return": [`off`],
    "@typescript-eslint/no-unsafe-argument": [`off`],
    "@typescript-eslint/no-explicit-any": [`warn`],
    "@typescript-eslint/no-unsafe-member-access": [`off`],
    "@typescript-eslint/no-unsafe-assignment": [`off`],
    "@typescript-eslint/no-floating-promises": [`off`],
    "@typescript-eslint/require-await": [`off`],
    "@typescript-eslint/restrict-template-expressions": [`off`],
  },
}
