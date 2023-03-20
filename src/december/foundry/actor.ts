export function getActor(value: string, key = `id`) {
  let id: string | undefined

  if (key === `id`) id = value
  else if (key === `name`) id = game.actors?.find(actor => actor.name === value)?.id
  else throw new Error(`getActor with key "${key}" was not implemented`)

  return id
}
