// Mobile mock for node's "module". The bundled @saltcorn/data does
// `const require = createRequire(import.meta.url)` and then `require("./x.js")`.
// webpack statically rewrites those literal require(...) calls into bundled
// module lookups, so the function returned here is only a safety net for any
// genuinely dynamic require, which is unsupported in a mobile bundle.
// utils.ts lazily pulls db/index and db/state via `createRequire`'s require to
// avoid a load-time cycle on Node. webpack can't statically rewrite those calls,
// so resolve them through a lazy webpack context over the db/ directory. This
// mock is bundled as CommonJS, so `require.context` (sync) is available: modules
// are bundled but only evaluated when first requested, preserving the lazy
// semantics — by the time these run on mobile all modules are loaded.
// @ts-ignore - require.context is a webpack-only API
const dbContext = require.context("../../db", true, /\.js$/);

export const createRequire = (_url?: any) => {
  return (id: string): any => {
    // A few @saltcorn/data constructors read the package version via
    // `require(".../package.json").version`. webpack can't statically rewrite
    // those createRequire calls (they sit inside class bodies), so answer them
    // here with a benign stub — the exact version is not needed on mobile.
    if (/package\.json$/.test(id)) return { version: "" };
    // Internal db/* modules (e.g. "./db/state.js", "./db/index.js").
    const dbMatch = id.match(/(?:^|\/)db\/(.+)$/);
    if (dbMatch) {
      try {
        return dbContext(`./${dbMatch[1]}`);
      } catch (e) {
        // fall through to the error below
      }
    }
    throw new Error(
      `dynamic require of "${id}" is not supported in a mobile bundle`
    );
  };
};

// Some dependencies (prettier, via mjml) import { builtinModules } from "module".
export const builtinModules: string[] = [];

// `import modulePkg from "module"` accesses things like stripTypeScriptTypes on
// node-only code paths; expose a stub default so the property access is defined.
export default {
  createRequire,
  builtinModules,
  stripTypeScriptTypes: undefined as any,
};
