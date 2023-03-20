const path = require(`path`)
const fs = require(`fs`)
const _ = require(`lodash`)
const { isNil, isObjectLike, isArray, get, uniq, flatten, groupBy, isString, isNumber, isBoolean, toPath, isEqual, flattenDeep, omit } = require(`lodash`)

const Entry = require(`./entry.js`)
const TypedValue = require(`./typed_value`)
const GDF = require(`./gdf.js`)
const { exit } = require(`process`)
const Fuse = require(`fuse.js`)
const stringSimilarity = require(`string-similarity`)

const { ExportToCsv } = require(`export-to-csv`)

/**
 *
 * @param dirPath
 * @param root
 */
function readDirectory(dirPath, root) {
  const files = fs.readdirSync(dirPath) || []

  return _.flattenDeep(
    files
      .map(file => {
        if (fs.statSync(dirPath + `/` + file).isDirectory()) return readDirectory(dirPath + `/` + file)
        else {
          if (file.substring(file.length - 4) !== `.gdf`) return null
          return {
            fullpath: path.join(dirPath, `/`, file),
            parents: dirPath.replace(root + `/`, ``).split(`/`),
            file,
            name: file.replace(`.gdf`, ``),
          }
        }
      })
      .filter(f => f !== null),
  )
}

module.exports.extract = function (pathdir) {
  const BOOKS = readDirectory(pathdir)

  const EXCLUDED_BOOKS = [/^Variant/]
  const ALLOWED_BOOKS = [
    // `GURPS Martial Arts 4e`, //
    // `GURPS Basic Set 4th Ed.--Characters`,
    // `GURPS Gun Fu 4e`,
    // `GURPS Horror 4e`,
  ]

  const books = {}
  for (const book of BOOKS) {
    if (EXCLUDED_BOOKS.length > 0 && EXCLUDED_BOOKS.some(pattern => (pattern instanceof RegExp ? !!book.name.match(pattern) : pattern === book.name))) continue
    if (ALLOWED_BOOKS.length > 0 && !ALLOWED_BOOKS.includes(book.name)) continue

    console.log(`  `, `Reading ${book.name}...`)

    const contents = readBook(book)

    const sections = {}
    const entries = []
    const indexBySection = {}
    for (const section in contents) {
      indexBySection[section] = {}
      sections[section] = Object.keys(contents[section])

      for (const parent in contents[section]) {
        indexBySection[section][parent] = []

        const lines = contents[section][parent]
        for (const line of lines) {
          // if (line.substring(0, 16) !== `Finger Lock (Arm`) continue
          // if (line.substring(0, 33) === `Druid Advantages(Dungeon Fantasy)`) debugger
          // if (line.substring(0, 28) !== `"_Add Hilt Punch Attack Mode`) continue
          // if (line.substring(0, 34) !== `#MergeTags in "TE:Assassin (Martia`) continue
          // if (line.substring(0, 45) !== `Fast-Draw Opponent's Weapon - Wrestling(%Fast`) continue
          // if (line.substring(0, 28) !== `Terminal Condition(Hard to a`) continue

          // console.log(` `)
          // console.log(line)

          const entry = new GDF(line, parent, section, book)

          // ERROR: every entry should have a name
          try {
            if (entry.data.name.match(/^[-]+$/)) continue
          } catch (ex) {
            console.log(ex)
            console.log(` `)
            console.log(line)
            console.log(``)
            console.log(entry)
            console.log(``)
            console.log(book)
            debugger
          }

          if (entry._command || entry._formula) continue

          entry._index = entries.length
          entries.push(entry)
          indexBySection[section][parent].push(entry._index)
        }
      }
    }

    books[book.name] = {
      ...book,
      index: {
        bySection: indexBySection,
      },
      sections,
      entries,
    }
  }

  return books
}

module.exports.buildIndexes = function (books) {
  // BUILD INDIVIDUAL BOOK INDEXES
  for (const book of Object.values(books)) {
    const byName = {}
    const byNameExt = {}
    const byTypeAndName = {}

    for (const entry of book.entries) {
      if (entry._command || entry._formula) continue

      if (byName[entry.data.name] === undefined) byName[entry.data.name] = []
      byName[entry.data.name].push(entry._index)

      if (entry.data.name !== entry.extendedName) {
        if (byNameExt[entry.extendedName] === undefined) byNameExt[entry.extendedName] = []
        byNameExt[entry.extendedName].push(entry._index)
      }

      const type = entry.section.toLowerCase()
      if (byTypeAndName[type] === undefined) byTypeAndName[type] = {}
      if (byTypeAndName[type][entry.data.name] === undefined) byTypeAndName[type][entry.data.name] = []
      byTypeAndName[type][entry.data.name].push(entry._index)
    }

    book.index.byName = byName
    book.index.byNameExt = byNameExt
    book.index.byTypeAndName = byTypeAndName
  }

  // MERGE ALL INDEXES ACROSS ALL BOOKS
  const INDEXES = [`bySection`, `byName`, `byNameExt`, `byTypeAndName`]
  const master = {}
  for (const key of INDEXES) {
    master[key] = {}
    for (const book of Object.values(books)) {
      if (key === `byName` || key === `byNameExt`) {
        for (const name in book.index[key]) {
          if (master[key][name] === undefined) master[key][name] = []
          master[key][name].push(...book.index[key][name].map(i => [book.name, i]))
        }
      } else if (key === `byTypeAndName` || key === `bySection`) {
        for (const typeOrSection in book.index[key]) {
          if (master[key][typeOrSection] === undefined) master[key][typeOrSection] = {}

          for (const parentOrName in book.index[key][typeOrSection]) {
            if (master[key][typeOrSection][parentOrName] === undefined) master[key][typeOrSection][parentOrName] = []
            master[key][typeOrSection][parentOrName].push(...book.index[key][typeOrSection][parentOrName].map(i => [book.name, i]))
          }
        }
      } else debugger
    }
  }

  master.fuse = {
    byName: new Fuse(Object.keys(master.byName), { includeScore: true }),
    byNameExt: new Fuse(Object.keys(master.byNameExt), { includeScore: true }),
  }

  return master
}

