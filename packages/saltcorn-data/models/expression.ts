/**
 * @category saltcorn-data
 * @module models/expression
 * @subcategory models
 */
import { runInNewContext, Script } from "vm";
import { parseExpressionAt, Node, parse } from "acorn";
import { replace, traverse } from "estraverse";
import { Identifier } from "estree";
import { generate } from "astring";
import Table from "./table";
import { JoinFields, Row, Where } from "@saltcorn/db-common/internal";
import Field from "./field";
import { PluginFunction } from "@saltcorn/types/base_types";
import db from "../db";
/**
 * @param {string} s
 * @returns {boolean|void}
 */
function expressionValidator(s: string): true | string {
  if (!s || s.length == 0) return "Missing formula";
  try {
    const f = new Script(`(${s})`); // parentheses to handle record literals
    return true;
  } catch (e: any) {
    return e.message;
  }
}

function expressionChecker(s: string, prefix: string, errors: string[]) {
  const result = expressionValidator(s);
  if (typeof result === "string") errors.push(prefix + result);
}

type StringToFunction = Record<string, Function>;
type ExtendedNode = {
  left?: ExtendedNode;
  right?: ExtendedNode;
  operator?: any;
  object?: ExtendedNode;
  property?: ExtendedNode;
  value?: ExtendedNode;
  key?: ExtendedNode;
  properties?: any;
} & Node;

/**
 * @param {string} expression
 * @throws {Error}
 * @returns {string}
 */
function jsexprToSQL(expression: string, extraCtx: any = {}): String {
  if (!expression) return "";
  try {
    const ast = parseExpressionAt(expression, 0, {
      ecmaVersion: 2020,
      locations: false,
    });
    //console.log(ast);
    const compile: (node: ExtendedNode) => any = (node: ExtendedNode): any =>
      (<StringToFunction>{
        BinaryExpression() {
          const cleft = compile(node.left!);

          const cright = compile(node.right!);
          return `(${cleft})${node.operator}(${cright})`;
        },
        UnaryExpression() {
          return (<StringToFunction>{
            "!"({ argument }: { argument: ExtendedNode }) {
              return `not (${compile(argument)})`;
            },
          })[node.operator](node);
        },
        LogicalExpression() {
          const cleft = compile(node.left!);

          const cright = compile(node.right!);

          const translate: any = { "&&": "and", "||": "or" };
          return `(${cleft})${
            translate[node.operator] || node.operator
          }(${cright})`;
        },
        Identifier({ name }: { name: string }) {
          return name;
        },
        Literal({ value }: { value: ExtendedNode }) {
          return `${value}`;
        },
      })[node.type](node);
    return compile(ast);
  } catch (e: any) {
    console.error(e);
    throw new Error(
      `Expression "${expression}" is too complicated, I do not understand`
    );
  }
}
function partiallyEvaluate(ast: any, extraCtx: any = {}, fields: Field[] = []) {
  const keys = new Set(Object.keys(extraCtx));
  const field_names = new Set(fields.map((f) => f.name));
  const today = (offset?: number) => {
    const d = new Date();
    if (offset) d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };
  replace(ast, {
    // @ts-ignore
    leave: function (node) {
      //console.log(node);
      if (
        node.type === "Identifier" &&
        keys.has(node.name) &&
        !field_names.has(node.name)
      ) {
        const valExpression = JSON.stringify(extraCtx[node.name]);
        const valAst = parseExpressionAt(valExpression, 0, {
          ecmaVersion: 2020,
          locations: false,
        });

        return valAst;
      }
    },
  });
  replace(ast, {
    // @ts-ignore
    leave: function (node) {
      //console.log(node);
      if (
        node.type === "BinaryExpression" &&
        node.left.type === "Literal" &&
        node.right.type === "Literal"
      ) {
        switch (node.operator) {
          case "+":
            // @ts-ignore
            node.left.value = node.left.value + node.right.value;
            return node.left;
          case "-":
            // @ts-ignore
            node.left.value = node.left.value - node.right.value;
            return node.left;
        }
      }
      if (
        node.type === "MemberExpression" &&
        node.object.type === "ObjectExpression" &&
        node.property.type === "Identifier"
      ) {
        const theProperty = node.object.properties.find(
          // @ts-ignore
          (p) => p.key.value === node.property.name
        );
        // @ts-ignore
        if (theProperty && theProperty.value) return theProperty.value;
      }

      if (
        node.type === "CallExpression" &&
        // @ts-ignore
        node.callee.name === "today"
      ) {
        if (node.arguments.length === 0) {
          return parseExpressionAt(`'${today()}'`, 0, { ecmaVersion: 2020 });
        }
        const arg = node.arguments[0];
        if (arg.type === "Literal") {
          // @ts-ignore
          return parseExpressionAt(`'${today(arg.value)}'`, 0, {
            ecmaVersion: 2020,
          });
        }
        if (
          arg.type === "UnaryExpression" &&
          arg.operator === "-" &&
          arg.argument.type === "Literal"
        ) {
          // @ts-ignore
          return parseExpressionAt(`'${today(-arg.argument.value)}'`, 0, {
            ecmaVersion: 2020,
          });
        }
      }
    },
  });
}
/**
 * @param {string} expression
 * @throws {Error}
 * @returns {object}
 */
