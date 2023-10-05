/**
 * @category server
 * @module markup/expression_blurb
 * @subcategory markup
 */

const { p, code, li, ul, pre } = require("@saltcorn/markup/tags");
const { contract, is } = require("contractis");
const { getState } = require("@saltcorn/data/db/state");

/**
 * @param {*} type
 * @returns {*}
 */
const toJsType = (type) =>
  ({
    Integer: "number",
    Float: "number",
    Bool: "boolean",
    Date: "Date class",
    String: "string",
    Color: "string",
  }[type] || type);

/**
 * @param {string} type
 * @param {*} stored
 * @param {Table} table
 * @param {object} req
 * @returns {p[]}
 */
const expressionBlurb = (type, stored, table, req) => {
  const allFields = table.fields;
  const fields = allFields.filter((f) => !f.calculated);
  const funs = getState().functions;
  const funNames = Object.entries(funs)
    .filter(([k, v]) => !(!stored && v.isAsync))
    .map(([k, v]) => k);
  const examples = table.getFormulaExamples(type);
  return [
    p(
      req.__(
        "Please enter the formula for the new field as a JavaScript expression. The expression must result in a %s type",
        `<strong>${toJsType(type)}</strong>`
      )
    ),
    p(
      req.__(`Fields you can use as variables: `),
      fields.map((f) => code(f.name)).join(", ")
    ),
    funNames.length > 0
      ? p(
          req.__(
            `Functions you can use (in addition to standard JavaScript functions): `
          ),
          funNames.map((f) => code(f)).join(", ")
        )
      : "",
    examples && examples.length > 0 ? p(req.__("Examples:")) : "",
    examples ? ul(examples.map((e) => li(code(e)))) : "",
  ];
};

module.exports = expressionBlurb;
