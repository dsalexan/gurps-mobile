/* eslint-disable @typescript-eslint/ban-types */
import ChatProcessor from "./chat/chat-processor"

export default function addChatHooks(): void

export declare class ChatProcessorRegistry {
  /**
   * @type {ChatProcessor[]}
   */
  _processors: ChatProcessor[]
  /** @type {{pub: string[], priv: string[], data: any, quiet?: boolean, oldQuiet?: boolean, event?: any}} */
  msgs: {
    pub: string[]
    priv: string[]
    data: any
    quiet?: boolean
    oldQuiet?: boolean
    event?: any
  }
  processorsForAll(): ChatProcessor[]
  processorsForGMOnly(): ChatProcessor[]
  /**
   * Make a pre-emptive decision if we are going to handle any of the lines in this message
   * @param {string} message
   */
  willTryToHandle(message: string): boolean
  /**
   * At this point, we just have to assume that we are going to handle some (if not all) of the messages in lines.
   * From this point on, we want to be in a single thread... so we await any async methods to ensure that
   * we get a response.
   * @param {string} message
   * @param {{shiftKey: boolean;ctrlKey: boolean;data: {};} | undefined} [event]
   * @param {import('@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/data.mjs/chatMessageData').ChatMessageDataConstructorData | { speaker: any}} chatmsgData
   * @returns {Promise<boolean>}
   */
  startProcessingLines(
    message: string,
    chatmsgData:
      | any
      | {
          speaker: any
        },
    event?:
      | {
          shiftKey: boolean
          ctrlKey: boolean
          data: {}
        }
      | undefined,
  ): Promise<boolean>
  /**
   * @param {string} message
   */
  processLines(message: string): Promise<boolean>
  /**
   * @param {string} line
   */
  processLine(line: string): Promise<boolean>
  /**
   * Handle the chat message
   * @param {String} line - chat input
   * @returns true, if handled
   */
  handle(line: string): Promise<boolean[]>
  /**
   * Register a chat processor
   * @param {ChatProcessor} processor
   */
  registerProcessor(processor: ChatProcessor): void
  /**
   * @param {string[]} priv
   */
  _sendPriv(priv: string[]): void
  /**
   * @param {string[]} pub
   * @param {any} chatData
   */
  _sendPub(pub: string[], chatData: any): void
  send(): void
  /**
   * @param {string} txt
   */
  pub(txt: string): void
  /**
   * @param {string} txt
   */
  priv(txt: string, force?: boolean): void
  /**
   * @param {string} txt
   */
  prnt(txt: string): void
  /**
   * @param {boolean} quiet
   * @param {boolean} shift
   * @param {boolean} ctrl
   */
  setEventFlags(quiet: boolean, shift: boolean, ctrl: boolean): void
}

export {}
