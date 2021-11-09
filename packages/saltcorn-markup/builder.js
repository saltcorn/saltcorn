/**
 * @category saltcorn-markup
 * @module builder
 */

const {
  p,
  div,
  i,
  label,
  text,
  button,
  a,
  h4,
  span,
  script,
  style,
  input,
  link,
  form,
} = require("./tags");
const { contract, is } = require("contractis");

/**
 * @param {object} rec 
 * @param {object} csrf 
 * @returns {object}
 */
const addCsrf = (rec, csrf) => {
  rec.csrfToken = csrf;
  return rec;
};

/**
 * @param {object} x 
 * @returns {string}
 */
const encode = (x) => encodeURIComponent(JSON.stringify(x));

module.exports = 
/**
 * @param {object} opts
 * @param {object} opts.options
 * @param {object} opts.context
 * @param {object} opts.action
 * @param {string} opts.stepName
 * @param {object} opts.layout
 * @param {string} [opts.mode = "show"]
 * @param {object} opts
 * @param {object} csrfToken 
 * @returns {div}
 */
(
  { options, context, action, stepName, layout, mode = "show", version_tag },
  csrfToken
) =>
  div(
    script({
      src: version_tag
        ? `/static_assets/${version_tag}/builder_bundle.js`
        : "/builder_bundle.js",
    }),
    link({
      rel: "stylesheet",
      type: "text/css",
      media: "screen",
      href: version_tag
        ? `/static_assets/${version_tag}/fonticonpicker.react.css`
        : "/fonticonpicker.react.css",
    }),
    link({
      rel: "stylesheet",
      type: "text/css",
      media: "screen",
      href: version_tag
        ? `/static_assets/${version_tag}/saltcorn-builder.css`
        : "/saltcorn-builder.css",
    }),
    div({ id: "saltcorn-builder" }),
    form(
      { action, method: "post", id: "scbuildform" },
      input({
        type: "hidden",
        name: "contextEnc",
        value: encodeURIComponent(JSON.stringify(context)),
      }),
      input({ type: "hidden", name: "stepName", value: stepName }),
      input({ type: "hidden", name: "columns", value: "" }),
      input({ type: "hidden", name: "layout", value: "" }),
      input({ type: "hidden", name: "_csrf", value: csrfToken })
    ),
    script(`builder.renderBuilder(
      "saltcorn-builder", 
      "${encode(addCsrf(options, csrfToken))}", 
      "${encode(layout || {})}",
      ${JSON.stringify(mode)}
    );
    document.addEventListener('DOMContentLoaded',
      function(){window.onerror=globalErrorCatcher},false);
    ;`)
  );
