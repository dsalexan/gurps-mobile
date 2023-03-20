const path = require(`path`)
const fs = require(`fs`)
const _ = require(`lodash`)
const { isNil, isObjectLike, isArray, get, uniq, flatten, groupBy, isString, isNumber, isBoolean, toPath, isEqual, flattenDeep, chunk, zip, cloneDeep, sortBy } = require(`lodash`)

const Entry = require(`./entry.js`)
const TypedValue = require(`./typed_value`)
const GDF = require(`./gdf.js`)
const { exit } = require(`process`)

const { ExportToCsv } = require(`export-to-csv`)

const SECTIONS = [0, `ATTRIBUTES`, `LANGUAGES`, `CULTURES`, `ADVANTAGES`, `PERKS`, `DISADVANTAGES`, `QUIRKS`, `FEATURES`, `SKILLS`, `SPELLS`, `EQUIPMENT`, `TEMPLATES`]

/**
 *
 * @param string
 */
function trim(string) {
  return string.trim()
}

/**
 *
 * @param value
 */
function object(value) {
  return { value }
}

/**
 *
 * @param cursor
 * @param _cursor
 * @param lines
 * @param headers
 * @param chunkSize
 * @param format
 */
function parse(_cursor, lines, headers, chunkSize = 1, format = line => object(line[0])) {
  const header = zip(headers, lines.slice(0, headers.length)).map(([formatter, raw]) => formatter(raw))
  const length = header.slice(-1)[0]
  const cursor = _cursor + headers.length

  const chunkLength = chunkSize * length
  const workingLines = lines.slice(0, headers.length + chunkLength)
  const chunks = chunk(lines.slice(headers.length, headers.length + chunkLength), chunkSize)
  const followingLines = lines.slice(headers.length + chunkLength)

  const result = chunks.map((line, index) => {
    const obj = format(line, header)
    obj._source = line
    obj._index = cursor + index * chunkSize
    return obj
  })

  return [followingLines, result, header, workingLines]
}

/**
 *
 * @param output
 * @param result
 * @param templates
 * @param eof
 */
function splice(output, result, templates, eof) {
  if (output[result] === undefined) output[result] = []

  for (let t = 0; t < templates.length; t++) {
    const template = templates[t]

    const [postLines, entries, header, slicedLines] = parse(output.cursor, output.lines, template.header, template.chunks, template.format)
    output.cursor += slicedLines.length

    const obj = {
      name: template.name,
      header,
      entries,
      lines: slicedLines,
    }

    output[result].push(obj)
    output.lines = postLines

    if (output.cursor + 1 === eof) break
  }
}

/**
 *
 * @param output
 * @param result
 * @param names
 * @param template
 * @param eof
 */
function spliceUntil(output, result, names, template, eof) {
  if (output[result] === undefined) output[result] = []

  for (let t = 0; output.cursor + 1 < eof; t++) {
    const name = names[t]

    const [postLines, entries, header, slicedLines] = parse(output.cursor, output.lines, template.header, template.chunks, template.format)
    output.cursor += slicedLines.length

    const obj = {
      name: name ?? `${result}${t}`,
      header,
      entries,
      lines: slicedLines,
    }

    output[result].push(obj)
    output.lines = postLines
  }
}

/**
 *
 * @param map
 * @param key
 * @param value
 */
function push(map, key, value) {
  if (map[key] === undefined) map[key] = []

  map[key].push(value)
}

