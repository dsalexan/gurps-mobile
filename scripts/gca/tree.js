const { range, flatten, sortBy, isEqual, first, isString, flattenDeep, before, isNil, orderBy, isArray } = require(`lodash`)
const { node } = require(`prop-types`)
const { COMPLETE_PROTOCOL_PATTERNS } = require(`./typed_value`)
const { isNumeric } = require(`./utils`)

const letters = [`a`, `b`, `c`, `d`, `e`, `f`, `g`, `h`, `i`, `j`, `k`, `l`, `m`, `n`, `o`, `p`, `q`, `r`, `s`, `t`, `u`, `v`, `w`, `x`, `y`, `z`]
/**
 *
 * @param i
 * @param j
 */
function name(j) {
  let i = j % letters.length
  const f = Math.floor(j / letters.length)

  return `${range(0, f)
    .map(() => letters[0])
    .join(``)}${letters[i]}`
}

const LETTER = { parenthesis: `ρ`, braces: `γ`, brackets: `β`, quotes: `κ`, percentage: `τ`, minus: `s`, plus: `a` }

const CLOSER_BY_CHARACTER = { parenthesis: `)`, braces: `}`, brackets: `]`, quotes: `"`, percentage: `%` }
const OPENER_BY_CHARACTER = { parenthesis: `(`, braces: `{`, brackets: `[`, quotes: `"`, percentage: `%`, minus: `-`, plus: `+` }

const CHARACTERS_BY_TYPE = {
  enclosure: [`parenthesis`, `braces`, `brackets`, `quotes`, `percentage`],
  math: [`plus`, `minus`, `division`, `product`],
}

const CHARACTERS = {
  parenthesis: {
    set: [`(`, `)`],
    opener: `(`,
    closer: `)`,
    letter: `ρ`,
    prio: 0,
    type: `enclosure`,
  },
  braces: {
    set: [`{`, `}`],
    opener: `{`,
    closer: `}`,
    letter: `γ`,
    prio: 0,
    type: `enclosure`,
  },
  brackets: {
    set: [`[`, `]`],
    opener: `[`,
    closer: `]`,
    letter: `β`,
    prio: 0,
    type: `enclosure`,
  },
  quotes: {
    set: [`"`],
    opener: `"`,
    closer: `"`,
    letter: `κ`,
    prio: 0,
    type: `enclosure`,
    escape: [`minus`, `plus`, `division`, `product`],
  },
  percentage: {
    set: [`%`],
    opener: `%`,
    closer: `%`,
    letter: `τ`,
    prio: 0,
    type: `enclosure`,
  },
  // math
  minus: {
    set: [`-`],
    middle: `-`,
    letter: `s`,
    prio: 0,
    type: `math`,
    identity: 0,
  },
  plus: {
    set: [`+`],
    middle: `+`,
    letter: `a`,
    prio: 0,
    type: `math`,
    identity: 0,
  },
  division: {
    set: [`/`],
    middle: `/`,
    letter: `d`,
    prio: 1,
    type: `math`,
    identity: 1,
  },
  product: {
    set: [`*`],
    middle: `*`,
    letter: `m`,
    prio: 1,
    type: `math`,
    identity: 1,
  },
}

const TYPE_BY_CHARACTER = Object.fromEntries(flatten(Object.entries(CHARACTERS).map(([key, type]) => type.set.map(char => [char, key]))))
const OPENERS = Object.fromEntries(
  Object.entries(CHARACTERS)
    .map(([key, type]) => (type.opener ? [type.opener, key] : undefined))
    .filter(b => b !== undefined),
)
const CLOSERS = Object.values(CHARACTERS)
  .map(character => character.closer)
  .filter(b => !isNil(b))

class Tree {
  constructor(text, types = [{ type: `enclosure`, character: [`parenthesis`, `braces`, `brackets`, `quotes`] }]) {
    this.text = text
    this.root = new Node(null, 0, { type: `string` }, `root`)
    this.root.tree = this

    this.children = [this.root]

    this.TYPES = types.map(type => (isString(type) ? { type, character: CHARACTERS_BY_TYPE[type] } : type))
    this.allRelevantCharacters = flattenDeep(this.TYPES.map(type => type.character.map(character => CHARACTERS[character].set)))
  }

  byLevel() {
    const list = this.root.byLevel()

    list.shift()

    return list
  }

