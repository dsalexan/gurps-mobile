/**
 * Derive receives a specific set of observed values into another set of values
 */
function derive(newValues: Record<string, unknown>, previousValues: Record<string, unknown>, { previousSources, sources }) {}

function _name(context, { name }) {
  context.humanId = name
  return name
}
