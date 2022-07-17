/* eslint-disable quotes */
import typescript from "@rollup/plugin-typescript"
import resolve from "@rollup/plugin-node-resolve"
import peerDepsExternal from "rollup-plugin-peer-deps-external"
import nodePolyfills from "rollup-plugin-node-polyfills"
import replace from "@rollup/plugin-replace"
import { babel } from "@rollup/plugin-babel"
import commonjs from "@rollup/plugin-commonjs"
import ignore from "rollup-plugin-ignore"
import externalGlobals from "rollup-plugin-external-globals"
import livereload from "rollup-plugin-livereload"
import { typescriptPaths } from "rollup-plugin-typescript-paths"

const externals = {
  react: "React",
  "react-dom": "ReactDOM",
  "@mui/material": "MaterialUI",
  // components: "Components",
}

export default () => ({
  input: `src/module/gurps-mobile.ts`,
  output: {
    dir: `dist/module`,
    format: `es`,
    sourcemap: true,
  },
  external: Object.keys(externals),
  globals: externals,
  plugins: [
    replace({
      "process.env.NODE_ENV": JSON.stringify(`development`),
    }),
    // nodePolyfills(),
    // // This prevents needing an additional `external` prop in this config file by automaticall excluding peer dependencies

    peerDepsExternal(),
    // "...locates modules using the Node resolution algorithm"
    // Allow bundling cjs modules. Rollup doesn't understand cjs
    // ignore(["react", "react-dom"]),

    externalGlobals(externals),
    typescriptPaths(),
    typescript(),
    babel({
      extensions: [`.js`, `.jsx`, `.ts`, `.tsx`],
      babelHelpers: `bundled`,
      presets: [[`@babel/preset-react`], [`@babel/preset-typescript`]],
      include: [`src/**/*`],
    }),
    commonjs(),
    resolve({
      extensions: [`.js`, `.jsx`, `.ts`, `.tsx`],
      // skip: ["react", "react-dom"],
    }),
    // livereload({
    //   watch: "dist",
    //   // verbose: false, // Disable console output

    //   // other livereload options
    //   port: 30000,
    //   delay: 300,
    // }),
  ],
})

// import typescript from 'rollup-plugin-typescript2';
// import resolve from '@rollup/plugin-node-resolve';
// import commonjs from '@rollup/plugin-commonjs';

// export default {
// 	input: `src/main.tsx`,
// 	output: {
// 		file: `public/index.js`,
// 		format: `es`
// 	},
// 	plugins: [
// 		resolve(),
// 		commonjs(),
// 		typescript(),
// 	]
// };
