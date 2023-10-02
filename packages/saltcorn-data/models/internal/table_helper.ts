import { Type, instanceOfType } from "@saltcorn/types/common_types";
import Field from "../field";

const { contract, is } = require("contractis");

/**
 * @param {*} type
 * @param {object[]} fields
 * @returns {string[]}
 */
export const intExamples = (fields: Field[]): string[] => {
  const boolFields = fields.filter(
    (f) => instanceOfType(f.type) && f.type.name === "Bool"
  );
  const intFields = fields.filter(
    (f) => instanceOfType(f.type) && f.type.name === "Integer"
  );
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

/**
 * @param {*} type
 * @param {object[]} fields
 * @returns {string[]}
 */
export const colorExamples = (fields: Field[]): string[] => {
  const boolFields = fields.filter(
    (f) => instanceOfType(f.type) && f.type.name === "Bool"
  );
  const exs = [`"#06ab6d1"`];
  if (boolFields.length > 0) {
    const b = is.one_of(boolFields).generate();
    exs.push(`${b.name} ? "#000000" : "#ffffff"`);
  }
  return exs;
};

/**
 * @param {*} type
 * @param {object[]} fields
 * @returns {string[]}
 */
export const stringExamples = (fields: Field[]): string[] => {
  const boolFields = fields.filter(
    (f) => instanceOfType(f.type) && f.type.name === "Bool"
  );
  const strFields = fields.filter(
    (f) => instanceOfType(f.type) && f.type.name === "String"
  );
  const intFields = fields.filter(
    (f) => instanceOfType(f.type) && f.type.name === "Integer"
  );
  const exs = [`"Hello world!"`];
  if (boolFields.length > 0) {
    const b = is.one_of(boolFields).generate();
    exs.push(`${b.name} ? "Squish" : "Squash"`);
  }
  if (strFields.length > 0) {
    const b1 = is.one_of(strFields).generate();
    exs.push(`${b1.name}`);
    const b = is.one_of(strFields).generate();
    exs.push(`${b.name}.toUpperCase()`);
  }
  if (strFields.length > 0 && intFields.length > 0) {
    const sf = is.one_of(strFields).generate();
    const intf = is.one_of(intFields).generate();
    exs.push("`${" + sf.name + "} ${" + intf.name + "}`");
  }
  return exs;
};

/**
 * @param {*} type
 * @param {object[]} fields
 * @returns {string[]}
 */
export const floatExamples = (fields: Field[]): string[] => {
  const boolFields = fields.filter(
    (f) => instanceOfType(f.type) && f.type.name === "Bool"
  );
  const numFields = fields.filter(
    (f) =>
      instanceOfType(f.type) &&
      (f.type.name === "Integer" || f.type.name === "Float")
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

/**
 * @param {*} type
 * @param {object[]} fields
 * @returns {string[]}
 */
export const boolExamples = (fields: Field[]): string[] => {
  const boolFields = fields.filter(
    (f) => instanceOfType(f.type) && f.type.name === "Bool"
  );
  const numFields = fields.filter(
    (f) =>
      instanceOfType(f.type) &&
      (f.type.name === "Integer" || f.type.name === "Float")
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

export const get_formula_examples = (type: string, fields: Field[]): string[] =>
  ((
    {
      Integer: () => intExamples(fields),
      Float: () => floatExamples(fields),
      Bool: () => boolExamples(fields),
      Color: () => colorExamples(fields),
      String: () => stringExamples(fields),
    }[type] || (() => [])
  )());
