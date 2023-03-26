export interface IBonus {
  value: number
}

export function parseBonus(raw: string): IBonus {
  const value = parseInt(raw)

  if (!isNaN(value)) return { value }

  debugger
}

export function parseSign(bonus: IBonus | number) {
  let sign = 1
  let numeric = bonus as number

  if (typeof bonus !== `number`) {
    numeric = bonus.value
    sign = bonus.sign ?? 1
  }

  if (numeric < 0) sign = -1

  return `${sign >= 0 ? `+` : `-`}${Math.abs(numeric)}`
}
