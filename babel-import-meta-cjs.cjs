"use strict";

/**
 * Babel plugin used only by the jest test harnesses.
 *
 * The `@saltcorn/db-common` package is published as native ESM, but the
 * consuming packages run their tests with ts-jest in CommonJS mode. jest's
 * module loader cannot `require()` an ESM module, so we transform db-common's
 * compiled `dist/*.js` to CommonJS with @babel/plugin-transform-modules-commonjs.
 * That plugin does not understand `import.meta`, so this plugin rewrites the
 * `import.meta.*` references db-common uses to their CommonJS equivalents.
 */
module.exports = function ({ types: t, template }) {
  const urlReplacement = template.expression(
    "require('url').pathToFileURL(__filename).href"
  );
  return {
    name: "import-meta-to-cjs",
    visitor: {
      MemberExpression(path) {
        const obj = path.node.object;
        if (
          t.isMetaProperty(obj) &&
          obj.meta.name === "import" &&
          obj.property.name === "meta" &&
          t.isIdentifier(path.node.property)
        ) {
          switch (path.node.property.name) {
            case "dirname":
              path.replaceWith(t.identifier("__dirname"));
              break;
            case "filename":
              path.replaceWith(t.identifier("__filename"));
              break;
            case "url":
              path.replaceWith(urlReplacement());
              break;
          }
        }
      },
    },
  };
};
