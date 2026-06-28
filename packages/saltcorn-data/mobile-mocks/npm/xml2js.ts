// Mobile mock for "xml2js". Stub satisfies the ESM named import in the bundled
// @saltcorn/data; XML parsing is unused in a mobile environment.
export const parseStringPromise = async (
  _xml?: any,
  _options?: any
): Promise<any> => ({});
