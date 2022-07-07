/**
 * @category saltcorn-data
 * @module models/expression
 * @subcategory models
 */
import { runInNewContext, Script } from "vm";
import { parseExpressionAt, Node } from "acorn";
import { replace, traverse } from "estraverse";
import { Identifier } from "estree";
import { generate } from "astring";
import Table from "./table";
import { Row, Where } from "@saltcorn/db-common/internal";
import Field from "./field";
import { PluginFunction } from "@saltcorn/types/base_types";

/**
 * @param {string} s
 * @returns {boolean|void}
 */
function expressionValidator(s: string): true | string {
  if (!s || s.length == 0) return "Missing formula";
  try {
    const f = new Script(`(${s})`); // handle record literals
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
} & Node;

/**
 * @param {string} expression
 * @throws {Error}
 * @returns {object}
 */
function jsexprToWhere(expression: string, extraCtx: any = {}): Where {
  if (!expression) return {};
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
          const cleftName =
            typeof cleft === "symbol" ? cleft.description : cleft;
          const cright = compile(node.right!);
          const cmp =
            typeof cleft === "string" || cleft === null
              ? { eq: [cleft, cright] }
              : { [cleftName]: cright };
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
    ? `{${field_names.join()}}`
    : `{${field_names.join()}}, user`;
  const { getState } = require("../db/state");
  return runInNewContext(
    `(${args})=>(${expression})`,
    getState().function_context
  );
}

/**
 * @param {string} expression
 * @param {object[]} fields
 * @returns {any}
 */
function eval_expression(expression: string, row: any, user?: any): any {
  const field_names = Object.keys(row);
  const args = field_names.includes("user")
    ? `{${field_names.join()}}`
    : `{${field_names.join()}}, user`;
  const { getState } = require("../db/state");
  return runInNewContext(
    `(${args})=>(${expression})`,
    getState().function_context
  )(row, user);
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
    ? `{${field_names.join()}}`
    : `{${field_names.join()}}, user`;
  const { getState } = require("../db/state");
  const { expr_string } = transform_for_async(expression, getState().functions);
  const evalStr = `async (${args})=>(${expr_string})`;
  return runInNewContext(evalStr, {
    ...getState().function_context,
    ...extraContext,
  });
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
        await table.updateRow({}, row.id);
      } catch (e: any) {
        console.error(e);
      }
    }
    if (rows.length > 0) maxid = rows[rows.length - 1].id;
  } while (rows.length === 20);
};
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
  freeVariables,
};