function jsexprToWhere(
  expression: string,
  extraCtx: any = {},
  fields: Field[] = []
): Where {
  if (!expression) return {};
  const now = new Date();
  if (!extraCtx.year) extraCtx.year = now.getFullYear();
  if (!extraCtx.month) extraCtx.month = now.getMonth() + 1;
  if (!extraCtx.day) extraCtx.day = now.getDate();
  try {
    const ast = parseExpressionAt(expression, 0, {
      ecmaVersion: 2020,
      locations: false,
    });
    //console.log("before", ast);
    partiallyEvaluate(ast, extraCtx, fields);
    //console.log("after", JSON.stringify(ast, null, 2));

    const compile: (node: ExtendedNode) => any = (node: ExtendedNode): any =>
      (<StringToFunction>{
        BinaryExpression() {
          const cleft = compile(node.left!);
          const cleftName =
            typeof cleft === "symbol" ? cleft.description : cleft;
          const cright = compile(node.right!);
          const crightName =
            typeof cright === "symbol" ? cright.description : cright;
          const cmp =
            typeof cright === "function"
              ? cright(cleft)
              : typeof cleft === "function"
              ? cleft(cright)
              : typeof cleft === "string" || cleft === null
              ? { eq: [cleft, cright] }
              : typeof cright === "symbol" && typeof cleft !== "symbol"
              ? { [crightName]: cleft }
              : { [cleftName]: cright };
          //console.log({ cleft, cleftName, cright, cmp });

          const operators: StringToFunction = {
            "=="() {
              return cmp;
            },
            "==="() {
              return cmp;
            },
            "!="() {
              return { not: cmp };
            },
            "!=="() {
              return { not: cmp };
            },
            ">"() {
              return { [cleftName]: { gt: cright } };
            },
            "<"() {
              return { [cleftName]: { lt: cright } };
            },
            ">="() {
              return { [cleftName]: { gt: cright, equal: true } };
            },
            "<="() {
              return { [cleftName]: { lt: cright, equal: true } };
            },
          };
          return operators[node.operator](node);
        },
        ObjectExpression() {
          const rec: any = {};
          (node.properties || []).forEach(
            ({ key, value }: { key: ExtendedNode; value: ExtendedNode }) => {
              // @ts-ignore
              rec[key.value as string] = value.value;
            }
          );
          return rec;
        },
        MemberExpression() {
          const cleft = compile(node.object!);
          const cleftName =
            typeof cleft === "symbol" ? cleft.description : cleft;
          const cright = compile(node.property!);
          const crightName =
            typeof cright === "symbol" ? cright.description : cright;
          if (cleft[crightName]) return cleft[crightName];
          const field = fields.find((f) => f.name === cleftName);

          if (!field) {
            console.log({ cleftName, cleft, cright, crightName });

            throw new Error(`Field not found: ${cleftName}`);
          }
          return (val: any) => ({
            [cleftName]: {
              inSelect: {
                table: db.sqlsanitize(field.reftable_name),
                tenant: db.getTenantSchema(),
                field: "id", //wild guess?
                where: { [crightName]: val },
              },
            },
          });
        },
        UnaryExpression() {
          return (<StringToFunction>{
            "!"({ argument }: { argument: ExtendedNode }) {
              return { not: compile(argument) };
            },
          })[node.operator](node);
        },
        LogicalExpression() {
          const operators: StringToFunction = {
            "&&"({ left, right }: { left: ExtendedNode; right: ExtendedNode }) {
              const l = compile(left);
              const r = compile(right);
              Object.assign(l, r);
              return l;
            },
            "||"({ left, right }: { left: any; right: any }) {
              return { or: [compile(left), compile(right)] };
            },
          };
          return operators[node.operator](node);
        },
        Identifier({ name }: { name: string }) {
          if (name[0] === "$") {
            return extraCtx[name.substring(1)] || null;
          }
          return Symbol(name);
        },
        Literal({ value }: { value: ExtendedNode }) {
          return value;
        },
      })[node.type](node);
    return compile(ast);
  } catch (e: any) {
    console.error(e);
    throw new Error(
      `Expression "${expression}" is too complicated, I do not understand`
    );
  }
}

