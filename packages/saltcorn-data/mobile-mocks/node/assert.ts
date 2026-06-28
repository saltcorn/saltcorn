// Mobile mock for node's "assert". Stubs satisfy ESM named/default imports in
// the bundled @saltcorn/data; assertions are no-ops in a mobile environment.
export const ok = (_value?: any, _message?: any): void => {};
export const strictEqual = (_a?: any, _b?: any, _message?: any): void => {};
export const strict: any = (_value?: any, _message?: any): void => {};
strict.ok = ok;
strict.strictEqual = strictEqual;