  print() {
    console.log(this.text)
    console.log(` `)
    this.root.print()
  }

  extract() {
    this.root.close()
  }

  parse() {
    this.root.parse()
  }

  toString() {
    return `<#${this.root.context}>`
  }

  static removeUnbalance(string) {
    const tree = new Tree(string)
    tree.parse()
    const unbalanced = tree.root.unbalanced

    if (unbalanced.length > 0) {
      return [...string].filter((_, index) => !unbalanced.includes(index)).join(``)
    }

    return string
  }
}

class Node {
  constructor(parent, start, type, id = null) {
    this.start = start
    this.end = null

    this.type = type
    this.id = id

    this.parent = parent
    this.children = []
    this.unbalanced = []

    this.intermediary = null

    if (parent) this.tree = parent.tree
  }

  get level() {
    return (this.parent?.level ?? -1) + 1
  }

  get safe_end() {
    return this.end ?? this.tree.text.length
  }

  get opener() {
    return OPENER_BY_CHARACTER[this.type.character]
  }

  get closer() {
    return CLOSER_BY_CHARACTER[this.type.character]
  }

  get subText() {
    return this.tree.text.substring(this.start, this.safe_end + 1)
  }

  get fowardText() {
    return this.tree.text.substring(this.start, this.tree.text.length)
  }

  get backwardsText() {
    return this.tree.text.substring(0, this.safe_end + 1)
  }

  get prefix() {
    if (this.children.length > 0) {
      const firstChild = this.children[0]
      return this.tree.text.substring(this.start, firstChild.start)
    }

    return this.tree.text.substring(this.start, this.safe_end + 1)
  }

  get suffix() {
    if (this.children.length > 0) {
      const lastChild = this.children[this.children.length - 1]
      return this.tree.text.substring(lastChild.end + 1, this.safe_end)
    }

    return ``
  }

  get context() {
    if (this.id === `root`) return `root`
    const TYPE = CHARACTERS[this.type.character]
    return `${TYPE?.letter ?? `x`}${this.level}${this.id === `root` ? `` : `.` + name(this.id)}`
  }

  get compactContext() {
    return `${LETTER[this.type] ?? `x`}${name(this.id)}`
  }

  get allRelevantCharacters() {
    return this.tree.allRelevantCharacters
  }

  get isUnbalanced() {
    return this.end === null
  }

  get before() {
    return this.children.slice(0, this.intermediary)
  }

  get after() {
    return this.children.slice(this.intermediary)
  }

  /** @override */
  toString() {
    const text = []

    const TYPE = CHARACTERS[this.type.character]

    if (this.id === `root`) {
      text.push(this.children.map(child => child.toString()).join(`, `))
    } else if (this.type.type === `string`) text.push(this.tree.text.substring(this.start, this.end + 1))
    else if (this.type.type === `math`) {
      text.push(
        this.children
          .slice(0, this.intermediary)
          .map(child => `<#${child.context}>`)
          .join(`, `),
      ) //this.children[0].toString())
      text.push(TYPE.middle)
      text.push(
        this.children
          .slice(this.intermediary)
          .map(child => `<#${child.context}>`)
          .join(`, `),
      )
    } else if (this.type.type === `enclosure`) {
      text.push(this.children.map(child => child.toString()).join(`, `))
    } else {
      text.push(`Unimplemented "${this.type.type} (${this.type.character})" type`)
      debugger
    }

    return `${text.join(``)}`
  }

  stringify(children = true) {
    const text = []

    if (this.id === `root`) {
      text.push(this.children.map(child => child.stringify(false)).join(``))
    } else if (this.type.type === `string`) text.push(this.tree.text.substring(this.start, this.end + 1))
    else if (this.type.type === `enclosure`) {
      if (!children) text.push(`<#${this.context}>`)
      else text.push(this.children.map(child => child.stringify(false)).join(``))
    } else if (this.type.type === `math`) {
      if (!children) text.push(`<#${this.context}>`)
      else {
        text.push(this.before.map(child => child.stringify(false)).join(``))
        text.push(CHARACTERS[this.type.character].middle)
        text.push(this.after.map(child => child.stringify(false)).join(``))
      }
    } else {
      text.push(`Unimplemented "${this.type.type} (${this.type.character})" type`)
      debugger
    }

    return `${text.join(``)}`
  }

  node(context) {
    return this.children.find(n => n.context === context)
  }

