// CommonJS compatibility shim — DO NOT EDIT.
//
// This package is ESM ("type": "module"), but its `layout` module's default export
// is a bare function. Node's require() of an ESM module returns the namespace
// ({ default: fn }), not the function, which would break out-of-tree CommonJS
// plugins doing `const layout = require("@saltcorn/markup/layout")` and calling it.
//
// The package's "exports" map routes the "require" condition here so such
// consumers keep getting the callable, while "import" serves the ESM build.
module.exports = require("../dist/layout.js").default;
