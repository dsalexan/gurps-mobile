export interface IBonus {
  value: number
}

export function parseBonus(raw: string): IBonus {
  const value = parseInt(raw)

  if (!isNaN(value)) return { value }

  debugger
}
