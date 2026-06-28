// Mobile mock for migrate. Schema migrations are server-only and never run in
// the mobile bundle; stub the named exports (webpack statically validates ESM
// named imports) as runtime-safe no-ops.

export const migrate = async (
  _schema0?: string,
  _verbose?: boolean
): Promise<void> => {};

export const create_blank_migration = async (): Promise<void> => {};

export const getMigrationsInDB = async (): Promise<any[]> => [];