function freeVariables(expression: string): Set<string> {
  if (!expression) return new Set();
  const freeVars: string[] = [];
  const ast: any = parseExpressionAt(expression, 0, {
    ecmaVersion: 2020,
    allowAwaitOutsideFunction: true,
    locations: false,
  });
  //console.log(JSON.stringify(ast, null, 2));

  traverse(ast, {
    leave: function (node) {
      //console.log(node);

      if (node.type === "Identifier") {
        freeVars.push(node.name);
      }
      if (node.type === "MemberExpression") {
        if (
          node.object.type === "Identifier" &&
          node.property.type === "Identifier"
        ) {
          freeVars.pop();
          freeVars.pop();
          freeVars.push(`${node.object.name}.${node.property.name}`);
        } else if (
          node.object.type === "MemberExpression" &&
          node.object.object.type === "Identifier" &&
          node.object.property.type === "Identifier" &&
          node.property.type === "Identifier"
        ) {
          freeVars.pop();
          freeVars.pop();
          freeVars.pop();
          freeVars.push(
            `${node.object.object.name}.${node.object.property.name}.${node.property.name}`
          );
        } else if (
          node.object.type === "MemberExpression" &&
          node.object.object.type === "MemberExpression" &&
          node.object.object.property.type === "Identifier" &&
          node.object.object.object.type === "Identifier" &&
          node.object.property.type === "Identifier" &&
          node.property.type === "Identifier"
        ) {
          freeVars.pop();
          freeVars.pop();
          freeVars.pop();
          freeVars.pop();
          freeVars.push(
            `${node.object.object.object.name}.${node.object.object.property.name}.${node.object.property.name}.${node.property.name}`
          );
        }
      }
    },
  });
  //console.log(expression, freeVars);

  return new Set(freeVars);
}

/**
 * Add free variables to join fields
 * @param freeVars
 * @param joinFields
 * @param fields
 */
const add_free_variables_to_joinfields = (
  freeVars: Set<string>,
  joinFields: JoinFields,
  fields: Field[]
) => {
  const joinFieldNames = new Set(
    fields.filter((f) => f.is_fkey).map((f) => f.name)
  );
  [...freeVars]
    .filter((v) => v.includes("."))
    .forEach((v) => {
      const kpath = v.split(".");
      if (joinFieldNames.has(kpath[0]))
        if (kpath.length === 2) {
          const [refNm, targetNm] = kpath;
          joinFields[`${refNm}_${targetNm}`] = {
            ref: refNm,
            target: targetNm,
            rename_object: [refNm, targetNm],
          };
        } else if (kpath.length === 3) {
          const [refNm, through, targetNm] = kpath;
          joinFields[`${refNm}_${through}_${targetNm}`] = {
            ref: refNm,
            target: targetNm,
            through,
            rename_object: [refNm, through, targetNm],
          };
        } else if (kpath.length === 4) {
          const [refNm, through1, through2, targetNm] = kpath;
          joinFields[`${refNm}_${through1}_${through2}_${targetNm}`] = {
            ref: refNm,
            target: targetNm,
            through: [through1, through2],
            rename_object: [refNm, through1, through2, targetNm],
          };
        }
    });
};

function isIdentifierWithName(node: any): node is Identifier {
  return node && "name" in node && node.name !== undefined;
}

/**
 * @param {string} expression
 * @param {object[]} statefuns
 * @returns {object}
 */
function transform_for_async(
  expression: string,
  statefuns: Record<string, PluginFunction>
) {
  var isAsync = false;
  const ast: any = parseExpressionAt(expression, 0, {
    ecmaVersion: 2020,
    allowAwaitOutsideFunction: true,
    locations: false,
  });
  replace(ast, {
    leave: function (node) {
      if (node.type === "CallExpression") {
        if (isIdentifierWithName(node.callee)) {
          const sf = statefuns[node.callee.name];
          if (sf && sf.isAsync) {
            isAsync = true;
            return { type: "AwaitExpression", argument: node };
          }
        }
      }
    },
  });

  return { isAsync, expr_string: generate(ast) };
}

/**
 * @param {string} expression
 * @param {object[]} fields
 * @returns {any}
 */
