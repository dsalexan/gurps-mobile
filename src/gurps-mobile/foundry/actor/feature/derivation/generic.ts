/**
 * Derive receives a specific set of observed values into another set of values
 */
function derive(context, newValues: Record<string, unknown>, previousValues: Record<string, unknown>, { previousSources, sources }) {}

/**
 * The ideia is to receive a stripped down version of sources in newValues, with only the information required
 * Then, derive that information into new tuples to add to final data
 */
function proxy(context, newValues: Record<string, unknown>, previousValues: Record<string, unknown>, { previousSources, sources }) {
  for (const [key, value] of Object.entries(newValues)) {
  }
}

/**
 * ADD SOURCE
 *
 *
 * UPDATE SOURCE
 */

function _name(context, { name }) {
  context.humanId = name
  return name
}
