import { sum } from "lodash"

export function asNumber(string: string) {
  // Generate the first 26 Fibonacci numbers
  let fib = [1, 1]
  for (let i = 2; i < 26; i++) {
    fib[i] = fib[i - 1] + fib[i - 2]
  }

  // Create a mapping from letters to Fibonacci numbers
  let letterMap = {}
  for (let i = 0; i < 26; i++) {
    letterMap[String.fromCharCode(`a`.charCodeAt(0) + i)] = fib[i]
  }

  const array = [...string].map(char => letterMap[char])
  return sum(array)
}
