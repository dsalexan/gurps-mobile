const path = require(`path`)
const fs = require(`fs`)
const _ = require(`lodash`)
const { isNil, isObjectLike, isArray, get, uniq, flatten, groupBy, isString, isNumber, isBoolean, toPath, isEqual, flattenDeep, intersection, omit, isEmpty } = require(`lodash`)

const Entry = require(`./entry.js`)
const TypedValue = require(`./typed_value`)
const GDF = require(`./gdf.js`)
const { exit } = require(`process`)

const { ExportToCsv } = require(`export-to-csv`)
const { dynamicValue } = require(`./dynamic.js`)
const { isPrimitive } = require(`./utils.js`)

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
    // if (![459].includes(i)) continue

    let line = _line
    const shiftLine = line.substring(1)
    // console.log(`  `, i, `:`, shiftLine.substring(0, 69 ** 1) + `...`)

    const entry = new GDF(shiftLine)
    entry._index = entries.length
    entry._row = i

    const _data = entry._data
    const data = entry.data

    // console.log(` `)
    // TypedValue.print(_data)
    // console.log(data)
    // console.log(` \n \n \n \n \n \n \n`)
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

module.exports.extractModifiers = function (modifiers) {
  // PARSE ENTRIES INTO OBJECTS
  const _placeholder = /^[-]+$/
  const entries = []

  for (const [i, fstEntry] of Object.entries(modifiers)) {
    const _line = fstEntry.raw
    if (_line === ``) debugger

    // if (![11893, 3375, 1588, 802, 759, 308, 205, 166, 147, 135, 122, 112, 111, 105, 92, 68, 50, 36, 47, 7, 0].includes(i)) continue
    // if (![105].includes(i)) continue
    // if (![459].includes(i)) continue

    let line = _line
    const shiftLine = line.substring(1) // remove first character comma
    // console.log(`  `, i, `:`, shiftLine.substring(0, 69 ** 1) + `...`)

    const entry = new GDF(shiftLine)
    entry._index = entries.length
    entry._row = fstEntry._index
    entry.section = `MODIFIERS`

    const _data = entry._data
    const data = entry.data

    // console.log(` `)
    // TypedValue.print(_data)
    // console.log(data)
    // console.log(` \n \n \n \n \n \n \n`)
    // debugger

    // ERROR: every entry should have a name
    try {
      // what is this??
      if (entry.data.name.match(_placeholder)) debugger
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
  const byFullname = {}
  const bySection = {}

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const extendedName = entry.data.nameext == undefined ? entry.data.name : `${entry.data.name} (${entry.data.nameext})`

    // SECTION
    let sections = flattenDeep([entry.section])
    for (const section of sections) {
      if (bySection[section] === undefined) bySection[section] = { byName: {}, byNameExt: {}, byFullname: {} }

      // NAME, NAMEEXT, NAME + NAMEEXT
      push(bySection[section].byName, entry.data.name, i)
      if (entry.data.nameext !== ``) {
        push(bySection[section].byNameExt, entry.data.nameext, i)
        push(bySection[section].byFullname, extendedName, i)
      }
    }

    // NAME, NAMEEXT NAME + NAMEEXT
    push(byName, entry.data.name, i)
    if (entry.data.nameext !== ``) {
      push(byNameExt, entry.data.nameext, i)
      push(byFullname, entry.data.nameext !== `` ? extendedName : entry.data.name, i)
    }
  }

  return { byName, byNameExt, byFullname, bySection, N: entries.length }
}

module.exports.reindex = function (entries, index) {
  index.bySection.SKILLS[`byDefault`] = {}
  index.bySection.SKILLS[`byDefaultAttribute`] = {}

  index.bySection.MODIFIERS[`byGroup`] = {}

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
    } else if (entry.section === `MODIFIERS`) {
      if (isNil(entry.data.group) || isEmpty(entry.data.group)) debugger
      push(index.bySection.MODIFIERS[`byGroup`], entry.data.group, i)
    }
  }
}

