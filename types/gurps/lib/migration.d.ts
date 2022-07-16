export class Migration {
  static migrateTo096(quiet?: boolean): Promise<void>
  /**
   * @param {boolean | undefined} [quiet]
   */
  static migrateTo097(quiet?: boolean | undefined): Promise<void>
  /**
   * @param {boolean | undefined} [quiet]
   */
  static migrateTo0104(quiet?: boolean | undefined): Promise<void>
  /**
   * @param {boolean} quiet
   */
  static migrateToManeuvers(quiet: boolean): Promise<void>
  static fixDataModelProblems(quiet: any): Promise<void>
}
