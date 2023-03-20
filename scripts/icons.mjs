// make static icons

import GURPSIcons from "../src/gurps-extension/icons.mjs"

import Promise from "bluebird"
import sharp from "sharp"
import xmldom from "xmldom"
import fs from "fs"
import path from "path"

import { parse } from "svg-parser"
import { isNil } from "lodash-es"

//#region SVG TO PNG

/**
 *
 * @param arr
 * @param chunkSize
 */
function spliceIntoChunks(arr, chunkSize) {
  const res = []
  while (arr.length > 0) {
    const chunk = arr.splice(0, chunkSize)
    res.push(chunk)
  }
  return res
}

/**
 *
 * @param inputs
 * @param outputs
 * @param output
 * @param allColors
 * @param allSizes
 */
async function render(inputs, allColors = [`#181818`], allSizes = [32, 64, 128, 256]) {
  const datafile = inputs.flatMap(input => {
    fs.appendFileSync(`./ignore`, input.destination + `\n`)

    return allColors.flatMap(color =>
      allSizes.flatMap(size => ({
        size,
        color,
        // input: path.resolve(__dirname, `./svg/${i}`),
        // output: path.resolve(__dirname, file),
        input: input.source,
        output: input.destination,
      })),
    )
  })

  return Promise.all(
    datafile.map(async file => {
      const { input, output, size, color } = file

      let svgdata = fs.readFileSync(input, `utf-8`)

      let _w = svgdata.match(/viewBox="0 0 (\d+.?\d*) \d+/)
      if (_w === null) {
        console.error(`COULD NOT FIND VIEWBOX FOR "${file}"`)
        _w = [0, `24`]
      }
      let w = parseFloat(_w[1])

      let ICON = new xmldom.DOMParser().parseFromString(svgdata, `text/xml`)
      let svgList = ICON.getElementsByTagName(`svg`)
      if (!svgList) {
        throw new Error(`No SVG in ${svgdata}`)
      }

      let svg = svgList.item(0)
      svg.setAttribute(`width`, size * (w / 24))
      svg.setAttribute(`height`, size)
      svg.setAttribute(`fill`, color)

      let img = await sharp(Buffer.from(new xmldom.XMLSerializer().serializeToString(ICON)))

      let resized = await img.resize(size)
      return await resized.toFile(output)
    }),
  )
  // return svgexport.render(datafile);
}

//#endregion

/**
 * Icons for maneuvers in GURPS
 */
async function maneuvers() {
  const maneuversWithIcons = [
    `do-nothing`,
    `ready`,
    `concentrate`,
    `wait`,
    `move`,
    `move-and-attack`,
    `attack`,
    `aim`,
    `evaluate`,
    `feint`,
    // all-out-attack
    `allout-attack`,
    `aoa-determined`,
    `aoa-double`,
    `aoa-feint`,
    `aoa-strong`,
    // all-out-defense
    `allout-defense`,
    `aod-block`,
    `aod-dodge`,
    `aod-parry`,
    `aod-double`,
    `aod-mental`,
  ]

  const filepath = path.join(process.cwd(), `./static/icons`)
  const MDI = `D:\\Downloads\\MaterialDesign\\svg`

  const destination = path.join(process.cwd(), `./static/icons/maneuvers`)

  //   Creates directory if the directory does NOT exist
  !fs.existsSync(destination) && fs.mkdirSync(destination, { recursive: true })

  const icons = []

  for (const maneuver of maneuversWithIcons) {
    const _icons = GURPSIcons[maneuver]

    const ironArray = Array.isArray(_icons) ? _icons : [_icons]

    for (let i = 0; i < ironArray.length; i++) {
      const icon = ironArray[i]

      let dest = `man-${maneuver}-${i}.png`
      if (i === 0) dest = `man-${maneuver}.png`

      // mdi svg
      if (icon.includes(`mdi`)) {
        icons.push({
          source: path.join(MDI, `${icon.replace(`mdi-`, ``)}.svg`),
          destination: path.join(destination, dest),
        })
        continue
      }

      // custom svg
      icons.push({
        source: path.join(filepath, `${icon}.svg`),
        destination: path.join(destination, dest),
      })
    }
  }

  console.log(`[Maneuvers] Rendering ${icons.length} svgs`)
  if (icons.length == 0) return

  const chunks = spliceIntoChunks(icons, 40)

  let j = 0
  for (let i = 0; i < chunks.length; i++) {
    const inputs = chunks[i]

    await render(inputs, [`#EEEEEE`], [480])

    console.log(`    ${j}...${j + inputs.length}`)
    j += inputs.length
  }
}

/**
 *
 */
async function lib() {
  const source = path.join(process.cwd(), `./static/icons`)
  const target = path.join(process.cwd(), `./src/gurps-mobile/assets/icons/list.json`)
  // const icons = path.join(process.cwd(), `./static/icons`)

  const output = {}

  const svgs = fs.readdirSync(source)

  const missingIcons = Object.entries(GURPSIcons).filter(([name, icon]) => {
    if (isNil(icon)) return true
    if (icon.substring(0, 4) === `mdi-`) return false

    return !fs.existsSync(path.join(source, `${icon}.svg`))
  })

  if (missingIcons.length > 0) {
    console.log(`Missing icons at source (${missingIcons.length})`)
    for (const [name, icon] of missingIcons) {
      console.log(`    `, (icon ?? `<undefined>`).padEnd(25, ` `), `(${name})`)
    }
  }

  for (const filepath of svgs) {
    if (fs.statSync(path.join(source, filepath)).isDirectory()) continue
    const name = filepath.replace(/.svg$/i, ``)

    const content = fs.readFileSync(path.join(source, filepath), `utf8`)
    const dom = parse(content)

    const svg = dom.children.find(node => (node.tagName = `svg`))
    if (!svg) {
      console.error(`Could not parse ${filepath} svg tag`)
      continue
    }

    if (!svg.properties?.viewBox) {
      console.error(`Could not parse ${filepath} viewBox`)
      continue
    }

    // const result = content.replaceAll(/[\t\r\n]+/gi, ``).matchAll(/<svg\b[^>]*?>([\s\S]*?)<\/svg>/gm)
    const result = /<svg\b[^>]*?>([\s\S]*?)<\/svg>/gm.exec(content.replaceAll(/[\t\r\n]+/gi, ``))
    const innerSVG = result[1]
    if (!innerSVG) {
      console.error(`Could not parse ${filepath} inner svg`)
      continue
    }

    output[name] = {
      name,
      viewbox: svg.properties.viewBox,
      svg: innerSVG,
    }
  }

  let data = JSON.stringify(output, null, 2)
  fs.writeFileSync(target, data)
}

maneuvers()
lib()
