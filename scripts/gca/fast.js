const path = require(`path`)
const fs = require(`fs`)
const _ = require(`lodash`)
const { isNil, isObjectLike, isArray, get, uniq, flatten, groupBy, isString, isNumber, isBoolean, toPath, isEqual, flattenDeep, intersection, omit } = require(`lodash`)

const Entry = require(`./entry.js`)
const TypedValue = require(`./typed_value`)
const GDF = require(`./gdf.js`)
const { exit } = require(`process`)

const { ExportToCsv } = require(`export-to-csv`)

/**
 *
 * @param index
 * @param query
 */
function find(index, query) {
  const keys = Object.keys(index)

  for (const key of keys) {
    if (key === query) return index[key]
    else if (key.replaceAll(/[\s]+/g, ` `) === query.replaceAll(/[\s]+/g, ` `)) return index[key]
    else if (key.replaceAll(/,[\s]+/g, `,`) === query.replaceAll(/,[\s]+/g, `,`)) return index[key]
  }

  return undefined
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
  // READ FAST LIBRARY
  const fst = fs.readFileSync(pathfile, `utf-8`)
  const lines = fst.split(/[\r\n]+/g)

  // PARSE ENTRIES INTO OBJECTS
  const _placeholder = /^[-]+$/
  const entries = []

  for (let i = 0; i < lines.length; i++) {
    const _line = lines[i]
    if (_line === ``) continue

    // if (![11893, 3375, 1588, 802, 759, 308, 205, 166, 147, 135, 122, 112, 111, 105, 92, 68, 50, 36, 47, 7, 0].includes(i)) continue
    // if (![105].includes(i)) continue

    let line = _line
    const shiftLine = line.substring(1)
    // console.log(`  `, i, `:`, shiftLine.substring(0, 69 ** 1) + `...`)

    // debugger
    const entry = new GDF(shiftLine)
    entry._index = entries.length
    entry._row = i

    const _data = entry._data
    const data = entry.data

    // console.log(` `)
    // TypedValue.print(_data)
    // console.log(data)
    // console.log(` `)
    // console.log(` `)
    // console.log(` `)
    // console.log(` `)
    // console.log(` `)
    // console.log(` `)
    // console.log(` `)
    // debugger

    // ERROR: every entry should have a name
    try {
      if (entry.data.name.match(_placeholder)) continue
    } catch (ex) {
      console.log(ex)
      console.log(``)
      console.log(entry)
      console.log(``)
      console.log(`book???`)
      debugger
    }

    entries.push(entry)
  }

  return entries
}

module.exports.typing = function (entries, index) {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]

    const byRow = index.byRow[entry._row]
    if (!byRow) debugger

    const sections = flattenDeep([byRow.section])

    // const d = !isNil(entry.data.nameext) || entry.data.nameext === ``

    // const byName = find(index.byName, entry.data.name)
    // const byNameExt = d && find(index.byNameExt, entry.extendedName)

    // const byName_sections = byName ? uniq(byName.map(e => e.section)) : []
    // const byNameExt_sections = byNameExt ? uniq(byNameExt.map(e => e.section)) : []

    // const sections = uniq([...byName_sections, ...byNameExt_sections])

    let section

    if (sections.length === 1) section = sections[0]
    else if (sections.length > 1) {
      if (entry.data.name[0] === `_`) section = `GENERIC`
      else if (sections.length > 1 && sections.length <= 3) section = sections
      else {
        const byTag = entry.typeByTag()

        const inter = intersection(sections, flattenDeep([byTag.type])).filter(t => t !== undefined)

        if (inter.length === 1) section = inter[0]
        else {
          debugger
        }
      }
    } else {
      // no matching in fst ndx
      debugger
    }

    entry.section = section
  }
}

module.exports.prebuild = function (entries, index) {
  for (const entry of entries) entry.prebuild(entries, index)
}

module.exports.index = function (entries) {
  const byName = {}
  const byNameExt = {}
  const bySection = {}

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const extendedName = `${entry.data.name} (${entry.data.nameext})`

    // SECTION
    let sections = flattenDeep([entry.section])
    for (const section of sections) {
      if (bySection[section] === undefined) bySection[section] = { byName: {}, byNameExt: {} }

      // NAME, NAMEEXT
      push(bySection[section].byName, entry.data.name, i)
      if (entry.data.nameext !== ``) push(bySection[section].byNameExt, extendedName, i)
    }

    // NAME, NAMEEXT
    push(byName, entry.data.name, i)
    if (entry.data.nameext !== ``) push(byNameExt, extendedName, i)
  }

  return { byName, byNameExt, bySection, N: entries.length }
}