module.exports.duplicates = function (allEntries, index) {
  let sections = Object.keys(index.bySection)
  // // TODO: Check duplicates for other shit too
  sections = [`SKILLS`]

  // IDENTIFY DUPLICATES
  const TAGS = {
    SKILLS: {
      8059: [8059],
      8049: [8048],
      4146: [4145],
    },
  }
  for (const section of Object.keys(TAGS)) {
    const entries = Object.keys(TAGS[section])

    for (const entry of entries) {
      const duplicates = TAGS[section][entry]

      for (const duplicate of duplicates) {
        allEntries[duplicate].data.duplicateOf = parseInt(entry)
      }
    }
  }

  // DETECT UNIDENTIFIED DUPLICATES
  const DEBUG_NAME = [`Physician`, `Physiology`, `First Aid`]
  const DEBUG_I = [] // [40]

  const summary = []
  let PAD_NAME = 0
  for (const section of sections) {
    const names = Object.keys(index.bySection[section].byName)
    const namesWithDuplicates = names.filter(name => {
      const indexes = index.bySection[section].byName[name]
      if (indexes.length === 1) return false

      const entries = indexes.map(i => allEntries[i])

      // TODO: Check techniques/ritual paths too
      if (entries.some(entry => entry.data.cat?.includes(`Techniques`))) return false
      if (entries.some(entry => entry.data.cat?.includes(`Ritual Magic Paths`))) return false

      PAD_NAME = Math.max(PAD_NAME, name.length)
      return true
    })

    const identifiedDuplicates = namesWithDuplicates.filter(name => {
      const indexes = index.bySection[section].byName[name]
      const entries = indexes.map(i => allEntries[i])

      // check for duplicateOf identification
      const nonDuplicate = entries.filter(entry => entry.data.duplicateOf === undefined)
      const duplicates = entries.filter(entry => entry.data.duplicateOf !== undefined)

      if (nonDuplicate.length === 1 && duplicates.length >= 1) return true

      return false
    }).length
    console.log(
      `\n  `,
      section,
      `|`,
      `${namesWithDuplicates.length - identifiedDuplicates} entries with duplicates`,
      `(out of ${namesWithDuplicates.length} total, ${identifiedDuplicates} already identified)`,
    )
    summary.push([
      `  `,
      section,
      `|`,
      `${namesWithDuplicates.length - identifiedDuplicates} entries with duplicates`,
      `(out of ${namesWithDuplicates.length} total, ${identifiedDuplicates} already identified)`,
    ])

    for (let i = 0; i < namesWithDuplicates.length; i++) {
      const name = namesWithDuplicates[i]
      const indexes = index.bySection[section].byName[name]
      const entries = indexes.map(i => allEntries[i])

      const PAD_SIZE = _.max(entries.map(entry => entry._index.toString().length)) + 1
      const PAD2_SIZE = _.max(entries.map(entry => (entry.data.nameext == undefined ? entry.data.name : `${entry.data.name} (${entry.data.nameext})`).length)) + 2

      const DEBUG = DEBUG_NAME.includes(name) || DEBUG_I.includes(i)

      // check for duplicateOf identification
      const nonDuplicate = entries.filter(entry => entry.data.duplicateOf === undefined)
      const duplicates = entries.filter(entry => entry.data.duplicateOf !== undefined)

      if (nonDuplicate.length === 1 && duplicates.length >= 1) {
        // duplicates are properly identified, just move on
        summary.push([
          `   `,
          `∫[${i}] `.padEnd(namesWithDuplicates.length.toString().length + 3, ` `),
          `${name} `.padEnd(PAD_NAME + 1, `.`),
          `${entries.length}`.padStart(3 + 0, ` `),
          `→`,
          `${nonDuplicate[0]._index}:"${nonDuplicate[0].data.nameext == undefined ? nonDuplicate[0].data.name : `${nonDuplicate[0].data.name} (${nonDuplicate[0].data.nameext})`}"`,
        ])

        continue
      } else if (duplicates.length > 0) {
        // ERROR: How can there be multiple duplicate entries but no non-duplicate?
        debugger
      }

      // if (name === `Path of Air`) debugger
      console.log(`    `, `[${i}]`.padEnd(namesWithDuplicates.length.toString().length + 3, ` `), `${name} `.padEnd(PAD_NAME + 1, `.`), `${entries.length}`.padStart(3 + 0, ` `))
      summary.push([`    `, `[${i}]`.padEnd(namesWithDuplicates.length.toString().length + 3, ` `), `${name} `.padEnd(PAD_NAME + 1, `.`), `${entries.length}`.padStart(3 + 0, ` `)])

      console.log(`      `, `(entries)`)
      for (const entry of entries) {
        const extendedName = entry.data.nameext == undefined ? entry.data.name : `${entry.data.name} (${entry.data.nameext})`
        console.log(
          `        `,
          `${entry._index}`.padEnd(PAD_SIZE, ` `),
          extendedName.padEnd(PAD2_SIZE, ` `),
          (entry.data.specializationRequired ? `<specialization required>` : ``).padEnd(25 + 2, ` `),
          entry,
        )
      }

      if (DEBUG) {
        console.log(`      `, `(diff)`)

        const diff = compare(entries)

        console.log(`        `, `(distribution)`)
        for (let x = 0; x < entries.length; x++) {
          const X = entries[x]
          const log = [X._index.toString().padEnd(PAD_SIZE + 2, ` `)]

          for (let y = 0; y <= x; y++) {
            if (x === y) {
              log.push(`-`.padEnd(PAD_SIZE, ` `))
              continue
            }
            const Y = entries[y]

            const differingPaths = diff[X._index][Y._index] ?? []
            const differingFirstOrderKeys = uniq(differingPaths.map(path => path[0]))

            log.push(differingFirstOrderKeys.length.toString().padEnd(PAD_SIZE, ` `))
          }

          console.log(`          `, ...log)
        }

        console.log(`\n          `, ``.padEnd(PAD_SIZE + 2, ` `), entries.map(entry => entry._index.toString().padEnd(PAD_SIZE, ` `)).join(` `))

        console.log(`        `, `(specifics)`)
        for (const entry of entries) {
          const overallDiff = uniq(flatten(Object.values(diff[entry._index])).map(path => path.join(`.`)))

          console.log(`          `, entry._index.toString().padEnd(PAD_SIZE, ` `), `(differ in ${overallDiff.length} over all entries)`)

          const entryDiff = Object.entries(diff[entry._index]).map(([other, paths]) => [
            other,
            paths
              .map(path => path.join(`.`))
              .sort()
              .join(`, `),
          ])
          const groupedDiff = groupBy(entryDiff, ([, paths]) => paths)
          for (const listOfEntryAndDiff of Object.values(groupedDiff)) {
            const [entries, joinedPaths] = _.unzip(listOfEntryAndDiff)
            const paths = joinedPaths[0].split(`, `).map(path => path.split(`.`))

            const PAD_PATH = _.max(paths.map(path => path.join(`.`).length))

            console.log(`            `, `→ ${entries.join(`, `)}`)

            for (const path of paths) {
              const depth = path.length
              // const treePath = treefyPaths(paths)

              const diffValues = entries.map(entry => get(allEntries[entry].data, path))
              const uniqDiffValues = uniq(diffValues)

              if (uniqDiffValues.length === 1) {
                console.log(`              `, ``.padEnd(depth, ` `), path.join(`.`).padEnd(PAD_PATH, ` `), ` | `, get(entry.data, path), ` x `, uniqDiffValues[0])
              } else {
                for (let i = 0; i < entries.length; i++) {
                  if (i === 0)
                    console.log(
                      `              `,
                      ``.padEnd(depth, ` `),
                      path.join(`.`).padEnd(PAD_PATH, ` `),
                      ` | `,
                      get(entry.data, path),
                      ` x `,
                      `[${entries[i]}]`,
                      diffValues[i],
                    )
                  else
                    console.log(
                      `              `,
                      ``.padEnd(depth, ` `),
                      ``.padEnd(PAD_PATH, ` `),
                      `   `,
                      ``.padEnd(isPrimitive(get(entry.data, path)) ? get(entry.data, path).toString().length : 12, ` `),
                      `   `,
                      `[${entries[i]}]`,
                      diffValues[i],
                    )
                }
              }
            }
          }
        }
      }

      console.log(`      `, `(analysis)`)

      // specialization
      const nameext = entries.map(entry => entry.data.nameext)
      const specializationRequired = entries.map(entry => entry.data.specializationRequired)

      const noneWithSpecializationRequired = specializationRequired.filter(b => !!b).length === 0
      const onlyOneSpecializationRequired = specializationRequired.filter(b => b === true).length === 1
      const onlyOneWithoutNameext = nameext.filter(b => b === undefined).length === 1

      if (noneWithSpecializationRequired) console.log(`        `, `No entry with "specializationRequired"`)
      if (onlyOneSpecializationRequired)
        console.log(`        `, `Only one entry with "specializationRequired"`, `—`, entries.filter(entry => entry.data.specializationRequired)[0]._index)
      if (!noneWithSpecializationRequired && !onlyOneSpecializationRequired) {
        console.log(
          `        `,
          `Entries with "specializationRequired"`,
          `—`,
          entries.filter(entry => entry.data.specializationRequired).map(entry => entry._index),
        )
      }
      if (onlyOneWithoutNameext) console.log(`        `, `Only one entry without "nameext"`, `—`, entries.filter(entry => entry.data.nameext === undefined)[0]._index)

      if (DEBUG) debugger
    }
  }

  console.log(`\n\n > post analysis summary...`)
  for (const line of summary) {
    console.log(...line)
  }
}

