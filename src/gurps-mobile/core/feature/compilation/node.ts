import { isObjectLike, range } from "lodash"

export default class CompilationNode {
  key: string
  parent: CompilationNode | null
  children: CompilationNode[]

  constructor(key: string, parent: CompilationNode | null = null) {
    this.key = key
    this.parent = parent
    this.children = []
  }

  print(ident = 0) {
    const _ident = range(0, ident)
      .map(_ => `  `)
      .join(``)

    console.log(`${_ident}${this.key}`)
    this.children.map(child => child.print(ident + 1))
  }

  byLevel() {
    const stack = [this] as CompilationNode[]

    const level = [] as CompilationNode[]
    while (stack.length > 0) {
      const current = stack.shift()
      if (current) {
        level.push(...current.children)
        stack.push(...current.children)
      }
    }
  }

  static childrenDeep(parent: CompilationNode | null, trueOrChildren: true | object[]) {
    if (isObjectLike(trueOrChildren))
      return Object.entries(trueOrChildren).map(([key, children]) => {
        const node = new CompilationNode(key, parent)
        node.children = CompilationNode.childrenDeep(node, children)
        return node
      })
    else if (trueOrChildren !== true) {
      // ERROR: Shouldnt happen
      debugger
    }

    return []
  }

  mergeWith(tree: never) {
    const newChildren = CompilationNode.childrenDeep(null, tree)
    debugger
  }
}
