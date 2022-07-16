export default class ChatProcessor {
  /** @type {ChatProcessors|null} */
  registry: any | null
  /**
   * Override
   * @param {string} line - chat command
   * @returns {RegExpMatchArray|null|undefined} true if this processor will handle this chat command
   */
  matches(line: string): RegExpMatchArray | null | undefined
  /**
   * Override
   * @param {string} line - chat command
   * @returns {RegExpMatchArray|null|undefined} true if this processor will report how to use command
   */
  usagematches(line: string): RegExpMatchArray | null | undefined
  /**
   * Override to process a chat command
   * @param {string} line
   * @param {any|null} msgs
   * @returns {Promise<any>}
   */
  process(line: string, msgs?: any | null): Promise<any>
  /**
   * Override to return the '/help' display string
   * @returns {string|null}
   */
  help(): string | null
  /**
   * Override to true if this chat command only works for GMs
   */
  isGMOnly(): boolean
  send(): void
  /**
   * @param {string} txt
   * @param {boolean | undefined} [force]
   */
  priv(txt: string, force?: boolean | undefined): void
  /**
   * @param {string} txt
   */
  pub(txt: string): void
  /**
   * @param {string} txt
   */
  prnt(txt: string): void
  msgs(): any
}
