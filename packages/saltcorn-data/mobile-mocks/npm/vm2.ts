// Mobile mock for "vm2". Stub satisfies the ESM named import in the bundled
// @saltcorn/data; sandboxed VM execution is unavailable in a mobile environment.
export class VM {
  constructor(_options?: any) {}
  run(_code?: any, _filename?: any): any {
    throw new Error("vm2 may not be used in a mobile enviroment");
  }
}
