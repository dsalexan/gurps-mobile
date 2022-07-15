export async function preloadTemplates(): Promise<Handlebars.TemplateDelegate[]> {
  const templatePaths: string[] = [
    // Add paths to "modules/gurps-mobile/templates"
  ]

  return loadTemplates(templatePaths)
}