  byLevel() {
    const list = [[this]]

    let newLeaves
    do {
      const leaves = list[list.length - 1]

      newLeaves = []
      for (const node of leaves) newLeaves.push(...node.children)

      list.push(newLeaves)
      // debugger
    } while (newLeaves.length > 0)

    if (this.isUnbalanced) list.shift()
    list.pop()

    return list
  }

  _byIndex() {
    const entries = []

    if (!this.isUnbalanced) {
      entries.push([this.start, this])
      entries.push([this.end, this])
    }

    entries.push(...flatten(this.children.map(node => node._byIndex())))

    return entries
  }

  byIndex() {
    return Object.fromEntries(this._byIndex())
  }

  deepUnbalanced() {
    const list = []

    let stack = [this]
    do {
      const node = stack.shift()

      list.push(...node.unbalanced)

      stack.push(...node.children)
    } while (stack.length > 0)

    return list
  }

  _print(fn = c => c, _prefix = ``, _suffix = ``) {
    const PAD = this.tree.text.length.toString().length
    let output = [...this.subText]

    output = output.map((c, i) => {
      if (!this.tree.allRelevantCharacters.includes(c)) return undefined
      // if (this.byIndex[i] && this.byIndex[i]) return c
      const result = fn(c, i)
      if (result === undefined) return ` `

      return result
    })

    output = output.map(c => (c !== undefined && c !== null ? c.toString().padEnd(PAD) : c))
    console.log(`${(_prefix ?? ``).toString().padEnd(10)}${output.filter(c => c !== undefined && c !== null).join(` `)}${(_suffix ?? ``).toString().padStart(10)}`)
  }

  print() {
    console.log(` `)
    this._print((c, i) => c)
    this._print((c, i) => i)

    if (this.isUnbalanced && this.children.length === 0) {
      console.log(`UNBALANCED`)
      return console.log(this)
    }

    const unbalanced = this.deepUnbalanced()
    if (unbalanced.length > 0) this._print((c, i) => (unbalanced.includes(i) ? `!` : ` `), `  !:`.toString().padEnd(10))

    const offsetLevel = this.isUnbalanced ? 0 : this.level
    const levels = this.byLevel().map(nodes => nodes.map(node => node.context))
    const byIndex = this.byIndex()

    for (const level of range(0, levels.length)) {
      this._print(
        (c, i) => {
          const node = byIndex[i]
          if (!node) return ` `
          if (node.level !== level) return ` `

          return node.compactContext
        },
        // preffix
        (`  ` + (level + offsetLevel) + `:`).toString().padEnd(10),
      )
    }

    console.log(this)
  }

  balance() {
    const levels = this.byLevel()

    for (const level of range(0, levels.length)) {
      const nodes = levels[level]
      nodes.map(node => (node.level = level))
    }
  }

  addChild(node) {
    let target = 0
    for (let i = 0; i < this.children.length; i++) {
      const sibling = this.children[i]
      if (node.start > sibling.end) target = i + 1
      else break
    }

    this.children.splice(target, 0, node)
    node.parent = this
    node.id = target

    node.reIDChildren()

    // debugger
    return target
  }

  reIDChildren() {
    this.children.map((child, index) => (child.id = index))
  }