module.exports.uniq = function (allEntries, index) {
  // const sections = Object.keys(index.bySection)
  // TODO: Remove duplicates for other shit too
  const sections = [`SKILLS`]

  const duplicates = {}
  for (const section of sections) {
    duplicates[section] = {} // map of all entries with some duplicate (N:N, squared table)

    // check for repeating full names
    const fullNames = Object.keys(index.bySection[section].byFullname)
    for (const fullName of fullNames) {
      const indexes = index.bySection[section].byFullname[fullName]
      if (indexes.length === 1) continue

      console.log(`  `, `Repeating full name "${fullName}" for ${indexes.length} entries:`, `  `, indexes.join(`, `))
    }

    const merges = []
    // check for repeating names
    const names = Object.keys(index.bySection[section].byName)
    for (const name of names) {
      const indexes = index.bySection[section].byName[name]
      if (indexes.length === 1) continue

      const entries = indexes.map(i => allEntries[i])

      const similarities = compare(entries)
      const differences = Object.fromEntries(Object.entries(similarities).filter(([key, value]) => value !== true))
      const differingKeys = Object.keys(differences)

      // determine quantitative difference in keys
      const avgK = _.sum(entries.map(entry => Object.keys(entry.data).length)) / entries.length
      const D = differingKeys.length

      // if there are not enough differences, skip
      const threshold = D <= 6 || D / avgK < 0.1
      // if (!threshold) continue

      // if there is an unmergeable key, skip merge
      const unMergeableKeys = [`techlvl`, `minst`, `damage`, `reach`, `type`]
      // if (differingKeys.some(key => unMergeableKeys.includes(key))) continue

      // TODO: Deal with techniques
      if (entries.some(entry => entry.data.cat?.includes(`Techniques`))) continue

      // organize differences
      const nameext = entries.map(entry => entry.data.nameext)
      const specializationRequired = entries.map(entry => entry.data.specializationRequired)

      const onlyOneSpecializationRequired = specializationRequired.filter(b => b === true).length === 1
      const onlyOneWithoutNameext = nameext.filter(b => b === undefined).length === 1

      // if only one of the entries is specialization required, merge all with it as main
      if (onlyOneSpecializationRequired || onlyOneWithoutNameext) {
        const specializationOnlyKeys = differingKeys.every(key => [`nameext`, `x`, `specializationRequired`, `dynamic`, `default`].includes(key))

        // ERROR: Untested
        if (!specializationOnlyKeys && entries.length > 2) debugger

        const specializationRequiredEntry = onlyOneSpecializationRequired
          ? entries.filter(entry => entry.data.specializationRequired)[0]
          : entries.filter(entry => entry.data.nameext === undefined)[0]

        merges.push([specializationRequiredEntry, entries, differences])
        continue
      }

      // if every differing key is allowed to merge, merge all with first as main
      const mergeableKeys = [`bassecost`, `baseweight`, `nameext`]
      if (differingKeys.every(key => mergeableKeys.includes(key))) {
        merges.push([entries[0], entries, differences])
        continue
      }

      // if (name === `Physician`) debugger
      if (name === `Physiology`) debugger

      console.log(`  `, `Undecided merge for`, `"${name}"`, `of`, indexes.join(`, `))
    }

    for (const merge of merges) {
      const [main, allEntries, differences] = merge
      const entries = allEntries.filter(entry => entry._index !== main._index)

      // ERROR: There must be at least one
      if (entries.length === 0) debugger

      console.log(`  `, `Merging`, `"${main.data.name}"`, `from`, allEntries.map(entry => entry._index).join(`, `))

      // merge versions
      main.data.mergedFrom = entries.map(entry => entry.text)
      for (const key of Object.keys(differences)) {
        const uniqDifferences = uniq(differences[key])
        main.data[key] = dynamicValue(`list`, { options: uniqDifferences })
      }

      // update indexes
      index.bySection[section].byName[main.data.name] = [main._index]

      if (main.data.nameext !== `` && !isNil(main.data.nameext) && !isString(main.data.nameext.type)) {
        const extendedName = main.data.nameext == undefined ? main.data.name : `${main.data.name} (${main.data.nameext})`
        debugger
        index.bySection[section].byName[extendedName] = [main._index]
      }
    }
  }
}

