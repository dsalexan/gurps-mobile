import { MigratableObject, MigrationDataObject, completeMigrationValueDefinitions } from "./migration"
import CompilationTemplate from "./template"

export default class ManualCompilationTemplate {
  static build(definition: Record<string, any> & { _source?: string; _order?: string[] }) {
    let order = definition._order as string[]

    const index = {} as Record<string, any>
    for (const [key, fn] of Object.entries(definition)) {
      if (key === `_order` || key === `_source`) continue

      index[key] = fn
    }

    if (order === undefined) order = Object.keys(index)

    return {
      name: `Manual`,

      source(name: string, source: object) {
        return source
      },

      compile(name: string, sources: Record<string, object>, context: Record<string, any>): MigrationDataObject | null {
        if (name !== `manual`) return null

        const MDO = {} as MigrationDataObject
        for (const key of order) {
          if (index[key] === undefined) continue

          const value = index[key](sources, context)
          if (key === `id`) {
            const id = value._meta ? value.value : value
            context.id = id
          }

          MDO[key] = value
        }

        return MDO
      },

      /**
       * Post compilation call to do shome shit if necessary. This call returns migration definitions for the entire DATA final object, bc
       */
      post(data: object, context: object, sources: Record<string, object>): MigrationDataObject | null {
        return null
      },
    } as unknown as CompilationTemplate
  }
}
