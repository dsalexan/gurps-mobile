// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = `development`
process.env.NODE_ENV = `development`

const PORT = process.env.PORT || 30000
const HOST = process.env.HOST || `0.0.0.0`
process.env.PUBLIC_URL = process.env.PUBLIC_URL || `localhost:${PORT}`

const path = require(`path`)
const fs = require(`fs`)
const webpack = require(`webpack`)
const WebpackDevServer = require(`webpack-dev-server`)

const chalk = require(`react-dev-utils/chalk`)

const webpackConfig = require(`../webpack.config`)

// Stablish paths beforehand
const DIRECTORY = fs.realpathSync(process.cwd())
const BUILD_PATH = path.resolve(DIRECTORY, `dist`)
const PACKAGE_JSON_PATH = path.resolve(DIRECTORY, `package.json`)

const config = webpackConfig({
  watch: true,
  mode: `development`,
})
const compiler = webpack(config)

const server = new WebpackDevServer(
  {
    hot: true,
    liveReload: true,
    // open: [`http://localhost:30000/game`],
    devMiddleware: {
      writeToDisk: true,
    },
    client: {
      logging: `verbose`,
      overlay: {
        warnings: false,
        errors: false,
      },
    },
  },
  compiler,
)

const runServer = async () => {
  console.log(chalk.cyan(`Starting development server...\n`))
  await server.start()
}

runServer()
