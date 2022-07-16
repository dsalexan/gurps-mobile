/* eslint-disable @typescript-eslint/ban-types */
/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class GurpsActorSheet extends ActorSheet {
  /** @override */
  static override get defaultOptions(): any
  /** @override */
  override get template(): string
  close(options?: {}): Promise<void>
  _render(...args: any[]): Promise<void>
  update(data: any, options: any): void
  /** @override */
  override getData(): any
  /**
   * @inheritdoc
   * @param {JQuery<HTMLElement>} html
   */
  activateListeners(html: any): void
  _createHeaderMenus(html: any): void
  _createEquipmentItemMenus(html: any): void
  _editEquipment(target: any): void
  _createMenu(
    label: any,
    icon: any,
    callback: any,
    condition?: () => boolean,
  ): {
    name: any
    icon: any
    callback: any
    condition: () => boolean
  }
  _deleteItem(target: any): void
  _sortContentAscending(target: any): void
  _sortContent(parentpath: any, objkey: any, reverse: any): Promise<void>
  _sortContentDescending(target: any): void
  _moveEquipment(list: any, target: any): void
  _hasContents(target: any): boolean
  /**
   *
   * @param {*} target
   * @returns true if the object is a container ... ie, it has a non-empty contains collection
   */
  _isSortable(includeCollapsed: any, target: any): boolean
  getMenuItems(elementid: any): any
  addItemMenu(
    name: any,
    obj: any,
    path: any,
  ): {
    name: any
    icon: string
    callback: (e: any) => void
  }
  makelistdrag(html: any, cls: any, type: any): void
  _addNote(event: any): Promise<void>
  _addTracker(event: any): Promise<void>
  handleDblclickeditDrop(ev: any): void
  handleQnoteDrop(ev: any): void
  dropFoundryLinks(ev: any, modelkey: any): void
  /**
   *
   * @param {*} ev
   */
  editTracker(ev: any): Promise<void>
  _showActiveEffectsListPopup(ev: any): Promise<void>
  _showMoveModeEditorPopup(ev: any): Promise<void>
  editEquipment(actor: any, path: any, obj: any): Promise<void>
  editMelee(actor: any, path: any, obj: any): Promise<void>
  editRanged(actor: any, path: any, obj: any): Promise<void>
  editAds(actor: any, path: any, obj: any): Promise<void>
  editSkills(actor: any, path: any, obj: any): Promise<void>
  editSpells(actor: any, path: any, obj: any): Promise<void>
  editNotes(actor: any, path: any, obj: any): Promise<void>
  editItem(actor: any, path: any, obj: any, html: any, title: any, strprops: any, numprops: any, width?: number): Promise<void>
  _makeHeaderMenu(html: any, cssclass: any, menuitems: any, eventname?: string): void
  sortAscendingMenu(key: any): {
    name: any
    icon: string
    callback: (e: any) => Promise<void>
  }
  sortDescendingMenu(key: any): {
    name: any
    icon: string
    callback: (e: any) => Promise<void>
  }
  sortAscending(key: any): Promise<void>
  sortDescending(key: any): Promise<void>
  /** @override */
  override _onDrop(event: any): Promise<void>
  handleDragFor(event: any, dragData: any, type: any, cls: any): Promise<void>
  _insertBeforeKey(targetKey: any, element: any): Promise<void>
  _removeKey(sourceKey: any): Promise<void>
  _onfocus(ev: any): void
  /** @override */
  override setPosition(options?: {}): any
  get title(): any
  _getHeaderButtons(): any
  /**
   * Override this to change the buttons appended to the actor sheet title bar.
   */
  getCustomHeaderButtons(): {
    label: any
    class: string
    icon: string
    onclick: (ev: any) => Promise<void>
  }[]
  _onFileImport(event: any): Promise<void>
  _onToggleSheet(event: any, altsheet: any): Promise<void>
  _onOpenEditor(event: any): Promise<void>
  _onRightClickGurpslink(event: any): Promise<void>
  _onRightClickPdf(event: any): Promise<void>
  _onRightClickGmod(event: any): Promise<void>
  _onRightClickOtf(event: any): Promise<void>
  _onClickRoll(event: any, targets: any): Promise<void>
  _onClickSplit(event: any): Promise<void>
  _onNavigate(event: any): Promise<void>
  _onClickEnc(ev: any): Promise<void>
  _onClickEquip(ev: any): Promise<void>
  deleteItemMenu(obj: any): {
    name: string
    icon: string
    callback: (e: any) => void
  }[]
  /** @override */
  override _updateObject(event: any, formData: any): any
}
export class GurpsActorTabSheet extends GurpsActorSheet {}
export class GurpsActorCombatSheet extends GurpsActorSheet {}
export class GurpsActorEditorSheet extends GurpsActorSheet {
  makeDeleteMenu(html: any, cssclass: any, obj: any, eventname?: string): void
  makeHeaderMenu(html: any, cssclass: any, name: any, obj: any, path: any, eventname?: string): void
  _onClickIgnoreImportBodyPlan(ev: any): Promise<void>
  _onClickShowFlightMove(ev: any): Promise<void>
}
export class GurpsActorSimplifiedSheet extends GurpsActorSheet {
  _onClickRollableIcon(ev: any): Promise<void>
}
export class GurpsActorNpcSheet extends GurpsActorSheet {
  _onClickRollableIcon(ev: any): Promise<void>
}
export class GurpsInventorySheet extends GurpsActorSheet {}
