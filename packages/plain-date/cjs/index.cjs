// CommonJS compatibility shim — DO NOT EDIT.
//
// This package is ESM ("type": "module"), but its default export is a bare
// class. Node's require() of an ESM module returns the namespace
// ({ default: PlainDate }), not the class, which would break CommonJS
// consumers doing `const PlainDate = require("@saltcorn/plain-date")` and
// calling `new PlainDate(...)`.
//
// The package's "exports" map routes the "require" condition here so such
// consumers keep getting the callable, while "import" serves the ESM build.
module.exports = require("../dist/index.js").default;
