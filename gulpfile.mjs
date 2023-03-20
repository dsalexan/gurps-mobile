import fs from "fs-extra"

import path from "node:path"

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { MODULE_ID } from "./config/index.js"
import { globSync } from "glob"

import gulp from "gulp"
import replace from "gulp-replace"
import run from "gulp-run"

/********************/
/*  CONFIGURATION   */
/********************/

const name = MODULE_ID
const sourceDirectory = `./src`
const distDirectory = `./dist`

/***************************/
/*       BUNDLE       */
/***************************/

/**
 *
 */
export async function bundle() {
  const isProduction = process.env.NODE_ENV === `production`

  const pattern = /"__GULP__BUNDLE_FILES__"/

  const bundleFiles = globSync(`*.js`, { cwd: path.resolve(distDirectory, `js`) })
  if (!isProduction) bundleFiles.push(`runtime.js`)

  return gulp
    .src(`${distDirectory}/module.json`, { base: `./` })
    .pipe(replace(pattern, bundleFiles.map(filename => `"${filename}"`).join(`, `)))
    .pipe(gulp.dest(`./`))
}

/********************/
/*       LINK       */
/********************/

/**
 * Get the data path of Foundry VTT based on what is configured in `foundryconfig.json`
 */
function getDataPath() {
  const config = fs.readJSONSync(`foundryconfig.json`)

  if (config?.dataPath) {
    if (!fs.existsSync(path.resolve(config.dataPath))) {
      throw new Error(`User Data path invalid, no Data directory found`)
    }

    return path.resolve(config.dataPath)
  } else {
    throw new Error(`No User Data path defined in foundryconfig.json`)
  }
}

/**
 * Link build to User Data folder
 */
export async function link() {
  let destinationDirectory
  if (fs.existsSync(path.resolve(distDirectory, `module.json`))) {
    destinationDirectory = `modules`
  } else {
    throw new Error(`Could not find module.json`)
  }

  const linkDirectory = path.resolve(getDataPath(), `Data`, destinationDirectory, name)

  const argv = yargs(hideBin(process.argv)).option(`clean`, {
    alias: `c`,
    type: `boolean`,
    default: false,
  }).argv
  const clean = argv.c

  if (clean) {
    console.log(`Removing build in ${linkDirectory}.`)

    await fs.remove(linkDirectory)
  } else if (!fs.existsSync(linkDirectory)) {
    console.log(`Linking dist to ${linkDirectory}.`)
    await fs.ensureDir(path.resolve(linkDirectory, `..`))
    await fs.symlink(path.resolve(distDirectory), linkDirectory)
  }
}
