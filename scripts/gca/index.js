const path = require(`path`)
const fs = require(`fs`)
const _ = require(`lodash`)
const { isNil, isObjectLike, isArray, get, flatten, groupBy, isString, isNumber, isBoolean, toPath, isEqual, uniq } = require(`lodash`)

const Entry = require(`./entry.js`)
const TypedValue = require(`./typed_value`)
const GDF = require(`./gdf.js`)
const { exit } = require(`process`)

const { ExportToCsv } = require(`export-to-csv`)

const fast = require(`./fast`)
const book = require(`./book`)
const fstidx = require(`./fstidx`)

let GCA5_DIRECTORY = `C:/Users/dsale/Documents/GURPS Character Assistant 5`
GCA5_DIRECTORY = `D:/Code/foundry/december/gurps-mobile/data`
// GCA5_DIRECTORY = `D:/dsalexan/Code/foundry/gurps-mobile/data`
const DATA = `D:/dsalexan/Code/foundry/gurps-mobile/data`
const OUTPUT = `D:/Code/foundry/december/gurps-mobile/static/js`

let FILE = `Basic Set`
FILE = `default`

console.log(`FAST INDEX`)
// fstidx.extract(`${GCA5_DIRECTORY}/libraries/default.gds.fstndx`)
const output = fstidx.extract(`${GCA5_DIRECTORY}/libraries/${FILE}.gds.fstndx`)
const fastIndex = fstidx.index(output)
console.log(`  `, `${fastIndex.N} entries`)
// console.log(`  `, fastIndex)

// READ FAST LIBRARY
console.log(`FAST`)
let entries
entries = fast.extract(`${GCA5_DIRECTORY}/libraries/${FILE}.gds.fst`)
console.log(`  `, `${entries.length} entries`)

fast.typing(entries, fastIndex)
console.log(`  `, `${entries.filter(entry => !entry.section).length} entries without section!!!`)
console.log(`  `, `${entries.filter(entry => isArray(entry.section)).length} entries with multiple sections!!!`)

console.log(`INDEX`)
const index = fast.index(entries)
fast.prebuild(entries, index)
fast.reindex(entries, index)

console.log(`SAVE`)
fast.save(entries, index, OUTPUT)

// debugger
exit()
console.log(` `)
// READ GDF BOOKS
console.log(`GDF BOOKS`)
const LOAD = true
let books, master
if (LOAD) {
  const _load = book.load(DATA)
  books = _load.books
  master = _load.master
} else {
  books = book.extract(`${GCA5_DIRECTORY}/books`)
  master = book.buildIndexes(books)
  book.dump(books, master, DATA)
}

// debugger

console.log(` `)
// GUESS TYPES
console.log(`GUESS TYPES`)
for (const entry of entries) {
  entry.guessType(master, books)
}

console.log(` `)
// LOG ISSUES
const issues = fast.issues(entries, true)
const numberOfIssues = issues
  .filter(i => i !== undefined)
  .map(i => Object.values(i).reduce((count, issuesByKey) => count + issuesByKey.length, 0))
  .reduce((count, x) => count + x, 0)
console.log(
  `  `,
  numberOfIssues === 0 ? `No issues.` : `${numberOfIssues} issues found (${uniq(flatten(issues.filter(i => i !== undefined).map(i => Object.keys(i)))).join(`, `)})`,
)

debugger