  parse(escape) {
    // if there is a END specified, only parse until it
    let content = this.tree.text.substring(this.start, this.safe_end + 1)

    // prefix index for content
    let i0 = this.start

    // advance one to account for enclosure opener
    if (this.type.type === `enclosure`) {
      content = content.substring(1)
      i0++
    }

    const ESCAPING_ENCLOSURE = [...new Set([...(escape ?? []), ...(CHARACTERS[this.type.character]?.escape ?? [])])]

    const children = []
    let text = null
    for (let i = 0; i < content.length; i++) {
      const index = i + i0
      const char = content[i]

      // if special character (enclosure or middle or any other shit)
      const TYPE = CHARACTERS[TYPE_BY_CHARACTER[char]]

      // if it is not a special character, feed text and keep going
      const notSpecialCharacter = !this.allRelevantCharacters.includes(char)

      // if node enclosure escapes something
      //    AND which it escapes is ALL or corresponding TYPE OF CURRENT CHAR
      //    AND current char IS NOT CLOSER for node enclosure
      const escapedCharacter =
        ESCAPING_ENCLOSURE && (ESCAPING_ENCLOSURE === `*` || ESCAPING_ENCLOSURE.includes(TYPE_BY_CHARACTER[char])) && char !== CHARACTERS[this.type.character].closer

      // special case for "minus"
      const escapeMinus =
        TYPE_BY_CHARACTER[char] === `minus` && //
        isString(content[i - 1]) &&
        !!content[i - 1].match(/[^\s\d]/) &&
        isString(content[i + 1]) &&
        !!content[i + 1].match(/[^\s\d]/)

      // nothing to parse here, feed text and keep going
      if (notSpecialCharacter || escapedCharacter || escapeMinus) {
        if (text === null) text = new Node(this, index, { type: `string` }, children.length)
        text.end = index
        continue
      }

      // add current text to children and kill it
      if (!isNil(text?.end)) {
        children.push(text)
        text = null
      }

      // middle operator
      //    add symbol operator as a child node
      if (TYPE.middle) {
        // close text onde character before, if possible
        if (text) {
          text.end = index - 1
          children.push(text)
          text = null
        }

        // add symbol operator as a child (any rearranging is for later)
        const symbol = new Node(this, index, { type: TYPE.type, character: TYPE_BY_CHARACTER[char] }, children.length)
        symbol.end = index
        symbol.operatorIndex = index
        children.push(symbol)
      } else if (char === CHARACTERS[this.type.character]?.closer) {
        // if character CLOSES an ENCLOSURE

        // just advance enclosure here and break the loop, no need to parse the rest
        //    parent loop will deal with any future characters
        this.end = index
        break
      } else if (TYPE.opener === char) {
        // if it is an ENCLOSURE operator
        //    first chat and last char assigns the type, but the contents in between are children of node

        // parse contents of enclosure and add as a child
        const child = new Node(this, index, { type: TYPE.type, character: TYPE_BY_CHARACTER[char] }, this.children.length)
        child.parse(ESCAPING_ENCLOSURE)

        let end = child.end
        if (child.isUnbalanced) {
          // add unbalanced char to last current children
          if (children[children.length - 1]?.type === `string` && children[children.length - 1]?.end === index - 1)
            text = children.pop() // recover last inserted child into text node
          else text = new Node(this, index, { type: `string` }, children.length) // make new text

          // close text (but dont add to children)
          text.end = index

          // register unbalanced index
          this.unbalanced.push(index)

          // move cursor to last child end
          end = index
        } else {
          // add to children and advanced index up until child's end
          children.push(child)
        }

        i += end - index
      } else if (CLOSERS.includes(char)) {
        // character SHOULD close something
        //    but doesnt
        //    so it is a unbalanced character, just flag it

        this.unbalanced.push(index) // register unbalanced index

        if (children[children.length - 1]?.type === `string` && children[children.length - 1]?.end === index - 1)
          text = children.pop() // recover last inserted child into text node
        else text = new Node(this, index, { type: `string` }, children.length) // make new text
        text.end = index // advance one to account for unbalanced character
      }
    }

    if (!isNil(text)) {
      // close text at the end of content

      // text.end = content.length - 1 + i0
      if (!isNil(text.end)) {
        // if text has something in it, add to children
        if (text.end - text.start >= 0) children.push(text)
      }
    }

    // add children
    if (children.length > 0) {
      // if (children.length === 8 && this.tree.text === `"SK:%Gun SkillsList%::level" - 4 + ST:IQ - ST:DX`) debugger
      const types = children.map(child => child.type)
      const childrenWithTypes = children.map((child, index) => [index, CHARACTERS[child.type.character], child.type.type])

      if (childrenWithTypes.some(([index, type]) => type?.middle)) {
        // if there are some MIDDLE nodes

        const tokens = []

        let prefix = []
        // for each node in children
        for (let i = 0; i < childrenWithTypes.length; i++) {
          const [index, type] = childrenWithTypes[i]

          // if node is MIDDLE
          if (type?.middle) {
            // add prefix (array of nodes) as a whole token
            tokens.push(prefix)

            // add itself as token (but alone, not as an array)
            tokens.push(children[index])

            prefix = []
          } else {
            // if it is not, add to prefix
            prefix.push(children[index])
          }
        }

        // add remaining array of nodes to prefix (which would make it the last suffix)
        tokens.push(prefix)

        // prioritize MIDDLE nodes by prio
        const middlesWithPriority = tokens
          .map((token, index) => [index, token])
          .filter(([index, token]) => !isArray(token))
          .map(([index, token]) => [index, CHARACTERS[token.type.character].prio])
        const prioritized = orderBy(middlesWithPriority, [([index, type]) => type.prio], [`desc`])

        // create array to register which tokens were already merged/rearranged into its operator node
        const array = range(0, tokens.length)

        // for each MIDDLE node by priority
        for (const [index, type] of prioritized) {
          const _index = array.indexOf(index)

          const _before = _index - 1
          const _after = _index + 1

          // get before and after nodes to MIDDLE
          const before = isArray(tokens[array[_before]]) ? tokens[array[_before]].filter(node => !node.subText.match(/^\s+$/)) : [tokens[array[_before]]]
          const after = isArray(tokens[array[_after]]) ? tokens[array[_after]].filter(node => !node.subText.match(/^\s+$/)) : [tokens[array[_after]]]

          const node = tokens[index]
          before.map(child => node.addChild(child))
          after.map(child => node.addChild(child))

          node.intermediary = before.length // mark which child is first of after
          node.start = before.length > 0 ? before[0].start : after[0].start
          if (after.slice(-1)[0] === undefined) debugger
          node.end = after.slice(-1)[0].end

          array.splice(_after, 1)
          array.splice(_before, 1)
        }

        array.map(index => this.addChild(tokens[index]))
      } else {
        children.map(child => this.addChild(child))
      }
    }
  }