module.exports.reindex = function (entries, index) {
  index.bySection.SKILLS[`byDefault`] = {}
  index.bySection.SKILLS[`byDefaultAttribute`] = {}

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const data = entry.data

    if (entry.section === `SKILLS`) {
      const J = data.default?.length ?? 0
      for (let j = 0; j < J; j++) {
        const default_ = data.default[j]

        for (const key of Object.keys(default_.targets ?? {})) {
          const target = default_.targets[key]

          if (target.type === `skill`) {
            for (const skill of target.value ?? []) {
              push(index.bySection.SKILLS[`byDefault`], skill, {
                skill: i,
                source: j,
                text: default_._raw,
                target: omit(target, [`_raw`, `value`, `type`]),
              })
            }
          } else if (target.type === `attribute`) {
            push(index.bySection.SKILLS[`byDefaultAttribute`], target.value, {
              skill: i,
              source: j,
              text: default_._raw,
              target: omit(target, [`_raw`, `value`, `type`]),
            })
          }
        }
      }
    }
  }
}

module.exports.save = function (entries, index, OUTPUT) {
  const serialized = entries.map(entry => ({
    ...entry.data, //
    _index: entry._index,
    parent: entry.parent,
    book: entry.book,
    section: entry.section,
  }))

  fs.writeFileSync(path.join(OUTPUT, `fast.js`), `window.GCA_ENTRIES=` + JSON.stringify(serialized))
  fs.writeFileSync(path.join(OUTPUT, `fast_index.js`), `window.GCA_INDEX=` + JSON.stringify(index))
}

module.exports.issues = function (entries, output = false) {
  const issues = []
  const foundIssues = []

  // PREPARE ISSUES
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]

    const allIssues = entry._data.deepIssues()
    // if (allIssues.length > 0) console.log(`\n\n\n  `, i, `:`, shiftLine)

    // ISSUES
    const _issues = {}
    const unbalanced = entry.tree.root.deepUnbalanced()
    if (unbalanced.length > 0) {
      if (!foundIssues.includes(`unbalanced`)) foundIssues.push(`unbalanced`)

      _issues[`unbalanced`] = unbalanced.map(charIndex => {
        let substring = entry.tree.text.substring(0, charIndex + 10)
        if (charIndex > entry.tree.text.length / 2) substring = entry.tree.text.substring(charIndex - 10)

        const direction = charIndex > entry.tree.text.length / 2 ? `(10→)` : `(←10)`

        return {
          path: charIndex,
          text: direction,
          from: substring,
        }
      })
    }

    const flatIssues = flatten(allIssues.map(([path, issues]) => issues.map(issue => [path, issue])))
    const issuesByIssue = groupBy(flatIssues, ([path, issue]) => Object.keys(issue.issue).join(`, `))
    for (const [issueName, issues] of Object.entries(issuesByIssue)) {
      if (issueName === `unbalanced`) continue

      for (const [path, { issue, from }] of issues) {
        let name = issueName
        if (issueName === `index, implicit`) name = `implicit`
        if (_issues[name] === undefined) _issues[name] = []

        let keys = Object.keys(issue)
        let text = issue[keys[0]]
        if (issueName === `index, implicit`) {
          keys = [`implicit`]
          text = `${JSON.stringify(issue[`implicit`])} @ ${issue[`index`]}`
        }

        if (keys.length > 1) debugger
        if (!foundIssues.includes(keys[0])) foundIssues.push(keys[0])

        _issues[name].push({
          path,
          text,
          from,
        })
      }
    }

    if (Object.keys(_issues).length > 0) issues[entry._index] = _issues
  }

  if (output) outputIssues(issues)

  return issues
}

/**
 *
 * @param issues
 */
function outputIssues(issues) {
  const foundIssues = uniq(flatten(issues.filter(i => i !== undefined).map(i => Object.keys(i))))

  // LOG ISSUES
  const logs = Object.fromEntries(foundIssues.map(key => [key, []]))
  for (const key of foundIssues) {
    for (let i = 0; i < issues.length; i++) {
      const _issues = issues[i]
      if (_issues === undefined) continue
      if (_issues[key] === undefined) continue
      logs[key].push(_issues[key].map(issue => [i, issue.path, issue.text, issue.from]))
    }
  }

  const logsFile = path.resolve(`./data/issues.csv`)
  if (fs.existsSync(logsFile)) fs.unlinkSync(logsFile)

  const content = []
  for (const key of foundIssues) {
    // content.push(`${key}`)

    for (const issues of logs[key]) {
      for (const issue of issues) {
        content.push(`${[key, ...issue].join(`;`)}`)
      }
    }

    content.push(`\n`)
  }

  fs.writeFileSync(logsFile, content.join(`\n`))
}
