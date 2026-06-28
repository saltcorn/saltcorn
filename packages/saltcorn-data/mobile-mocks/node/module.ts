// Mobile mock for node's "module". The bundled @saltcorn/data does
// `const require = createRequire(import.meta.url)` and then `require("./x.js")`.
// webpack statically rewrites those literal require(...) calls into bundled
// module lookups, so the function returned here is only a safety net for any
// genuinely dynamic require, which is unsupported in a mobile bundle.
export const createRequire = (_url?: any) => {
  return (id: string): any => {
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