  traverse(depth = 0) {
    const ident = range(0, depth)
      .map(_ => `  `)
      .join(``)

    const TYPE = CHARACTERS[this.type.character]

    let repr
    if (this.id === `root`) repr = `root`
    else if (this.type.type === `string`) repr = `'${this.toString().substring(0, 35)}'`
    else if (this.type.type === `math`) repr = TYPE.middle
    else if (this.type.type === `enclosure`) repr = `${TYPE.opener}${TYPE.closer}`
    else {
      repr = `Unimplemented '${this.type.type} (${this.type.character})' type`
      debugger
    }

    console.log(ident, `<#${this.context}>:`, repr, ` .... `, `'${this.subText.substring(0, 35)}'`)

    for (let i = 0; i < this.children.length; i++) {
      if (i === this.intermediary) console.log(ident, `    `, `↹`)

      const child = this.children[i]
      child.traverse(depth + 1)
    }
  }
}

let originalEntry
// originalEntry = `),name<#0.0>,error("{, mamamia{"(}"")}),nameext<#0.1>,cat<#0.2>,cost<#0.3>,displaycost<#0.4>,appearance<#0.5>,description<#0.6>,page<#0.7>,race<#0.8>,noresync<#0.9>,owns<#0.10>,gives<#0.11>,adds(AD:Racial Bite Attack respond <#q0.0>,AD:Racial Skill Point Bonus <#0.12> = 2 respond <#q0.1>,AD:Racial Skill Point Bonus <#0.13> = 2 respond <#q0.2>,AD:360° Vision,AD:Acidic Bite <#0.14> = 1 respond 1,AD:Combat Reflexes with "Cannot Block or Parry, +0, group<#0.15>, page<#0.16>, gives(=nobase to ST:DX::blockat$ listAs <#q0.3>, =nobase to ST:DX::parryat$ listAs <#q0.4>, =nobase to SK:Brawling::parryat$ listAs <#q0.5>, =nobase to ST:Punch::Parry$, =<#q0.6> to ST:Punch::Parry$, =nobase to SK:Brawling::Parry$ listAs <#q0.7>, =<#q0.8> to SK:Brawling::Parry$, =nobase to AD:Striker::Parry$ listAs <#q0.9>, =<#q0.10> to AD:Striker::Parry$, =nobase to AD:Racial Punch Attack::Parry$ listAs <#q0.11>, =<#q0.12> to AD:Racial Punch Attack::Parry$), description(Most animals have No Fine Manipulators <#0.17> and, therefore, cannot parry. Those with manipulators <#0.18> can parry. No natural animal can block.)",AD:Damage Resistance = 4,AD:Extra Legs <#0.19> with "Long, +100%/+200%, group<#0.20>, page<#0.21>, gives<#0.22>" respond 8,AD:Infravision,AD:Super Jump <#0.23> = 1,AD:Teeth <#0.24>,DI:Horizontal,DI:No Kick,DI:No Punch,DI:No Fine Manipulators,SK:Jumping==0pts#DoNotOwn,SK:Stealth==0pts#DoNotOwn,TE:Wild Animal),creates({AD:Racial ST Bonus, 10/20, cat<#0.25>, mods<#0.26>, gives<#0.27>, initmods({<#q0.13>, -10%, group<#0.28>, page<#0.29>, formula(-@if<#0.30>), forceformula<#0.31>} | {<#q0.14>, -40%, group<#0.32>, formula(-@if<#0.33>), forceformula<#0.34>})} = 16,{AD:Racial DX Bonus, 20/40, cat<#0.35>, mods<#0.36>, gives<#0.37>, initmods({<#q0.15>, -40%, group<#0.38>, formula(-@if<#0.39>), forceformula<#0.40>})} = 5),features(Can walk over SM 0 or smaller adventurers without needing to evade. Acid glands contain enough acid for 3d acid grenades <#0.41>. Specimens with higher ST and HP aren't unheard of; Move, leaping distance, and acid are unchanged. Class: Dire Animal.),locks<#0.42>,hides<#0.43>`
// originalEntry = `name(Acid Spider),nameext(Dungeon Fantasy),cat(Racial Templates, Racial Templates - Dungeon Fantasy, Racial Templates - Dungeon Fantasy - Dire Animal),cost(10),displaycost(190),appearance(This giant spider has a relatively tiny body – “only” 7' across – attached to long, hairy legs that lift it 7' off the ground.),description(Class: Dire Animal. This giant spider has a relatively tiny body – “only” 7' across – attached to long, hairy legs that lift it 7' off the ground. It can walk unhindered over all but the tallest of men. A hunting spider, it lurks in dark cracks, waiting for warm prey to happen by. It then jumps on its quarry, bites with fangs capable of penetrating plate armor, and injects fast-acting corrosive venom that partially digests its prey.),page(DF2:21),race(Acid Spider),noresync(yes),owns(yes),gives(-5 to ST:IQ,+3 to ST:HT,+7 to ST:Perception,+7 to ST:Will,+2 to ST:Basic Move,+2 to ST:Size Modifier),adds(AD:Racial Bite Attack respond "Acidic Bite",AD:Racial Skill Point Bonus ([Skill]) = 2 respond "Jumping",AD:Racial Skill Point Bonus ([Skill]) = 2 respond "Stealth",AD:360° Vision,AD:Acidic Bite (Corrosion Attack) = 1 respond 1,AD:Combat Reflexes with "Cannot Block or Parry, +0, group(Animal Characteristics), page(B461), gives(=nobase to ST:DX::blockat$ listAs "Cannot Block", =nobase to ST:DX::parryat$ listAs "Cannot Parry", =nobase to SK:Brawling::parryat$ listAs "Cannot Parry", =nobase to ST:Punch::Parry$, ="No" to ST:Punch::Parry$, =nobase to SK:Brawling::Parry$ listAs "Cannot Parry", ="No" to SK:Brawling::Parry$, =nobase to AD:Striker::Parry$ listAs "Cannot Parry", ="No" to AD:Striker::Parry$, =nobase to AD:Racial Punch Attack::Parry$ listAs "Cannot Parry", ="No" to AD:Racial Punch Attack::Parry$), description(Most animals have No Fine Manipulators (included in Ichthyoid, Quadruped, and Vermiform) and, therefore, cannot parry. Those with manipulators (e.g., apes) can parry. No natural animal can block.)",AD:Damage Resistance = 4,AD:Extra Legs (7+ Legs) with "Long, +100%/+200%, group(Extra Legs), page(B55), gives(+1 to ST:Leg SM)" respond 8,AD:Infravision,AD:Super Jump (10-yard jump) = 1,AD:Teeth (Fangs),DI:Horizontal,DI:No Kick,DI:No Punch,DI:No Fine Manipulators,SK:Jumping==0pts#DoNotOwn,SK:Stealth==0pts#DoNotOwn,TE:Wild Animal),creates({AD:Racial ST Bonus, 10/20, cat(Attributes), mods(Extra ST, Size, No Fine Manipulators), gives(+1 to ST:ST), initmods({"Size", -10%, group(Size ST), page(B15), formula(-@if(ST:Size Modifier::score > 0 THEN ST:Size Modifier::score * 10 else 0)), forceformula(yes)} | {"No Fine Manipulators", -40%, group(No Fine Manipulators Stat), formula(-@if(ST:No Fine Manipulators >0 then 40 else 0)), forceformula(yes)})} = 16,{AD:Racial DX Bonus, 20/40, cat(Attributes), mods(Extra DX, No Fine Manipulators), gives(+1 to ST:DX), initmods({"No Fine Manipulators", -40%, group(No Fine Manipulators Stat), formula(-@if(ST:No Fine Manipulators > 0 then 40 else 0)), forceformula(yes)})} = 5),features(Can walk over SM 0 or smaller adventurers without needing to evade. Acid glands contain enough acid for 3d acid grenades ($10 each). Specimens with higher ST and HP aren't unheard of; Move, leaping distance, and acid are unchanged. Class: Dire Animal.),locks(yes),hides(yes)`
// originalEntry = `name(Travel Mass Speed),cat(Exotic, Physical, Natural Attacks, Exotic Physical),cost(10/20),mods(Affliction, Affliction Enhancements, Affliction Limitations, _Attack Enhancements, _Attack Limitations, Alternative Attack),page(B35, P39),damage(HT±$solver(me::level - 1)),damtype(aff),acc(3),rangehalfdam(10),rangemax(100),rof(1),shots(),rcl(1),skillused(ST:HT),mode(Primary),x(),noresync(yes),"displaycost(50),initmods(Area_Effect (4 hex), +100%, group(_Attack Enhancements), page(B102), shortname(Area Effect), gives(4 to owner::radius),| Advantage: Enhanced Move 0.5 (Ground), +100%, group(Affliction), page(B36, DF5:18),| Emanation, -20%, group(_Attack Limitations), page(B112),gives(="$solver(owner::charradius) yd" to owner::reach$,=nobase to owner::rangehalfdam$,=nobase to owner::rangemax$ ),| Extended Duration (Permanent while servitor is alive and summoned), +150%, group(_General), page(B105),| Malediction, +100%/+150%/+200%, upto(3), group(_Attack Enhancements), page(B106),levelnames(Receives -1/yd range, Uses Speed/Range Table, Uses Long-Distance Modifiers),gives(=nobase to owner::reach$,=nobase to owner::acc$,=nobasenocalc to owner::rangehalfdam$,=nobasenocalc to owner::rangemax$,=nobase to owner::rof$,=nobase to owner::shots$,=nobase to owner::rcl$,=" mal " to owner::damtype$,=$indexedvalue(me::level, "-1/yd", "Speed/Range", "Long-Distance") to owner::rangemax$),| Preparation Required (1 hour), -50%, group(_General), page(B114),| Selective Area, +20%, group(_Attack Enhancements), page(B108))`
// originalEntry = `)error("{, mamamia{"(}"")})`
// originalEntry = `(}"")`
// originalEntry = `{(1)(}`
// originalEntry = `{(1)})`
// originalEntry = `X + Y`
// originalEntry = `X - 10 + 5`
// originalEntry = `(X - 10) + Y`
// originalEntry = `"SK:Two-Handed Flail" -3`
// originalEntry = `"SK:Guns (Light Anti-Armor Weapon)" - 4`

// // const tree = new Tree(originalEntry, [`parenthesis`, `braces`, `brackets`, `quotes`, `percentage`, `minus`, `plus`])
// const tree = new Tree(originalEntry, [
//   { type: `enclosure`, character: [`parenthesis`, `braces`, `brackets`, `quotes`, `percentage`] },
//   { type: `math`, character: [`minus`, `plus`] },
// ])

// console.log(originalEntry)
// console.log(` `)

// const PAD = Math.floor(Math.log10(originalEntry.length)) + 1
// console.log(
//   [...originalEntry]
//     .map(char => char)
//     .join(
//       range(0, PAD)
//         .map(() => ` `)
//         .join(``),
//     ),
// )
// console.log([...originalEntry].map((char, index) => index.toString().padEnd(PAD)).join(` `))

// tree.parse()
// tree.print()

// console.log(` `)
// tree.root.traverse()
// console.log(`\n(tree):`, tree.root.toString())

// debugger

module.exports.name = name
module.exports.CHARACTERS = CHARACTERS
module.exports.Tree = Tree
module.exports.Node = Node
