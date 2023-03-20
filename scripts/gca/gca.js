const path = require(`path`)
const fs = require(`fs`)
const _ = require(`lodash`)
const { isNil, isObjectLike, isArray, get, flatten, groupBy, isString, isNumber, isBoolean } = require(`lodash`)

const Entry = require(`./entry.js`)

// Stablish paths beforehand
const GCA5 = `C:/Users/dsale/AppData/Roaming/GURPS Character Assistant 5`
const GCA5_FAST = `C:/Users/dsale/Documents/GURPS Character Assistant 5/libraries`
const OUTPUT = `D:/Code/foundry/december/gurps-mobile/static/js`

/**
 *
 * @param dirPath
 */
function readDirectory(dirPath) {
  const files = fs.readdirSync(dirPath) || []

  return _.flattenDeep(
    files
      .map(file => {
        if (fs.statSync(dirPath + `/` + file).isDirectory()) return readDirectory(dirPath + `/` + file)
        else {
          if (file.substring(file.length - 4) !== `.gdf`) return null
          return {
            fullpath: path.join(dirPath, `/`, file),
            parents: dirPath.replace(GCA5 + `/`, ``).split(`/`),
            file,
            name: file.replace(`.gdf`, ``),
          }
        }
      })
      .filter(f => f !== null),
  )
}

/**
 *
 * @param text
 * @param char
 */
function removeAtEnd(text, char) {
  return text[text.length - 1] === char ? text.substring(0, text.length - 1) : text
}

/**
 *
 * @param index
 * @param entriesMap
 * @param _index
 * @param prefix
 */
function indexEntries(index, entriesMap, prefix = ``) {
  let N = 0

  for (const key in entriesMap) {
    const mapOrArray = entriesMap[key]

    if (isArray(mapOrArray)) {
      N += mapOrArray.length

      let i = 0
      for (const entry of mapOrArray) {
        const name = entry.data.name
        if (index[name] === undefined) index[name] = []

        const _key = `${prefix}${key}.${i}`
        index[name].push(_key)
        entry.data._path = _key

        i++
      }
    } else {
      N += indexEntries(index, mapOrArray, `${prefix}${key}.`)
    }
  }

  return N
}

const books = readDirectory(GCA5)
const extractions = {}

const allowedBooks = [
  `GURPS Martial Arts 4e`, //
  // `GURPS Basic Set 4th Ed.--Characters`,
]

// EXTRACT AND SAVE EACH BOOK
for (const book of books) {
  if (allowedBooks.length > 0 && !allowedBooks.includes(book.name)) continue

  console.log(`Extracting "${book.name}"...`)

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

  // PARSE ENTRIES INTO OBJECTS
  const entries = {}
  for (const cursor in data) {
    // if (![`cursor`].includes(cursor)) continue

    const _placeholder = /^[-]+$/

    entries[cursor] = {}
    for (const cursor2 in data[cursor]) {
      entries[cursor][cursor2] = []

      const lines = data[cursor][cursor2]
      for (const line of lines) {
        // if (line.substring(0, 16) !== `Finger Lock (Arm`) continue
        // if (line.substring(0, 33) === `Druid Advantages(Dungeon Fantasy)`) debugger
        // if (line.substring(0, 28) !== `"_Add Hilt Punch Attack Mode`) continue
        if (line.substring(0, 34) !== `#MergeTags in "TE:Assassin (Martia`) continue

        console.log(` `)
        console.log(line)

        const entry = new Entry(line, cursor2, cursor)

        // ERROR: every entry should have a name
        try {
          if (entry.data.name.match(_placeholder)) continue
        } catch (ex) {
          console.log(ex)
          console.log(``)
          console.log(entry)
          console.log(``)
          console.log(book)
          debugger
        }

        entries[cursor][cursor2].push(entry)
      }
    }
  }

  // SPLIT COMMANDS
  const features = {}
  const commands = {}
  for (const type in entries) {
    const byType = entries[type]

    features[type] = {}
    commands[type] = {}

    for (const parent in byType) {
      const all = byType[parent]

      features[type][parent] = all.filter(e => !e._command)
      commands[type][parent] = all.filter(e => e._command)
    }
  }

  // SAVE EXTRACTION
  extractions[book.name] = {
    ...book,
    entries: features,
    commands,
  }
}