module.exports.extract = function (pathfile) {
  // READ FAST INDEX
  const fst = fs.readFileSync(pathfile, `utf-8`)
  let lines = fst.split(/\r?\n/g)

  const result = []

  const output = {
    lines,
    cursor: 0,
  }

  // GENERALISTS
  let cursor = 0
  splice(output, `result`, [
    {
      name: `entries`,
      header: [parseInt, parseInt],
      chunks: 9,
      format: (line, header) => {
        if (isNaN(parseInt(line[2].trim())) || parseInt(line[2].trim()) > 12) debugger
        // if (line[0].trim().replaceAll(/[\s]+/g, ` `) === `Aries-Making & Breaking, Mind Control`) debugger
        // if (line[0].trim().replaceAll(/[   ]+/g, ` `) === `Aries-Making & Breaking,  Mind Control`) debugger

        const entry = {
          name: line[0].trim().replaceAll(/[\s]+/g, ` `),
          nameext: line[1].trim().replaceAll(/[\s]+/g, ` `),
          _section: line[2].trim(),
          section: SECTIONS[parseInt(line[2].trim())],
          U_3: line[3].trim(),
          U_4: line[4].trim(),
          cat: line[6].trim(),
          U_advantageType: line[6].trim(),
          row: parseInt(line[7].trim()) + 1,
          // 8 e sempre 1
        }

        return entry
      },
    },
    {
      name: `groups`,
      header: [parseInt],
      chunks: 5,
      format: (line, header) => {
        const entry = {
          U_0: line[0].trim(),
          name: line[1].trim(),
          nameext: line[2].trim(),
          group: line[3].trim(),
          U_4: line[4].trim(),
        }

        return entry
      },
    },
    {
      name: `cats`,
      header: [parseInt, parseInt, trim, trim, parseInt],
      chunks: 3,
      format: (line, header) => {
        const entry = {
          name: line[0].trim(),
          nameext: line[1].trim(),
          count: parseInt(line[2].trim()),
        }

        return entry
      },
    },
    {
      name: `talents`,
      header: [parseInt],
    },
  ])

  // TRUPLES
  spliceUntil(
    output,
    `truples`,
    [
      `templates`,
      `advantages`,
      `advantages2`,
      `advantages3`,
      `advantages4`,
      `perks`,
      `disadvantages`,
      `quirks`,
      `skills`,
      `spells`,
      `spells2`,
      `spells3`,
      `colleges`,
      `combat skills`,
      `music`,
      `music2`,
      `appearance`,
    ],
    {
      header: [parseInt],
      chunks: 3,
      format: (line, header) => {
        const entry = {
          name: line[0].trim(),
          nameext: line[1].trim(),
          count: parseInt(line[2].trim()),
        }

        return entry
      },
    },
    35966,
  )

  // GENERALIST LIST
  splice(output, `result`, [
    {
      name: `lists`,
      header: [parseInt],
    },
  ])

  // LISTS
  spliceUntil(
    output,
    `lists`,
    [],
    {
      header: [parseInt],
      chunks: 1,
      format: (line, header) => {
        const entry = { value: line }

        return entry
      },
    },
    36060,
  )

  // GENERALIST 2
  splice(output, `result`, [
    {
      name: `attributes`,
      header: [parseInt],
      chunks: 8,
      format: (line, header) => {
        const entry = {
          name: line[0].trim(),
          cost: line[1].trim(),
        }

        return entry
      },
    },
    // {
    //   name: `?????`,
    //   header: [parseInt],
    //   chunks: 4,
    //   format: (line, header) => {
    //     const entry = { value: line }

    //     return entry
    //   },
    // },
  ])

  return output
}

module.exports.index = function (output) {
  const { header, entries } = output.result.find(e => e.name === `entries`)

  const byRow = {}
  const byName = {}
  const byNameExt = {}
  const bySection = {}

  for (const entry of entries) {
    const extendedName = `${entry.name} (${entry.nameext})`

    // INDEX
    if (byRow[entry.row - 1] !== undefined) debugger
    byRow[entry.row - 1] = entry

    // NAME, NAMEEXT
    push(byName, entry.name, entry)
    if (entry.nameext !== ``) push(byNameExt, extendedName, entry)

    // SECTION
    if (bySection[entry.section] === undefined) bySection[entry.section] = { byName: {}, byNameExt: {} }

    // SECTION > NAME, NAMEEXT
    push(bySection[entry.section].byName, entry.name, entry)
    if (entry.nameext !== ``) push(bySection[entry.section].byNameExt, extendedName, entry)
  }

  // let U_3 = entries.map(entry => parseInt(entry.U_3))
  // U_3 = sortBy(U_3)

  // let U_4 = entries.map(entry => parseInt(entry.U_4))
  // U_4 = sortBy(U_4)

  // console.log([...new Set(U_3)])
  // console.log(U_3)
  // console.log([...new Set(U_4)])
  // console.log(U_4)
  // debugger

  return { byRow, byName, byNameExt, bySection, N: entries.length }
}
