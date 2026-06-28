// Mobile mock for plugin-testing. These are admin-side view validation/test
// helpers, never invoked while rendering views on mobile. Stub the named exports
// (webpack statically validates ESM named imports) with runtime-safe no-ops.

export const generate_attributes = (
  _typeattrs?: any,
  _validate?: any,
  _table_id?: number
): Record<string, any> => ({});

export const check_view_columns = async (
  _view?: any,
  _columns?: any
): Promise<any> => ({ errors: [], warnings: [] });
