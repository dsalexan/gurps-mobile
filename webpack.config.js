const fs = require(`fs`)
const path = require(`path`)
const webpack = require(`webpack`)
const resolve = require(`resolve`)
const {globSync} = require(`glob`)
const { createHash } = require(`crypto`)

const ESLintPlugin = require(`eslint-webpack-plugin`)
const { CleanWebpackPlugin } = require(`clean-webpack-plugin`)
const CopyPlugin = require(`copy-webpack-plugin`)
const ReplaceInFileWebpackPlugin = require(`replace-in-file-webpack-plugin`)
const MiniCssExtractPlugin = require(`mini-css-extract-plugin`)
const TsconfigPathsPlugin = require(`tsconfig-paths-webpack-plugin`)
const VisualizerPlugin = require(`webpack-visualizer-plugin2`)
const SpeedMeasurePlugin = require(`speed-measure-webpack-plugin`)

const globImporter = require(`node-sass-glob-importer`)
const {create} = require(`sass-alias`)

const config = require(`./config`)

const smp = new SpeedMeasurePlugin()

// Stablish paths beforehand
const DIRECTORY = fs.realpathSync(process.cwd())
const BUILD_PATH = path.resolve(DIRECTORY, `dist`)
const PACKAGE_JSON_PATH = path.resolve(DIRECTORY, `package.json`)
const APP_WEBPACK_CACHE_PATH = path.resolve(DIRECTORY, `node_modules/.cache`)
const TSCONFIG_PATH = path.resolve(DIRECTORY, `tsconfig.json`)

// style files regexes
const cssRegex = /\.css$/
const cssModuleRegex = /\.module\.css$/
const sassRegex = /\.(scss|sass)$/
const sassModuleRegex = /\.module\.(scss|sass)$/

const shouldUseSourceMap = process.env.GENERATE_SOURCEMAP !== `false`

/**
 *
 * @param env
 */
function createEnvironmentHash(env) {
  const hash = createHash(`md5`)
  hash.update(JSON.stringify(env))

  return hash.digest(`hex`)
}

