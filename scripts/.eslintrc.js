/* eslint-disable no-undef */
// process.env.NODE_ENV = process.env.NODE_ENV || `development`
// process.env.BABEL_ENV = process.env.BABEL_ENV || `development`

const fs = require(`fs`)
const path = require(`path`)

const prettierOptions = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../.prettierrc`), `utf8`))

module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
  },

  extends: [`eslint:recommended`, `plugin:prettier/recommended`],

  parserOptions: {
    ecmaVersion: `latest`,
    sourceType: `module`,
  },

  plugins: [`prettier`],

  rules: {
    "prettier/prettier": [`error`, prettierOptions],
    //
    // "json/*": [`error`, `allowComments`],
    //
    "no-debugger": [`off`],
    "no-useless-escape": [`off`],
    "prefer-const": [`off`],
    semi: [`off`],
    quotes: [`warn`, `backtick`],
    "no-undef": [`error`],
    "no-unused-vars": [`off`],
    "no-sparse-arrays": [`off`],
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
  },
}
