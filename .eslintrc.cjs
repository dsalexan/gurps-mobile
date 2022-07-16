module.exports = {
  parser: `@typescript-eslint/parser`,

  parserOptions: {
    ecmaVersion: 2020,
    extraFileExtensions: [`.cjs`, `.mjs`],
    sourceType: `module`,
    project: `./tsconfig.eslint.json`,
  },

  env: {
    browser: true,
  },

  extends: [`plugin:@typescript-eslint/recommended`, `plugin:prettier/recommended`],

  plugins: [`@typescript-eslint`],

  rules: {
    // Specify any specific ESLint rules.
    quotes: [`warn`, `backtick`],
    "@typescript-eslint/no-var-requires": `off`,
    "@typescript-eslint/ban-types": `off`,
    "@typescript-eslint/no-namespace": `off`,
  },

  overrides: [
    {
      files: [`./*.cjs`],
      rules: {},
    },
  ],
}