// INDEX ALL THINGS
const master = {}
const masterType = {}

for (const book of books) {
  if (allowedBooks.length > 0 && !allowedBooks.includes(book.name)) continue

  // INDEX ENTRIES
  const index = {}
  const N = indexEntries(index, extractions[book.name].entries)
  extractions[book.name].N = N

  // SAVE EXTRACTION
  // fs.writeFileSync(path.join(OUTPUT, `${book.name}.json`), JSON.stringify(extractions[book.name]))

  // INDEX ALL ENTRY NAMES
  for (const name in index) {
    if (master[name] === undefined) master[name] = []

    master[name].push(...index[name].map(path => `${book.name}|${path}`))
  }

  // INDEX ALL ENTRY TYPES
  for (const cursor in extractions[book.name].entries) {
    for (const cursor2 in extractions[book.name].entries[cursor]) {
      for (const entry of extractions[book.name].entries[cursor][cursor2]) {
        const type = entry.data._type
        if (masterType[type] === undefined) masterType[type] = {}
        if (masterType[type][entry.data.name] === undefined) masterType[type][entry.data.name] = []

        masterType[type][entry.data.name].push(`${book.name}|${entry.data._path}`)
      }
    }
  }
}

// PRE PROCESS ENTRIES
console.log(`PRE-PROCESS ENTRIES`)
for (const _entry in master) {
  const references = master[_entry]

  if (references.length <= 1) continue

  const entriesByReference = references.map(reference => {
    const [book, path] = reference.split(`|`)
    const entry = get(extractions[book].entries, path)
    return entry
  })

  const entriesByType = groupBy(entriesByReference, entry => entry.type)

  for (const type in entriesByType) {
    const entries = entriesByType[type]

    if (entries.length <= 1) continue

    debugger
  }
}

// PROCESS COMMANDS
console.log(`PROCESS COMMANDS`)
for (const _book of books) {
  if (allowedBooks.length > 0 && !allowedBooks.includes(_book.name)) continue

  const commands = extractions[_book.name].commands
  for (const type in commands) {
    for (const parent in commands[type]) {
      for (const command of commands[type][parent]) {
        if (command.data.target) {
          const _target = master[command.data.target]

          if (!_target || _target.length === 0) {
            console.log(`    `, `Missing target "${command.data.target}"`, _target)
            continue
          }

          const targets = _target.map(t => {
            const [book, path] = t.split(`|`)
            return get(extractions[book].entries, path)
          })

          if (targets.length > 1) {
            console.log(`    `, `Multiple targets for "${command.data.target}"`, _target, targets)
            debugger
          }

          const target = targets[0]

          if (!target) {
            console.log(`    `, `Incorrect target path "${_target[0]}"`)
            continue
          }

          if (command.data.name === `MergeTags`) {
            target.mergeTags(command.data.with)
            continue
          }
        }

        console.log(`    `, `Unknown Command "${command.data.name}"`)
      }
    }
  }
}

// SERIALIZE ALL THINGS
for (const book of books) {
  if (allowedBooks.length > 0 && !allowedBooks.includes(book.name)) continue

  for (const type in extractions[book.name].entries) {
    const byType = extractions[book.name][type]
    for (const parent in byType) {
      extractions[book.name].entries[type][parent] = extractions[book.name].entries[type][parent].map(entry => entry.data)
    }
  }
}

// SAVE MASTER INDEX
// fs.writeFileSync(path.join(OUTPUT, `../index.json`), JSON.stringify(master, null, 2))

// SAVE DATA AS .JS
fs.writeFileSync(path.join(OUTPUT, `gca_names.js`), `window.GCA_NAMES=` + JSON.stringify(Object.keys(master)))
fs.writeFileSync(path.join(OUTPUT, `gca_index.js`), `window.GCA_INDEX=` + JSON.stringify(master))
fs.writeFileSync(path.join(OUTPUT, `gca_type_index.js`), `window.GCA_TYPE_INDEX=` + JSON.stringify(masterType))
fs.writeFileSync(path.join(OUTPUT, `gca_books.js`), `window.GCA_BOOKS=` + JSON.stringify(extractions))