function get_expression_function(
  expression: string,
  fields: Array<Field>
): Function {
  const field_names = fields.map((f) => f.name);
  const args = field_names.includes("user")
    ? `row, {${field_names.join()}}`
    : `row, {${field_names.join()}}, user`;
  const { getState } = require("../db/state");
  const f = runInNewContext(
    `(${args})=>(${expression})`,
    getState().function_context
  );
  return (row: any, user: any) => f(row, row, user);
}

/**
 * @param {string} expression
 * @param {object[]} fields
 * @returns {any}
 */
function eval_expression(expression: string, row: any, user?: any): any {
  const field_names = Object.keys(row);
  const args = field_names.includes("user")
    ? `row, {${field_names.join()}}`
    : `row, {${field_names.join()}}, user`;
  const { getState } = require("../db/state");
  return runInNewContext(
    `(${args})=>(${expression})`,
    getState().function_context
  )(row, row, user);
}

/**
 * @param {string} expression
 * @param {object[]} fields
 * @param {object} [extraContext = {}]
 * @returns {any}
 */
function get_async_expression_function(
  expression: string,
  fields: Array<Field>,
  extraContext = {}
): any {
  const field_names = fields.map((f) => f.name);
  const args = field_names.includes("user")
    ? `row, {${field_names.join()}}`
    : `row, {${field_names.join()}}, user`;
  const { getState } = require("../db/state");
  const { expr_string } = transform_for_async(expression, getState().functions);
  const evalStr = `async (${args})=>(${expr_string})`;
  const f = runInNewContext(evalStr, {
    ...getState().function_context,
    ...extraContext,
  });
  return (row: any, user: any) => f(row, row, user);
}

/**
 * @param {object[]} rows
 * @param {object[]} fields
 * @returns {object[]}
 */
function apply_calculated_fields(
  rows: Array<Row>,
  fields: Array<Field>
): Array<Row> {
  let hasExprs = false;
  let transform = (x: Row): Row => x;
  for (const field of fields) {
    if (field.calculated && !field.stored) {
      hasExprs = true;
      let f: Function;
      try {
        if (!field.expression) throw new Error(`The field has no expression`);
        f = get_expression_function(field.expression, fields);
      } catch (e: any) {
        throw new Error(`Error in calculating "${field.name}": ${e.message}`);
      }
      const oldf = transform;
      transform = (row) => {
        try {
          const x = f(row);
          row[field.name] = x;
        } catch (e: any) {
          throw new Error(`Error in calculating "${field.name}": ${e.message}`);
        }
        return oldf(row);
      };
    }
  }
  if (hasExprs) {
    return rows.map(transform);
  } else return rows;
}

/**
 * @param {*} row
 * @param {*} fields
 * @returns {Promise<any>}
 */
const apply_calculated_fields_stored = async (
  row: Row,
  fields: Array<Field>
): Promise<Row> => {
  let hasExprs = false;
  let transform = (x: Row) => x;
  for (const field of fields) {
    if (field.calculated && field.stored) {
      hasExprs = true;
      let f: Function;
      try {
        if (!field.expression) throw new Error(`The fields has no expression`);
        f = get_async_expression_function(field.expression, fields);
      } catch (e: any) {
        throw new Error(`Error in calculating "${field.name}": ${e.message}`);
      }
      const oldf = transform;
      transform = async (row) => {
        try {
          const x = await f(row);
          row[field.name] = x;
        } catch (e: any) {
          throw new Error(`Error in calculating "${field.name}": ${e.message}`);
        }
        return await oldf(row);
      };
    }
  }
  if (hasExprs) {
    return await transform(row);
  } else return row;
};
/**
 * Recalculate calculated columns that are stored in db
 * @param {object} table - table object
 * @returns {Promise<void>}
 */
const recalculate_for_stored = async (table: Table): Promise<void> => {
  let rows = [];
  let maxid = 0;

  do {
    rows = await table.getRows(
      { id: { gt: maxid } },
      { orderBy: "id", limit: 20 }
    );
    for (const row of rows) {
      try {
        await table.updateRow({}, row.id, undefined, true);
      } catch (e: any) {
        console.error(e);
      }
    }
    if (rows.length > 0) maxid = rows[rows.length - 1].id;
  } while (rows.length === 20);
};
//https://stackoverflow.com/a/59094308/19839414
function removeComments(str: string) {
  return str.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "").trim();
}
export = {
  expressionValidator,
  expressionChecker,
  apply_calculated_fields,
  get_async_expression_function,
  get_expression_function,
  eval_expression,
  recalculate_for_stored,
  transform_for_async,
  apply_calculated_fields_stored,
  jsexprToWhere,
  jsexprToSQL,
  freeVariables,
  add_free_variables_to_joinfields,
  removeComments,
};