function treefyPaths(paths) {
  const tree = {}

  for (const path of paths) {
    const arrayPath = path.split(`.`)

    for (let i = 0; i < arrayPath.length; i++) {
      const component = arrayPath[i]

      const parent = arrayPath[i - 1]
      if (parent === undefined) {
        if (tree[component] === undefined) tree[component] = {}
      } else {
        tree[parent] = { component: {} }
      }
    }
  }

  return tree
}

function getDiff(A, B, path = []) {
  if (isPrimitive(A) && isPrimitive(B)) {
    return isEqual(A, B) ? [] : [[...path]]
  } else if (typeof A === typeof B) {
    const diff = []
    if (_.isObjectLike(A)) {
      const allKeys = uniq([...Object.keys(A), ...Object.keys(B)])

      for (const key of allKeys) {
        const keyDiff = getDiff(A[key], B[key], [...path, key])
        diff.push(...keyDiff)
      }

      return diff
    } else {
      debugger
    }
  }

  return [[...path]]
}

function compare(entries) {
  const diff = {}

  for (let i = 0; i < entries.length; i++) {
    const A = entries[i]
    for (let j = 0; j < entries.length; j++) {
      if (i === j) continue
      const B = entries[j]

      const diff2 = getDiff(A.data, B.data)

      if (diff[A._index] === undefined) diff[A._index] = {}
      if (diff[B._index] === undefined) diff[B._index] = {}

      diff[A._index][B._index] = diff2
      diff[B._index][A._index] = diff2
    }
  }

  return diff
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
