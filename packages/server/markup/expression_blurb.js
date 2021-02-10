const { p, code, li, ul, pre } = require("@saltcorn/markup/tags");
const { contract, is } = require("contractis");
const { getState } = require("@saltcorn/data/db/state");

const toJsType = (type) =>
  ({
    Integer: "number",
    Float: "number",
    Bool: "boolean",
    Date: "Date class",
    String: "string",
    Color: "string",
  }[type] || type);

const intExamples = (type, fields) => {
  const boolFields = fields.filter((f) => f.type.name === "Bool");
  const intFields = fields.filter((f) => f.type.name === "Integer");
  const exs = ["3"];
  if (boolFields.length > 0) {
    const b = is.one_of(boolFields).generate();
    exs.push(`${b.name} ? 6 : 9`);
  }
  if (intFields.length > 0) {
    const b = is.one_of(intFields).generate();
    exs.push(`${b.name} + 5`);
  }
  return exs;
};

const colorExamples = (type, fields) => {
  const boolFields = fields.filter((f) => f.type.name === "Bool");
  const exs = [`"#06ab6d1"`];
  if (boolFields.length > 0) {
    const b = is.one_of(boolFields).generate();
    exs.push(`${b.name} ? "#000000" : "#ffffff"`);
  }
  return exs;
};
const stringExamples = (type, fields) => {
  const boolFields = fields.filter((f) => f.type.name === "Bool");
  const strFields = fields.filter((f) => f.type.name === "String");
  const exs = [`"Hello world!"`];
  if (boolFields.length > 0) {
    const b = is.one_of(boolFields).generate();
    exs.push(`${b.name} ? "Squish" : "Squash"`);
  }
  if (strFields.length > 0) {
    const b = is.one_of(strFields).generate();
    exs.push(`${b.name}.toUpperCase()`);
  }
  return exs;
};
const floatExamples = (type, fields) => {
  const boolFields = fields.filter((f) => f.type.name === "Bool");
  const numFields = fields.filter(
    (f) => f.type.name === "Integer" || f.type.name === "Float"
  );
  const exs = ["3.14"];
  if (boolFields.length > 0) {
    const b = is.one_of(boolFields).generate();
    exs.push(`${b.name} ? 2.78 : 99`);
  }
  if (numFields.length > 0) {
    const b = is.one_of(numFields).generate();
    exs.push(`Math.pow(${b.name}, 2)`);
  }
  if (numFields.length > 1) {
    const n1 = numFields[0];
    const n2 = numFields[1];
    exs.push(
      `${n1.name}>${n2.name} ? Math.sqrt(${n1.name}) : ${n1.name}*${n2.name}`
    );
  }
  return exs;
};
const boolExamples = (type, fields) => {
  const boolFields = fields.filter((f) => f.type.name === "Bool");
  const numFields = fields.filter(
    (f) => f.type.name === "Integer" || f.type.name === "Float"
  );
  const exs = ["true"];
  if (boolFields.length > 0) {
    const b = is.one_of(boolFields).generate();
    exs.push(`!${b.name}`);
  }
  if (boolFields.length > 1) {
    const b1 = boolFields[0];
    const b2 = boolFields[1];
    exs.push(`${b1.name} && ${b2.name}`);
  }
  if (numFields.length > 0) {
    const b = is.one_of(numFields).generate();
    exs.push(`${b.name}<3`);
  }
  if (numFields.length > 1) {
    const n1 = numFields[0];
    const n2 = numFields[1];
    exs.push(`${n1.name}>${n2.name}`);
  }
  return exs;
};

const expressionBlurb = (type, stored, allFields, req) => {
  const fields = allFields.filter((f) => !f.is_fkey && !f.calculated);
  const funs = getState().functions;
  const funNames = Object.entries(funs)
    .filter(([k, v]) => !(!stored && v.isAsync))
    .map(([k, v]) => k);
  const examples = (
    {
      Integer: () => intExamples(type, fields),
      Float: () => floatExamples(type, fields),
      Bool: () => boolExamples(type, fields),
      Color: () => colorExamples(type, fields),
      String: () => stringExamples(type, fields),
    }[type] || (() => [])
  )();
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