module.exports = _env => {
  const env = {
    watch: false,
    mode: `development`,
    ..._env,
  }

  const isProduction = env.mode === `production`
  const isDevelopment = env.mode === `development`

  const webpackConfig = {
    entry: {
      [config.MODULE_ID]: `./src/index.ts`,
    },
    watch: env.watch,
    devtool: isProduction ? (shouldUseSourceMap ? `source-map` : false) : isDevelopment && `cheap-module-source-map`,
    stats: `minimal`,
    mode: env.mode,
    resolve: {
      extensions: [`.wasm`, `.mjs`, `.ts`, `.tsx`, `.js`, `.jsx`, `.json`],
      alias: {
        config: path.resolve(DIRECTORY, `./config`),
        december: path.resolve(DIRECTORY, `./src/december`),
        utils: path.resolve(DIRECTORY, `./src/december/utils`),
        "gurps-extension": path.resolve(DIRECTORY, `./src/gurps-extension`),
        "gurps-mobile": path.resolve(DIRECTORY, `./src/gurps-mobile`),
        logger: path.resolve(DIRECTORY, `./src/gurps-mobile/logger`),
      },
    },
    output: {
      filename: `[name].js`,
      path: path.resolve(__dirname, `dist`),
      publicPath: ``,
    },
    cache: {
      type: `filesystem`,
      version: createEnvironmentHash(process.env),
      cacheDirectory: APP_WEBPACK_CACHE_PATH,
      store: `pack`,
      buildDependencies: {
        defaultWebpack: [`webpack/lib/`],
        config: [__filename],
        tsconfig: [TSCONFIG_PATH],
      },
    },
    module: {
      rules: [
        isDevelopment
          ? {
              test: /\.html$/,
              loader: `raw-loader`,
            }
          : {
              test: /\.html$/,
              loader: `null-loader`,
            },
        {
          test: /\.svg$/,
          use: [
            {
              loader: `svg-url-loader`,
              options: {
                limit: 10000,
              },
            },
          ],
        },
        {
          test: /handlebars\.[tj]s$/,
          loader: 'string-replace-loader',
          options: {
            search: '("|\'|`)__WEBPACK__ALL_TEMPLATES__("|\'|`)',
            replace(match) {
              return globSync(`**/*.hbs`, { cwd: path.join(process.cwd(), `static/templates`) })
                .map(file => `"modules/${config.MODULE_ID}/templates/${file}"`.replaceAll(/\\/g, "/"))
                .join(`, `)
            },
            flags: 'g'
          }
        },
        {
          test: /\.ts?$/,
          use: {
            loader: `ts-loader`,
            options: {
              transpileOnly: true,
            },
          },
          exclude: /node_modules/,
        },
        {
          test: /\.js$/,
          exclude: /(node_modules|bower_components)/,
          use: [
            {
              loader: require.resolve(`babel-loader`),
            },
            `webpack-import-glob-loader`,
            `source-map-loader`,
          ],
        },
        {
          test: /\.css$/,
          use: [
            // `style-loader`,
            MiniCssExtractPlugin.loader,
            {
              loader: `css-loader`,
              options: {
                sourceMap: isDevelopment,
                url: false,
                importLoaders: 1,
              },
            },
            {
              loader: `postcss-loader`,
              options: {
                postcssOptions: {
                  config: path.resolve(__dirname, `postcss.config.js`),
                },
                sourceMap: isDevelopment,
              },
            },
          ],
        },
        {
          test: /\.scss$/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: `css-loader`,
              options: {
                sourceMap: isDevelopment,
                url: false,
                importLoaders: 1,
              },
            },
            {
              loader: `sass-loader`,
              options: {
                sourceMap: isDevelopment,
                sassOptions: {
                  // importer: globImporter(),
                  importer: new create({
                    "@utils": path.join(__dirname, `lib/utils`),
                  }),
                },
              },
            },
          ],
        },
      ],
    },
    plugins: [
      new CleanWebpackPlugin(), //
      new MiniCssExtractPlugin({
        filename: `[name].css`,
      }),
      new CopyPlugin({
        patterns: [{ from: `static`, noErrorOnMissing: true, info: file => ({ minimized: true }) }],
      }),
      new ReplaceInFileWebpackPlugin([
        {
          dir: `dist`,
          files: [`module.json`],
          rules: [
            { search: /__WEBPACK__MODULE_ID__/g, replace: config.MODULE_ID },
            { search: /__WEBPACK__MODULE_NAME__/g, replace: config.MODULE_NAME },
            { search: /__WEBPACK__MODULE_VERSION__/g, replace: config.VERSION },
            { search: /"__WEBPACK__BUNDLE_FILES__",/, replace: `` },
          ].filter(Boolean),
        },
      ]),
      isProduction && new VisualizerPlugin(),
    ].filter(Boolean),
    optimization: {
      minimize: false,
      // runtimeChunk: `single`,
      // Ensure `react-refresh/runtime` is hoisted and shared
      // Could be replicated via a vendors chunk
      splitChunks: {
        // name(_, __, cacheGroupKey) {
        //   return cacheGroupKey
        // },
        cacheGroups: {
          vendor: {
            chunks: `all`,
            test: /[\\/]node_modules[\\/](lit|interactjs)[\\/]/,
            name: `vendor`,
            filename: `js/[name].bundle.js`,
            reuseExistingChunk: true,
          },
          mdi: {
            chunks: `all`,
            test: /[\\/]node_modules[\\/](@mdi)[\\/]/,
            name: `mdi`,
            minSize: 1,
            filename: `js/[name].bundle.js`,
            reuseExistingChunk: true,
          },
          lodash: {
            chunks: `all`,
            test: /[\\/]node_modules[\\/](lodash)[\\/]/,
            name: `lodash`,
            minSize: 1,
            filename: `js/[name].bundle.js`,
            reuseExistingChunk: true,
          },
        },
      },
    },
  }

  if (!isDevelopment) {
    delete webpackConfig.devServer
    delete webpackConfig.devtool
    // delete webpackConfig.optimization.runtimeChunk
  }

  // return smp.wrap(webpackConfig)
  return webpackConfig
}