module.exports.dump = function (books, master, OUTPUT) {
  const serialized = {}

  // SERIALIZE
  for (const book in books) {
    serialized[book] = {
      ...books[book],
      entries: books[book].entries
        .filter(entry => !(entry._command || entry._formula))
        .map(entry => ({
          ...entry.data, //
          parent: entry.parent,
          book: entry.book,
          section: entry.section,
        })),
    }
  }

  fs.writeFileSync(path.join(OUTPUT, `books.json`), JSON.stringify(serialized))
  fs.writeFileSync(path.join(OUTPUT, `books_master.json`), JSON.stringify(omit(master, [`fuse`])))
}

module.exports.load = function (SOURCE) {
  const books = JSON.parse(fs.readFileSync(path.join(SOURCE, `books.json`)))
  const master = JSON.parse(fs.readFileSync(path.join(SOURCE, `books_master.json`)))

  master.fuse = {
    byName: new Fuse(Object.keys(master.byName), { includeScore: true }),
    byNameExt: new Fuse(Object.keys(master.byNameExt), { includeScore: true }),
  }

  return { books, master }
}

/**
 *
 * @param book
 */
function readBook(book) {
  const text = fs.readFileSync(book.fullpath, `utf-8`)
  const lines = text.replaceAll(/(?<!\r)\n/g, `\r\n`).split(/(?<![_,][\t ]*)\r\n(?!\t+)/g)

  const _cursor = /^\[(\w+)\][\t ]*$/i
  const _cursor2 = /^<([\w ,;./\\%:&-~°?!$#]+)>[\t ]*$/i
  const _block = /^\*+(\\\[\w+\])?[\t ]*$/i
  const _comment = /^\/\//
  const _comment2 = /^\* ?/
  const _breakline = /^[,"-']+[\t ]*$/
  const _OneToOneHundred_Sorted = /^[ \d"',\.-][\t ]*$/

  const _multiline = /_[\t ]*$/
  const _endWithCommaOrUnderline = /[,_][\t ]*$/
  const _tabs = /^(\t+)/

  // PARSE LINES INTO OBJECTS
  const contents = { HEADER: { default: [] } }
  let cursor = `HEADER`
  let cursor2 = `default`
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const match_cursor = line.match(_cursor)
    if (match_cursor) {
      cursor = match_cursor[1].toUpperCase()
      cursor2 = `default`
      if (!contents[cursor]) contents[cursor] = { default: [] }

      continue
    }

    const match_cursor2 = line.match(_cursor2)
    if (match_cursor2) {
      cursor2 = match_cursor2[1]
      if (!contents[cursor][cursor2]) contents[cursor][cursor2] = []

      continue
    }

    // if (line.substring(0, 28) === `"_Add Hilt Punch Attack Mode`) debugger
    // if (line.includes(`"Scuba and Swimming"_`)) debugger

    if (line.match(_block)) continue
    if (line.match(_comment) || line.match(_comment2)) continue
    if (line.match(_breakline)) continue
    if (line.match(_OneToOneHundred_Sorted)) continue
    if (line === ``) continue

    const _line = line //.replaceAll(`\t`, ``)
    contents[cursor][cursor2].push(_line)
  }

  // CLEAR MULTILINES
  const data = {}
  for (const cursor in contents) {
    // TODO: BODY and HitTables have a strange structure, be skipping them for now
    // TODO: Lists have a strange structure, be skipping them for now
    if ([`HEADER`, `SETTINGS`, `BASICDAMAGE`, `CONVERTDICE`, `BODY`, `HITTABLES`, `LISTS`].includes(cursor.toUpperCase())) continue
    // if (![`ADVANTAGES`].includes(cursor)) continue

    data[cursor] = {}
    for (const cursor2 in contents[cursor]) {
      data[cursor][cursor2] = []

      const lines = contents[cursor][cursor2]
      for (let i = 0; i < lines.length; i++) {
        const _line = lines[i]

        if (_line === ``) continue

        let finalLine = _line.replaceAll(/_(?=[\t\r\n]+)/g, ``) // line-breaking underlines
        finalLine = finalLine.replaceAll(/[\t\r\n]+/g, ``) // identation and breaklines

        // if (_line.substring(0, 28) === `"_Add Hilt Punch Attack Mode`) debugger
        // if (_line.includes(`"Scuba and Swimming"_`)) debugger

        data[cursor][cursor2].push(finalLine)
      }
    }
  }

  return data
}
