process.env.BABEL_ENV = `production`
process.env.NODE_ENV = `production`

// Ensure environment variables are read.
const webpackConfig = require(`../webpack.config`)

const path = require(`path`)
const chalk = require(`react-dev-utils/chalk`)
const fs = require(`fs-extra`)
const bfj = require(`bfj`)
const webpack = require(`webpack`)
const checkRequiredFiles = require(`react-dev-utils/checkRequiredFiles`)
const formatWebpackMessages = require(`react-dev-utils/formatWebpackMessages`)
const printHostingInstructions = require(`react-dev-utils/printHostingInstructions`)
const FileSizeReporter = require(`react-dev-utils/FileSizeReporter`)
const printBuildError = require(`react-dev-utils/printBuildError`)

const measureFileSizesBeforeBuild = FileSizeReporter.measureFileSizesBeforeBuild
const printFileSizesAfterBuild = FileSizeReporter.printFileSizesAfterBuild

// These sizes are pretty large. We'll warn for bundles exceeding them.
const WARN_AFTER_BUNDLE_GZIP_SIZE = 512 * 1024
const WARN_AFTER_CHUNK_GZIP_SIZE = 1024 * 1024

const isInteractive = process.stdout.isTTY

const argv = process.argv.slice(2)
const writeStatsJson = argv.indexOf(`--stats`) !== -1

// Generate configuration
const config = webpackConfig({
  watch: false,
  mode: `production`,
})

// Stablish paths beforehand
const DIRECTORY = fs.realpathSync(process.cwd())
const BUILD_PATH = path.resolve(DIRECTORY, `dist`)
const PACKAGE_JSON_PATH = path.resolve(DIRECTORY, `package.json`)

measureFileSizesBeforeBuild(BUILD_PATH)
  .then(previousFileSizes => {
    // Remove all content but keep the directory so that
    // if you're in it, you don't end up in Trash
    fs.emptyDirSync(BUILD_PATH)

    // Start the webpack build
    return build(previousFileSizes)
  })
  .then(
    ({ stats, previousFileSizes, warnings }) => {
      if (warnings.length) {
        console.log(chalk.yellow(`Compiled with warnings.\n`))
        console.log(warnings.join(`\n\n`))
        console.log(`\nSearch for the ` + chalk.underline(chalk.yellow(`keywords`)) + ` to learn more about each warning.`)
        console.log(`To ignore, add ` + chalk.cyan(`// eslint-disable-next-line`) + ` to the line before.\n`)
      } else {
        console.log(chalk.green(`Compiled successfully.\n`))
      }

      console.log(`File sizes after gzip:\n`)
      printFileSizesAfterBuild(stats, previousFileSizes, BUILD_PATH, WARN_AFTER_BUNDLE_GZIP_SIZE, WARN_AFTER_CHUNK_GZIP_SIZE)
      console.log()

      const appPackage = require(path.resolve(DIRECTORY, `package.json`))
      const publicUrl = `paths.publicUrlOrPath`
      const publicPath = config.output.publicPath
      const buildFolder = path.relative(process.cwd(), BUILD_PATH)
      printHostingInstructions(appPackage, publicUrl, publicPath, buildFolder, true)
    },
    err => {
      const tscCompileOnError = process.env.TSC_COMPILE_ON_ERROR === `true`
      if (tscCompileOnError) {
        console.log(chalk.yellow(`Compiled with the following type errors (you may want to check these before deploying your app):\n`))
        printBuildError(err)
      } else {
        console.log(chalk.red(`Failed to compile.\n`))
        printBuildError(err)
        process.exit(1)
      }
    },
  )
  .catch(err => {
    if (err && err.message) {
      console.log(err.message)
    }
    process.exit(1)
  })

// Create the production build and print the deployment instructions.
/**
 *
 * @param previousFileSizes
 */
function build(previousFileSizes) {
  console.log(`Creating an optimized production build...`)

  const compiler = webpack(config)
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      let messages
      if (err) {
        if (!err.message) return reject(err)

        let errMessage = err.message

        // Add additional information for postcss errors
        if (Object.prototype.hasOwnProperty.call(err, `postcssNode`)) errMessage += `\nCompileError: Begins at CSS selector ` + err[`postcssNode`].selector

        messages = formatWebpackMessages({
          errors: [errMessage],
          warnings: [],
        })
      } else messages = formatWebpackMessages(stats.toJson({ all: false, warnings: true, errors: true }))

      if (messages.errors.length) {
        // Only keep the first error. Others are often indicative
        // of the same problem, but confuse the reader with noise.
        if (messages.errors.length > 1) messages.errors.length = 1

        return reject(new Error(messages.errors.join(`\n\n`)))
      }
      if (process.env.CI && (typeof process.env.CI !== `string` || process.env.CI.toLowerCase() !== `false`) && messages.warnings.length) {
        // Ignore sourcemap warnings in CI builds. See #8227 for more info.
        const filteredWarnings = messages.warnings.filter(w => !/Failed to parse source map/.test(w))
        if (filteredWarnings.length) {
          console.log(chalk.yellow(`\nTreating warnings as errors because process.env.CI = true.\n` + `Most CI servers set it automatically.\n`))
          return reject(new Error(filteredWarnings.join(`\n\n`)))
        }
      }

      const resolveArgs = {
        stats,
        previousFileSizes,
        warnings: messages.warnings,
      }

      if (writeStatsJson) {
        return bfj
          .write(BUILD_PATH + `/bundle-stats.json`, stats.toJson())
          .then(() => resolve(resolveArgs))
          .catch(error => reject(new Error(error)))
      }

      return resolve(resolveArgs)
    })
  })
}
