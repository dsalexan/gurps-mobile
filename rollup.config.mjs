import typescript from "@rollup/plugin-typescript"
import { nodeResolve } from "@rollup/plugin-node-resolve"

export default () => ({
  input: `src/module/gurps-mobile.ts`,
  output: {
    dir: `dist/module`,
    format: `es`,
    sourcemap: true,
  },
  plugins: [nodeResolve(), typescript()],
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
