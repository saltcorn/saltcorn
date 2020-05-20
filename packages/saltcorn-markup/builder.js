const { p, div, i, label, text, button, a, span, script } = require("./tags");
const { contract, is } = require("contractis");

module.exports = s =>
  div(
    script({ src: "/builder_bundle.js" }),
    div({ id: "saltcorn-builder" }),
    script(`
    builder.renderBuilder("saltcorn-builder")
    `)
  );
