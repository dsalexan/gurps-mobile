import type { ActorDataConstructorData } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/data.mjs/actorData.js"
import type { MergeObjectOptions } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/utils/helpers.mjs.js"

import type GurpsToken from "../token"

export namespace MoveModes {
  const Ground: string
  const Air: string
  const Water: string
  const Space: string
}

export class GurpsActor extends Actor {
  static addTrackerToDataObject(
    data: any,
    trackerData: any,
  ): {
    [key: string]: string
  }
  static getTrackersAsArray(data: any): any[]
  /** @override */
  override getRollData(): any
  /**
   * @returns {GurpsActor}
   */
  asGurpsActor(): GurpsActor
  /**
   * @returns {GurpsActorData}
   */
  getGurpsActorData(): any
  getOwners(): any
  /**
   * @param {Application} newSheet
   */
  openSheet(newSheet: any): Promise<void>
  _sheet: any
  ignoreRender: any
  prepareData(): void
  prepareBaseData(): void
  prepareEmbeddedEntities(): void
  prepareDerivedData(): void
  postImport(): Promise<void>
  syncLanguages(): Promise<void>
  calculateDerivedValues(): void
  _initializeStartingValues(): void
  _applyItemBonuses(): void
  /**
   * @param {string} key
   * @param {any} id
   * @returns {string | undefined}
   */
  _findEqtkeyForId(key: string, id: any): string | undefined
  /**
   * @param {{ [key: string]: any }} dict
   * @param {string} type
   * @returns {number}
   */
  _sumeqt(
    dict: {
      [key: string]: any
    },
    type: string,
    checkEquipped?: boolean,
  ): number
  _calculateWeights(): void
  _calculateEncumbranceIssues(): void
  _isEnhancedMove(): boolean
  _getSprintMove(): any
  _getCurrentMoveMode(): any
  /**
   * @param {number} move
   * @param {number} threshold
   * @returns {number}
   */
  _getCurrentMove(move: number, threshold: number): number
  _getMoveAdjustedForManeuver(
    move: any,
    threshold: any,
  ): {
    move: number
    text: any
  }
  _adjustMove(
    move: any,
    threshold: any,
    value: any,
    reason: any,
  ): {
    move: number
    text: any
  }
  _getMoveAdjustedForPosture(
    move: any,
    threshold: any,
  ): {
    move: number
    text: any
  }
  _calculateRangedRanges(): void
  _recalcItemFeatures(): void
  /**
   * @param {Object} list
   */
  _collapseQuantumEq(list: any, isMelee?: boolean): void
  _getStep(): number
  /**
   * For every application associated to this actor, refresh it to reflect any updates.
   */
  _renderAllApps(): void
  /**
   * Update this Document using incremental data, saving it to the database.
   * @see {@link Document.updateDocuments}
   * @param {any} data - Differential update data which modifies the existing values of this document data
   *                     (default: `{}`)
   * @param {any} [context] - Additional context which customizes the update workflow (default: `{}`)
   * @returns {Promise<this | undefined>} The updated Document instance
   * @remarks If no document has actually been updated, the returned {@link Promise} resolves to `undefined`.
   */
  update(
    data?: DeepPartial<ActorDataConstructorData | (ActorDataConstructorData & Record<string, unknown>)> | undefined,
    context?: (DocumentModificationContext & MergeObjectOptions) | undefined,
  ): Promise<this | undefined>
  sendChatMessage(msg: any): void
  internalUpdate(data: any, context: any): Promise<void>
  /**
   * This method is called when "data.conditions.maneuver" changes on the actor (via the update method)
   * @param {string} maneuverText
   */
  replaceManeuver(maneuverText: string): Promise<void>
  replacePosture(changeData: any): Promise<void>
  /**
   * @returns {GurpsToken[]}
   */
  _findTokens(): GurpsToken[]
  /**
   * @param {{ id: unknown; }} effect
   */
  isEffectActive(effect: { id: unknown }): boolean
  get _additionalResources(): any
  get displayname(): any
  /**
   *
   * @param {Object} action
   * @param {string} action.orig - the original OTF string
   * @param {string} action.costs - "*(per|cost) ${number} ${resource}" -- resource can be '@resource' to prompt user
   * @param {string} action.formula - the basic die formula, such as '2d', '1d-2', '3d-1x2', etc.
   * @param {string} action.damagetype - one of the recognized damage types (cr, cut, imp, etc)
   * @param {string} action.extdamagetype - optional extra damage type, such as 'ex'
   * @param {string} action.hitlocation - optional hit location
   * @param {boolean} action.accumulate
   */
  accumulateDamageRoll(action: { orig: string; costs: string; formula: string; damagetype: string; extdamagetype: string; hitlocation: string; accumulate: boolean }): Promise<void>
  get damageAccumulators(): any
  incrementDamageAccumulator(index: any): Promise<void>
  decrementDamageAccumulator(index: any): Promise<void>
  clearDamageAccumulator(index: any): Promise<void>
  applyDamageAccumulator(index: any): Promise<void>
  importCharacter(): Promise<void>
  _openImportDialog(): Promise<void>
  _openNonLocallyHostedImportDialog(): Promise<void>
  _openLocallyHostedImportDialog(): Promise<void>
  /**
   *
   * @param {{ [key: string]: any}} json
   */
  importAttributesFromGCSv2(atts: any, eqp: any, calc: any): Promise<GCS.V2.Partial.Attritubes>
  calcTotalCarried(eqp: any): number
  importTraitsFromGCSv2(p: any, cd: any, md: any): Promise<GCS.V2.Partial.Traits>
  getPortraitPath(): string
  signedNum(x: any): any
  // importSizeFromGCSv1(
  //   commit: any,
  //   profile: any,
  //   ads: any,
  //   skills: any,
  //   equipment: any,
  // ): {
  //   `data.-=traits`: any
  //   `data.traits`: any
  // }
  // importAdsFromGCSv3(ads: any): {
  //   `data.-=ads`: any
  //   `data.ads`: {}
  // }
  // importAd(i: any, p: any): any
  // importSkillsFromGCSv2(sks: any): {
  //   `data.-=skills`: any
  //   `data.skills`: {}
  // }
  // importSk(i: any, p: any): any
  // importSpellsFromGCSv2(sps: any): {
  //   `data.-=spells`: any
  //   `data.spells`: {}
  // }
  // importSp(i: any, p: any): any
  // importEquipmentFromGCSv2(
  //   eq: any,
  //   oeq: any,
  // ): {
  //   `data.-=equipment`: any
  //   `data.equipment`: {
  //     carried: {}
  //     other: {}
  //   }
  // }
  // importEq(i: any, p: any, carried: any): any
  // importNotesFromGCSv2(notes: any): {
  //   `data.-=notes`: any
  //   `data.notes`: {}
  // }
  // importNote(i: any, p: any): any
  // importProtectionFromGCSv2(hls: any): Promise<GCS.V2.Partial.Protection | {}>
  // importPointTotalsFromGCSv2(total: any, atts: any, ads: any, skills: any, spells: any): GCS.V2.Partial.PointTotals
  // importReactionsFromGCSv3(ads: any, skills: any, equipment: any): GCS.V2.Partial.Reactions
  // importCombatFromGCSv2(ads: any, skills: any, spells: any, equipment: any): GCS.V2.Partial.Combat
  // recursiveGet(i: any): any
  // adPointCount(i: any, ads: any, disads: any, quirks: any, race: any): any[]
  // skPointCount(i: any, skills: any): any
  // /**
  //  * @param {string} json
  //  * @param {string} importname
  //  * @param {string | undefined} [importpath]
  //  */
  // importFromGCSv2(json: string, importname: string, importpath?: string | undefined, suppressMessage: boolean, GCAVersion: any, GCSVersion: any): Promise<boolean>
  // /**
  //  * @param {string} xml
  //  * @param {string} importname
  //  * @param {string | undefined} [importpath]
  //  */
  // importFromGCSv1(xml: string, importname: string, importpath?: string | undefined, suppressMessage?: boolean): Promise<boolean>
  // /**
  //  * @param {{ [key: string]: any }} o
  //  */
  // textFrom(o: { [key: string]: any }): any
  // /**
  //  * @param {{ [key: string]: any }} o
  //  */
  // intFrom(o: { [key: string]: any }): number
  // /**
  //  * @param {{[key: string] : any}} o
  //  */
  // floatFrom(o: { [key: string]: any }): number
  // /**
  //  * @param {string} list
  //  * @param {string|boolean} uuid
  //  */
  // _findElementIn(list: string, uuid: string | boolean, name?: string, mode?: string): any
  // /**
  //  * @param {{ [key: string]: any }} json
  //  */
  // importReactionsFromGCSv2(json: { [key: string]: any }): {
  //   `data.-=reactions`: any
  //   `data.reactions`: {}
  // }
  // importConditionalModifiersFromGCSv2(json: any): {
  //   `data.-=conditionalmods`: any
  //   `data.conditionalmods`: {}
  // }
  // /**
  //  * @param {{ [key: string]: any }} json
  //  */
  // importReactionsFromGCA(
  //   json: {
  //     [key: string]: any
  //   },
  //   vernum: any,
  // ): {
  //   `data.-=reactions`: any
  //   `data.reactions`: {}
  // }
  // importLangFromGCA(json: any): {
  //   `data.-=languages`: any
  //   `data.languages`: {}
  // }
  // /**
  //  * @param {{ attributes: Record<string, any>; ads: Record<string, any>; disads: Record<string, any>; quirks: Record<string, any>; skills: Record<string, any>; spells: Record<string, any>; unspentpoints: Record<string, any>; totalpoints: Record<string, any>; race: Record<string, any>; }} json
  //  */
  // importPointTotalsFromGCSv1(json: {
  //   attributes: Record<string, any>
  //   ads: Record<string, any>
  //   disads: Record<string, any>
  //   quirks: Record<string, any>
  //   skills: Record<string, any>
  //   spells: Record<string, any>
  //   unspentpoints: Record<string, any>
  //   totalpoints: Record<string, any>
  //   race: Record<string, any>
  // }): {
  //   `data.totalpoints.attributes`: number
  //   `data.totalpoints.ads`: number
  //   `data.totalpoints.disads`: number
  //   `data.totalpoints.quirks`: number
  //   `data.totalpoints.skills`: number
  //   `data.totalpoints.spells`: number
  //   `data.totalpoints.unspent`: number
  //   `data.totalpoints.total`: number
  //   `data.totalpoints.race`: number
  // }
  // /**
  //  * @param {{ [key: string]: any }} descjson
  //  * @param {{ [key: string]: any }} json
  //  */
  // importNotesFromGCSv1(
  //   descjson: {
  //     [key: string]: any
  //   },
  //   json: {
  //     [key: string]: any
  //   },
  // ): {
  //   `data.-=notes`: any
  //   `data.notes`: {}
  // }
  // /**
  //  * @param {{ [x: string]: any; bodyplan: Record<string, any>; }} json
  //  * @param {boolean} isFoundryGCA
  //  */
  // importProtectionFromGCSv1(
  //   json: {
  //     [x: string]: any
  //     bodyplan: Record<string, any>
  //   },
  //   isFoundryGCA: boolean,
  // ): Promise<GCS.V2.Partial.Protection | {}>
  // /**
  //  *
  //  * @param {Array<HitLocations.HitLocation>} locations
  //  */
  // _getBodyPlan(locations: Array<HitLocations.HitLocation>): string
  // /**
  //  * @param {{ [key: string]: any }} json
  //  * @param {boolean} isFoundryGCS
  //  */
  // importEquipmentFromGCSv1(
  //   json: {
  //     [key: string]: any
  //   },
  //   isFoundryGCS: boolean,
  // ): {
  //   `data.-=equipment`: any
  //   `data.equipment`: {
  //     carried: {}
  //     other: {}
  //   }
  // }
  // /**
  //  * @param {any[]} flat
  //  */
  // foldList(flat: any[], target?: {}): {}
  // /**
  //  * @param {{ [x: string]: Record<string, any>; }} json
  //  */
  // importEncumbranceFromGCSv1(json: { [x: string]: Record<string, any> }): {
  //   `data.currentmove`: number
  //   `data.currentdodge`: number
  //   `data.-=encumbrance`: any
  //   `data.encumbrance`: {}
  // }
  // /**
  //  * Copy old OTFs to the new object, and update the displayable notes
  //  * @param {Skill|Spell|Ranged|Melee} oldobj
  //  * @param {Skill|Spell|Ranged|Melee} newobj
  //  */
  // _migrateOtfsAndNotes(oldobj: Skill | Spell | Ranged | Melee, newobj: Skill | Spell | Ranged | Melee, importvttnotes?: string): void
  // /**
  //  *  Search for specific format OTF in the notes (and vttnotes).
  //  *  If we find it in the notes, remove it and replace the notes with the shorter version
  //  */
  // _updateOtf(otfkey: any, oldobj: any, newobj: any): void
  // _removeOtf(key: any, text: any): any[]
  // /**
  //  * @param {{ [key: string]: any }} json
  //  * @param {boolean} isFoundryGCS
  //  */
  // importCombatMeleeFromGCSv1(
  //   json: {
  //     [key: string]: any
  //   },
  //   isFoundryGCS: boolean,
  // ): {
  //   `data.-=melee`: any
  //   `data.melee`: {}
  // }
  // /**
  //  * @param {{ [key: string]: any }} json
  //  * @param {boolean} isFoundryGCS
  //  */
  // importCombatRangedFromGCSv1(
  //   json: {
  //     [key: string]: any
  //   },
  //   isFoundryGCS: boolean,
  // ): {
  //   `data.-=ranged`: any
  //   `data.ranged`: {}
  // }
  // /**
  //  * @param {{ race: Record<string, any>; height: Record<string, any>; weight: Record<string, any>; age: Record<string, any>; title: Record<string, any>; player: Record<string, any>; createdon: Record<string, any>; modifiedon: Record<string, any>; religion: Record<string, any>; birthday: Record<string, any>; hand: Record<string, any>; sizemodifier: Record<string, any>; tl: Record<string, any>; appearance: Record<string, any>; }} json
  //  */
  // importTraitsfromGCSv1(json: {
  //   race: Record<string, any>
  //   height: Record<string, any>
  //   weight: Record<string, any>
  //   age: Record<string, any>
  //   title: Record<string, any>
  //   player: Record<string, any>
  //   createdon: Record<string, any>
  //   modifiedon: Record<string, any>
  //   religion: Record<string, any>
  //   birthday: Record<string, any>
  //   hand: Record<string, any>
  //   sizemodifier: Record<string, any>
  //   tl: Record<string, any>
  //   appearance: Record<string, any>
  // }): {
  //   `data.-=traits`: any
  //   `data.traits`: {
  //     race: any
  //     height: any
  //     weight: any
  //     age: any
  //     title: any
  //     player: any
  //     createdon: any
  //     modifiedon: any
  //     religion: any
  //     birthday: any
  //     hand: any
  //     sizemod: any
  //     techlevel: any
  //     appearance: any
  //     gender: any
  //     eyes: any
  //     hair: any
  //     skin: any
  //   }
  // }
  // /**
  //  * @param {{ [key: string]: any }} json
  //  */
  // importAttributesFromCGSv1(json: { [key: string]: any }): Promise<{
  //   `data.attributes`: any
  //   `data.HP`: any
  //   `data.FP`: any
  //   `data.basiclift`: any
  //   `data.basicmove`: any
  //   `data.basicspeed`: any
  //   `data.thrust`: any
  //   `data.swing`: any
  //   `data.currentmove`: any
  //   `data.frightcheck`: any
  //   `data.hearing`: any
  //   `data.tastesmell`: any
  //   `data.touch`: any
  //   `data.vision`: any
  //   `data.liftingmoving`: {
  //     basiclift: any
  //     carryonback: any
  //     onehandedlift: any
  //     runningshove: any
  //     shiftslightly: any
  //     shove: any
  //     twohandedlift: any
  //   }
  // }>
  // /**
  //  * @param {{ [key: string]: any }} json
  //  * @param {boolean} isFoundryGCS
  //  */
  // importSkillsFromGCSv1(
  //   json: {
  //     [key: string]: any
  //   },
  //   isFoundryGCS: boolean,
  // ): {
  //   `data.-=skills`: any
  //   `data.skills`: {}
  // }
  // /**
  //  * @param {{ [key: string]: any }} json
  //  * @param {boolean} isFoundryGCS
  //  */
  // importSpellsFromGCSv1(
  //   json: {
  //     [key: string]: any
  //   },
  //   isFoundryGCS: boolean,
  // ): {
  //   `data.-=spells`: any
  //   `data.spells`: {}
  // }
  // /**
  //  * @param {{ [key: string]: any }} adsjson
  //  * @param {{ [key: string]: any }} disadsjson
  //  */
  // importAdsFromGCA(
  //   adsjson: {
  //     [key: string]: any
  //   },
  //   disadsjson: {
  //     [key: string]: any
  //   },
  // ): {
  //   `data.-=ads`: any
  //   `data.ads`: {}
  // }
  // /**
  //  * @param {Advantage[]} datalist
  //  * @param {{ [key: string]: any }} json
  //  */
  // importBaseAdvantages(
  //   datalist: Advantage[],
  //   json: {
  //     [key: string]: any
  //   },
  // ): void
  // /**
  //  * @param {{ [key: string]: any }} json
  //  */
  // importAdsFromGCSv2(json: { [key: string]: any }): {
  //   `data.-=ads`: any
  //   `data.ads`: {}
  // }
  // /**
  //  * Adds any assigned resource trackers to the actor data and sheet.
  //  */
  // setResourceTrackers(): Promise<void>
  // /**
  //  * Update this tracker slot with the contents of the template.
  //  * @param {String} path JSON data path to the tracker; must start with 'additionalresources.tracker.'
  //  * @param {*} template to apply
  //  */
  // applyTrackerTemplate(path: string, template: any): Promise<void>
  // /**
  //  * Overwrites the tracker pointed to by the path with default/blank values.
  //  * @param {String} path JSON data path to the tracker; must start with 'additionalresources.tracker.'
  //  */
  // clearTracker(path: string): Promise<void>
  // /**
  //  * Removes the indicated tracker from the object, reindexing the keys.
  //  * @param {String} path JSON data path to the tracker; must start with 'additionalresources.tracker.'
  //  */
  // removeTracker(path: string): Promise<void>
  // addTracker(): Promise<void>
  // setMoveDefault(value: any): Promise<void>
  // /**
  //  * @param {any[]} damageData
  //  */
  // handleDamageDrop(damageData: any[]): void
  // /**
  //  * @param {{ type: any; x?: number; y?: number; payload?: any; pack?: any; id?: any; data?: any; }} dragData
  //  */
  // handleItemDrop(dragData: { type: any; x?: number; y?: number; payload?: any; pack?: any; id?: any; data?: any }): Promise<void>
  // _forceRender(): void
  // /**
  //  * @param {{ type?: string; x?: number; y?: number; payload?: any; actorid?: any; itemid?: any; isLinked?: any; key?: any; itemData?: any; }} dragData
  //  */
  // handleEquipmentDrop(dragData: { type?: string; x?: number; y?: number; payload?: any; actorid?: any; itemid?: any; isLinked?: any; key?: any; itemData?: any }): Promise<boolean>
  // /**
  //  * @param {Item} item
  //  */
  // updateItem(item: any): Promise<void>
  // /**
  //  * @param {ItemData} itemData
  //  * @param {string | null} [targetkey]
  //  */
  // addNewItemData(itemData: any, targetkey?: string | null): Promise<void>
  // /**
  //  * @param {ItemData} itemData
  //  * @param {string | null} [targetkey]
  //  */
  // addItemData(itemData: any, targetkey?: string | null): Promise<void>
  // /**
  //  * @param {ItemData} itemData
  //  * @param {string | null} targetkey
  //  */
  // _addNewItemEquipment(itemData: any, targetkey: string | null): Promise<any[]>
  // /**
  //  * @param {GurpsItemData} itemData
  //  * @param {string} eqtkey
  //  */
  // _addItemAdditions(itemData: any, eqtkey: string): Promise<void>
  // /**
  //  * @param {Equipment} eqt
  //  * @param {string} targetPath
  //  */
  // updateItemAdditionsBasedOn(eqt: Equipment, targetPath: string): Promise<void>
  // /**
  //  * @param {Equipment} eqt
  //  * @param {string} eqtkey
  //  * @param {boolean} carried
  //  */
  // _updateEqtStatus(eqt: Equipment, eqtkey: string, carried: boolean): Promise<void>
  // /**
  //  * @param {ItemData} itemData
  //  * @param {string} eqtkey
  //  * @param {string} key
  //  */
  // _addItemElement(
  //   itemData: any,
  //   eqtkey: string,
  //   key: string,
  // ): Promise<{
  //   [x: string]: any
  // }>
  // /**
  //  * @param {string} path
  //  */
  // deleteEquipment(path: string, depth?: number): Promise<any>
  // /**
  //  * @param {string} itemid
  //  */
  // _removeItemAdditions(itemid: string): Promise<void>
  // /**
  //  * @param {string} itemid
  //  * @param {string} key
  //  */
  // _removeItemElement(itemid: string, key: string): Promise<boolean>
  // /**
  //  * @param {string} srckey
  //  * @param {string} targetkey
  //  * @param {boolean} shiftkey
  //  */
  // moveEquipment(srckey: string, targetkey: string, shiftkey: boolean): Promise<void>
  // /**
  //  * @param {string} path
  //  */
  // toggleExpand(path: string, expandOnly?: boolean): Promise<void>
  // /**
  //  * @param {string} srckey
  //  * @param {string} targetkey
  //  */
  // _splitEquipment(srckey: string, targetkey: string): Promise<boolean>
  // /**
  //  * @param {string} srckey
  //  * @param {string} targetkey
  //  */
  // _checkForMerging(srckey: string, targetkey: string): Promise<boolean>
  // get hitLocationsWithDR(): HitLocationEntry[]
  // /**
  //  * @returns the appropriate hitlocation table based on the actor's bodyplan
  //  */
  // get _hitLocationRolls(): any
  // get defaultHitLocation(): any
  // getCurrentDodge(): any
  // getCurrentMove(): any
  // getTorsoDr(): any
  // /**
  //  * @param {string} key
  //  */
  // getEquipped(key: string): (string | number)[]
  // getEquippedParry(): string | number
  // getEquippedBlock(): string | number
  // /**
  //  *
  //  * @param {string} name of the status effect
  //  * @param {boolean} active (desired) state - true or false
  //  */
  // toggleEffectByName(name: string, active: boolean): void
  // /**
  //  * @param {string} pattern
  //  */
  // findEquipmentByName(pattern: string, otherFirst?: boolean): any[]
  // /**
  //  * @param {number} currentWeight
  //  */
  // checkEncumbance(currentWeight: number): void
  // /**
  //  * @param {string} eqtkey
  //  * @param {number} count
  //  */
  // updateEqtCount(eqtkey: string, count: number): Promise<void>
  // /**
  //  * @param {string} srckey
  //  */
  // updateParentOf(srckey: string, updatePuuid?: boolean): Promise<void>
  // isEmptyActor(): boolean
}
