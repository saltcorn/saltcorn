/**
 * @category saltcorn-data
 * @module models/expression
 * @subcategory models
 */
import { getState } from "../db/state.js";
import vm2Pkg from "vm2";
import Table from "./table.js";
import Field from "./field.js";
import * as nsState from "../db/state.js";
import { runInNewContext, Script } from "vm";
import { parseExpressionAt, Node, parse } from "acorn";
import { replace, traverse } from "estraverse";
import { Identifier } from "estree";
import { generate } from "astring";
import moment from "moment";

import {
  AggregationOptions,
  JoinFields,
  Row,
  Where,
  sqlsanitize,
} from "@saltcorn/db-common/internal";
import { PluginFunction } from "@saltcorn/types/base_types";
import db from "../db/index.js";
import * as utils from "../utils.js";
import { GenObj } from "@saltcorn/db-common/types";
import { mergeIntoWhere, isNode, isValidJsIdentifier } from "../utils.js";
const { VM } = vm2Pkg;

function deproxy(value: any): any {
  if (!value || typeof value !== "object") return value;
  if (typeof value.then === "function") return value.then(deproxy);
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function vmRun(code: string, sandbox: any): any {
  if (isNode()) {
    const result = new VM({ sandbox, eval: false, wasm: false }).run(code);
    if (typeof result === "function")
      return (...args: any[]) => deproxy(result(...args));
    return deproxy(result);
  } else {
    return runInNewContext(code, sandbox);
  }
}

/**
 * @param {string} s
 * @returns {boolean|void}
 */
function expressionValidator(s: string, loc?: any): true | string {
  if (!s || s.length == 0) return "Missing formula";
  try {
    const f = new Script(`(${s})`); // parentheses to handle record literals
    return true;
  } catch (e: any) {
    return e.message;
  }
}

function identifiersInCodepage(s: string): Set<string> {
  const top = parse(s, {
    ecmaVersion: 2020,
    locations: false,
  });
  const fs = top.body
    .filter((n) => n.type === "FunctionDeclaration")
    .map((n) => n.id.name)
    .filter(Boolean);

  return new Set(fs);
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
  expression?: ExtendedNode;
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
          if (node.operator === "===") node.operator = "==";
          if (node.operator === "!==") node.operator = "!=";
          for (const val of ["null", "true", "false"]) {
            if (cleft === val && node.operator == "==")
              return `${cright} is ${val}`;
            if (cright === val && node.operator == "==")
              return `${cleft} is ${val}`;

            if (cleft === val && node.operator == "!=")
              return `${cright} is not ${val}`;
            if (cright === val && node.operator == "!=")
              return `${cleft} is not ${val}`;
          }
          const dblEqToEq = (s: string) => {
            if (s == "==") return "=";
            return s;
          };
          return `(${cleft})${dblEqToEq(node.operator)}(${cright})`;
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
          if (typeof value === "string")
            return `'${(value as string).replace(/'/g, "''")}'`;
          if (
            value === null ||
            typeof value === "number" ||
            typeof value === "boolean"
          )
            return `${value}`;
          throw new Error("Unknown literal type");
        },
      })[node.type](node);
    // @ts-ignore
    return compile(ast);
  } catch (e: any) {
    //console.error(e);
    throw new Error(
      `Expression "${expression}" is too complicated, I do not understand`
    );
  }
}

const today = (
  offset?:
    | number
    | { startOf: moment.unitOfTime.StartOf }
    | { endOf: moment.unitOfTime.StartOf }
) => {
  let default_locale: string | undefined;
  const get_locale = (): string => {
    if (!default_locale) {
      default_locale = getState()!.getConfig("default_locale", "en");
    }
    return default_locale as string;
  };
  let d = new Date();
  if (typeof offset === "number") d.setDate(d.getDate() + offset);
  else if (offset && "startOf" in offset) {
    d = moment().locale(get_locale()).startOf(offset.startOf).toDate();
  } else if (offset && "endOf" in offset) {
    d = moment().locale(get_locale()).endOf(offset.endOf).toDate();
  }
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

function partiallyEvaluate(ast: any, extraCtx: any = {}, fields: Field[] = []) {
  const keys = new Set(Object.keys(extraCtx));
  const field_names = new Set(fields.map((f) => f.name));

  replace(ast, {
    // @ts-ignore
    leave: function (node) {
      //console.log(node);
      if (
        node.type === "Identifier" &&
        keys.has(node.name) &&
        !field_names.has(node.name) &&
        extraCtx[node.name] !== `$${node.name}`
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
        } else if (
          arg.type === "UnaryExpression" &&
          arg.operator === "-" &&
          arg.argument.type === "Literal"
        ) {
          // @ts-ignore
          return parseExpressionAt(`'${today(-arg.argument.value)}'`, 0, {
            ecmaVersion: 2020,
          });
        } else if (arg.type === "ObjectExpression") {
          const todayArg: any = new Function("return " + generate(arg))();
          return parseExpressionAt(`'${today(todayArg)}'`, 0, {
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
    function symToWhere(whOrSym: Where | symbol): Where {
      if (typeof whOrSym === "symbol") {
        if (typeof whOrSym.description !== "string")
          throw new Error("Symbol with no description");
        const field = fields.find((f) => f.name === whOrSym.description);
        if (!field) return { not: { [whOrSym.description]: null } };
        if (field.type_name === "Bool") return { [field.name]: true };
        if (field.type_name === "Integer")
          return {
            and: [
              { not: { [field.name]: null } },
              { not: { [field.name]: 0 } },
            ],
          };
        if (field.type_name === "String")
          return {
            and: [
              { not: { [field.name]: null } },
              { not: { [field.name]: "" } },
            ],
          };
        return { not: { [whOrSym.description]: null } };
      } else return whOrSym;
    }
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
                : typeof cleft === "string" ||
                    (typeof cleft === "number" && typeof cright === "number") ||
                    cleft === null
                  ? { eq: [cleft, cright] }
                  : typeof cright === "symbol" && typeof cleft !== "symbol"
                    ? { [crightName]: cleft }
                    : { [cleftName]: cright };
          //console.log({ cleft, cleftName, cright, cmp, tycleft: typeof cleft });

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
        NewExpression({ callee }: any) {
          if (callee.name === "Date") return new Date();
          throw new Error("Unknown new expression");
        },
        ChainExpression() {
          return compile(node.expression!);
        },
        MemberExpression() {
          if (node?.object?.type === "MemberExpression") {
            //double join
            const cleft = compile(node.object!.object!);
            const cleftName =
              typeof cleft === "symbol" ? cleft.description : cleft;
            const c2 = compile(node.object!.property!);
            const c3 = compile(node.property!);
            const field = fields.find((f) => f.name === cleftName);
            if (!field) {
              //console.log({ cleftName, cleft, cright, crightName });
              throw new Error(
                `Field not found: ${cleftName}  in fields ${fields.map((f) => f.name)}`
              );
            }
            const throughTable = Table.findOne({ name: field.reftable_name });
            if (!throughTable)
              throw new Error(`Table not found: ${field.reftable_name}`);
            const throughField = throughTable.fields.find(
              (f: Field) => f.name === c2.description
            );
            const finalTable = Table.findOne({
              name: throughField!.reftable_name,
            });
            if (!finalTable)
              throw new Error(
                `Table not found: ${throughField!.reftable_name}`
              );
            return (val: any) => ({
              [cleftName]: {
                inSelect: {
                  table: db.sqlsanitize(throughTable.name),
                  tenant: db.getTenantSchema(),
                  through: finalTable.name,
                  through_pk: finalTable.pk_name,
                  valField: throughTable.pk_name,
                  field: c2.description,
                  where: { [c3.description]: val },
                },
              },
            });
          }
          const cleft = compile(node.object!);
          const cleftName =
            typeof cleft === "symbol" ? cleft.description : cleft;
          const cright = compile(node.property!);
          const crightName =
            typeof cright === "symbol" ? cright.description : cright;
          if (cleft[crightName]) return cleft[crightName];
          const field = fields.find((f) => f.name === cleftName);

          if (!field) {
            //console.log({ cleftName, cleft, cright, crightName });
            throw new Error(`Field not found: ${cleftName}`);
          }
          return (val: any) => ({
            [cleftName]: {
              inSelect: {
                table: db.sqlsanitize(field.reftable_name),
                tenant: db.getTenantSchema(),
                field:
                  Table.findOne({ name: field.reftable_name })?.pk_name || "id",
                where: { [crightName]: val },
              },
            },
          });
        },
        UnaryExpression() {
          return (<StringToFunction>{
            "!"({ argument }: { argument: ExtendedNode }) {
              return { not: symToWhere(compile(argument)) };
            },
          })[node.operator](node);
        },
        LogicalExpression() {
          const operators: StringToFunction = {
            "&&"({ left, right }: { left: ExtendedNode; right: ExtendedNode }) {
              const l = symToWhere(compile(left));
              const r = symToWhere(compile(right));

              const simpleCmp = (o: any) =>
                o &&
                typeof o === "object" &&
                !Array.isArray(o) &&
                !o.and &&
                !o.eq;

              if (
                simpleCmp(l) &&
                simpleCmp(r) &&
                !(l.not && r.not) &&
                !(l.or && r.or)
              ) {
                mergeIntoWhere(l, r);
                return l;
              }
              //console.log("merged", l);

              return { and: [l, r] };
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
    // @ts-ignore
    return symToWhere(compile(ast));
  } catch (e: any) {
    //console.error(e);
    throw new Error(
      `Expression "${expression}" is too complicated, I do not understand`
    );
  }
}

function freeVariablesInInterpolation(
  interpString: string | undefined
): Set<string> {
  let freeVars: Set<string> = new Set();
  ((interpString || "").match(/\{\{([^#].+?)\}\}/g) || []).forEach((s) => {
    const s1 = s.replace("{{", "").replace("}}", "").trim();
    freeVars = new Set([...freeVars, ...freeVariables(s1)]);
  });
  return freeVars;
}

function freeVariables(expression: string | undefined): Set<string> {
  if (!expression) return new Set();
  const ast: any = parseExpressionAt(expression, 0, {
    ecmaVersion: 2020,
    allowAwaitOutsideFunction: true,
    locations: false,
  });
  return new Set(freeVariablesAST(ast));
}
function freeVariablesAST(ast: any): Array<string> {
  const freeVars: string[] = [];
  //console.log(JSON.stringify(ast, null, 2));

  //const fvsAtCall: any = {};
  traverse(ast, {
    enter: function (node) {
      if (node.type === "CallExpression") {
        // the rule here is: if the callee of a CallExpression is a member, the
        // last member get removed.
        const calleeFvs = freeVariablesAST(node.callee);
        const argFvs = node.arguments.map(freeVariablesAST).flat();
        if (calleeFvs.length === 1) {
          const parts = calleeFvs[0].split(".");
          if (parts.length > 1) {
            parts.pop();
            calleeFvs[0] = parts.join(".");
          }
        }
        freeVars.push(...calleeFvs.filter(Boolean));
        freeVars.push(...argFvs);
        return this.skip();
      }
    },
    leave: function (node) {
      //console.log(node);

      if (node.type === "Identifier") {
        freeVars.push(node.name);
      }
      if (node.type === "MemberExpression") {
        if (
          node.property.type === "Identifier" &&
          node.property.name === "length"
        ) {
          freeVars.pop();
        } else if (
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
          //freeVars.pop();
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
          //freeVars.pop();
          //freeVars.pop();
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

  return freeVars;
}

/**
 * Add free variables to aggregations
 * @param freeVars
 * @param joinFields
 * @param fields
 */
const add_free_variables_to_aggregations = (
  freeVars: Set<string>,
  aggregations: { [nm: string]: AggregationOptions },
  table: Table
) => {
  const cfields = table
    ? Field.findCached({ reftable_name: table.name }).map((f: Field) => f.name)
    : null;
  [...freeVars]
    .filter((v) => v.includes("$"))
    .forEach((v) => {
      const [ctableName, refFieldName, targetFieldName, stat] = v.split("$");
      if (!targetFieldName) return;
      if (cfields && !cfields.includes(refFieldName)) return;
      aggregations[db.sqlsanitize(v)] = {
        table: ctableName,
        ref: refFieldName,
        field: targetFieldName,
        aggregate: stat || "array_agg",
        rename_to: v,
      };
    });
};

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
  [...freeVars]
    .filter((v) => v.includes("Ⱶ"))
    .forEach((v) => {
      const kpath = v.split("Ⱶ");
      if (joinFieldNames.has(kpath[0]))
        if (kpath.length === 2) {
          const [refNm, targetNm] = kpath;
          joinFields[v] = {
            ref: refNm,
            target: targetNm,
          };
        } else if (kpath.length === 3) {
          const [refNm, through, targetNm] = kpath;
          joinFields[v] = {
            ref: refNm,
            target: targetNm,
            through,
          };
        } else if (kpath.length === 4) {
          const [refNm, through1, through2, targetNm] = kpath;
          joinFields[v] = {
            ref: refNm,
            target: targetNm,
            through: [through1, through2],
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
  statefuns: Record<string, Function | PluginFunction>
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
          const sf = statefuns[node.callee.name] as PluginFunction;
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
  const field_names = fields.map((f) => f.name).filter(isValidJsIdentifier);
  const args = field_names.includes("user")
    ? `row, {${field_names.join()}}`
    : `row, {${field_names.join()}}, user`;
  const f = vmRun(`(${args})=>(${expression})`, getState()!.eval_context);
  return (row: any, user: any) => f(row, row, user);
}

/**
 * Evaluate a JavaScript expression in the context of a row.
 * @param {string} expression - The JavaScript expression to evaluate.
 * @param {object} row - The current row data, whose fields are destructured as variables.
 * @param {object} user - The current user object, available as `user` in the expression.
 * @param {string} errorLocation - Optional label included in error messages to identify where the expression was used.
 * @returns {any} - The result of evaluating the expression.
 */
function eval_expression(
  expression: string | undefined,
  row?: any,
  user?: any,
  errorLocation?: string
): any {
  try {
    const use_row = row || {};
    const field_names = Object.keys(use_row).filter(isValidJsIdentifier);
    const args = field_names.includes("user")
      ? `row, {${field_names.join()}}`
      : `row, {${field_names.join()}}, user`;
    return vmRun(`((${args})=>(${expression}))(row, row, user)`, {
      ...getState()!.eval_context,
      row: use_row,
      user,
    });
  } catch (e: any) {
    e.message = `In evaluating the expression ${expression}${
      errorLocation ? ` in ${errorLocation}` : ""
    }:\n\n${e.message}`;
    throw e;
  }
}

/**
 * @param {string} expression
 * @param {object[]} fields
 * @returns {any}
 */
async function eval_statements(
  expression: string,
  context: GenObj,
  errorLocation?: string
): Promise<any> {
  try {
    const evalStr = `(async ()=>{${expression}})()`;
    return await vmRun(evalStr, {
      console,
      Table,
      ...getState()!.eval_context,
      ...context,
    });
  } catch (e: any) {
    e.message = `In evaluating the statements ${expression.split("\n")}... ${
      errorLocation ? ` in ${errorLocation}` : ""
    }:\n\n${e.message}`;
    throw e;
  }
}

/**
 * @param {string} expression
 * @param {object[]} fields
 * @param {object} [extraContext = {}]
 * @returns {any}
 */
function get_async_expression_function(
  expression: string,
  fields: Array<Field | string | { name: string }>,
  extraContext = {}
): Function {
  const field_names = fields
    .map((f) => (typeof f === "string" ? f : f.name))
    .filter(isValidJsIdentifier);
  const args = field_names.includes("user")
    ? `row, {${field_names.join()}}`
    : `row, {${field_names.join()}}, user`;
  const { expr_string } = transform_for_async(
    expression,
    getState()!.functions as any
  );
  const evalStr = `async (${args})=>(${expr_string})`;
  const f = vmRun(evalStr, { ...getState()!.eval_context, ...extraContext });
  return async (row: any, user: any) => await f(row, row, user);
}

/**
 * @param {object[]} rows
 * @param {object[]} fields
 * @returns {object[]}
 */
function apply_calculated_fields(
  rows: Array<Row>,
  fields: Array<Field>,
  ignore_errors?: boolean
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
        if (!ignore_errors) {
          e.message = `Error in calculating "${field.name}": ${e.message}`;
          throw e;
        }
      }
      const oldf = transform;
      transform = (row) => {
        try {
          const x = f(row);
          row[field.name] = x;
        } catch (e: any) {
          if (!ignore_errors) {
            e.message = `Error in calculating "${field.name}": ${e.message}`;
            throw e;
          }
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
  fields: Array<Field>,
  table: Table,
  user?: any
): Promise<Row> => {
  const state = nsState.getState()!;
  let hasExprs = false;
  let transform = (x: Row) => x;
  for (const field of fields) {
    if (
      field.calculated &&
      field.stored &&
      field.expression == "__aggregation"
    ) {
      hasExprs = true;
      // refetch row with agg
      const _agg_val: any = {
        ...field.attributes,
        where: jsexprToWhere(field.attributes.aggwhere),
        field: field.attributes.agg_field.split("@")[0],
        orderBy: field.attributes.agg_order_by,
      };
      const fldType = field.attributes.agg_field.split("@")[1];
      const coerceToNumber =
        ["Sum", "Count", "CountUnique", "Avg"].includes(
          field.attributes.aggregate
        ) ||
        field.attributes.aggregate.startsWith("Percent ") ||
        ((["Max", "Min"].includes(field.attributes.aggregate) ||
          field.attributes.aggregate.startsWith("Latest ") ||
          field.attributes.aggregate.startsWith("Earliest ")) &&
          ["Integer", "Float", "Money"].includes(fldType));
      if (_agg_val.table?.includes?.("->")) {
        const [ttable, dtable] = _agg_val.table.split("->");
        const [through, rest] = _agg_val.agg_relation.split("->");
        _agg_val.table = dtable;
        _agg_val.through = through;
      }
      const pk = table.pk_name;
      const reFetchedRow = await table.getJoinedRow({
        where: { [pk]: row[pk] },
        aggregations: {
          _agg_val,
        },
      });

      if (!reFetchedRow)
        throw new Error(`Error in calculating "${field.name}": row not found`);
      //transform
      state.log(
        6,
        `apply_calculated_fields_stored aggregate field=${
          field.name
        } id=${row[pk]} val=${reFetchedRow._agg_val}`
      );
      const oldf = transform;
      transform = async (row) => {
        row[field.name] =
          coerceToNumber && typeof reFetchedRow._agg_val === "string"
            ? +reFetchedRow._agg_val
            : reFetchedRow._agg_val;

        return await oldf(row);
      };
    }
  }
  let row1 = hasExprs ? await transform(row) : row;
  hasExprs = false;
  for (const field of fields) {
    if (
      field.calculated &&
      field.stored &&
      field.expression !== "__aggregation"
    ) {
      hasExprs = true;
      let f: Function;
      try {
        if (!field.expression) throw new Error(`The fields has no expression`);
        f = get_async_expression_function(field.expression, [
          ...fields,
          ...Object.keys(row)
            .filter((k) => k.includes("Ⱶ"))
            .map((k) => k),
        ]);
      } catch (e: any) {
        e.message = `Error in calculating "${field.name}": ${e.message}`;
        throw e;
      }
      const oldf = transform;
      transform = async (row) => {
        try {
          const x = await f(row, user);
          row[field.name] = x;
        } catch (e: any) {
          e.message = `Error in calculating "${field.name}": ${e.message}`;
          throw e;
        }
        return await oldf(row);
      };
    }
  }
  if (hasExprs) {
    return await transform(row1);
  } else return row1;
};
/**
 * Recalculate calculated columns that are stored in db
 * @param {object} table - table object
 * @returns {Promise<void>}
 */
const recalculate_for_stored = async (
  table: Table,
  where?: Where
): Promise<void> => {
  let rows = [];
  let maxid = null;
  let limit = 20;
  const pk_name = table.pk_name;
  const go = async (rows: any) => {
    for (const row of rows) {
      try {
        getState()!.log(
          6,
          `recalculate_for_stored on table ${table.name} row ${row[pk_name]}`
        );
        await table.updateRow({}, row[pk_name], undefined, true);
      } catch (e: any) {
        console.error(e);
      }
    }
  };
  if (where) {
    rows = await table.getRows(where);
    await go(rows);
  } else {
    do {
      rows = await table.getRows(
        maxid !== null ? { [pk_name]: { gt: maxid } } : {},
        {
          orderBy: pk_name,
          limit: limit,
        }
      );
      await go(rows);
      if (rows.length > 0) maxid = rows[rows.length - 1][pk_name];
    } while (rows.length === limit);
  }
};
//https://stackoverflow.com/a/59094308/19839414
function removeComments(str: string) {
  return str.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "").trim();
}

/**
 * Extract a flat identifier chain from a (possibly optional) member expression.
 * Returns null for computed access or anything that isn't a plain chain.
 * e.g. `user.dept.manager` → { path: ["user","dept","manager"], optional: false }
 *      `row?.owner`        → { path: ["row","owner"],            optional: true  }
 */
function memberChain(node: any): { path: string[]; optional: boolean } | null {
  if (node.type === "Identifier") return { path: [node.name], optional: false };
  if (node.type === "ChainExpression") {
    const inner = memberChain(node.expression);
    return inner ? { ...inner, optional: true } : null;
  }
  if (
    node.type === "MemberExpression" &&
    !node.computed &&
    node.property?.type === "Identifier"
  ) {
    const obj = memberChain(node.object);
    if (obj)
      return {
        path: [...obj.path, node.property.name],
        optional: obj.optional || !!node.optional,
      };
  }
  return null;
}

const RLS_OP_MAP: Record<string, string> = {
  "===": "=",
  "==": "=",
  "!==": "<>",
  "!=": "<>",
  ">": ">",
  "<": "<",
  ">=": ">=",
  "<=": "<=",
  "&&": "AND",
  "||": "OR",
};

/**
 * Translate an ownership formula to a PostgreSQL RLS USING expression by
 * recursively transpiling the acorn AST to SQL. Returns null for any JS
 * construct that has no direct SQL equivalent (function calls, template
 * literals, etc.), which causes the caller to fall back to disabling RLS.
 *
 * Magic variable bindings:
 *   user.X  → (SELECT "X" FROM "users" WHERE "id" = curUserId)
 *   row.X   → "X"  (column reference — RLS evaluates per-row implicitly)
 *   id      → "id"
 *   a.b (FK traversal, needs fields)
 *             → "a" IN (SELECT "id" FROM reftable WHERE "b" = curUserId)
 */
function formulaToRlsUsing(
  formula: string,
  schema: string,
  fields?: any[]
): string | null {
  let ast: any;
  try {
    ast = parseExpressionAt(removeComments(formula).trim(), 0, {
      ecmaVersion: 2020,
    });
  } catch {
    return null;
  }

  const curUserId = `nullif(current_setting('app.current_user_id', true), '')::integer`;

  function transpile(node: any): string | null {
    switch (node.type) {
      case "ChainExpression":
        return transpile(node.expression);

      case "LogicalExpression":
      case "BinaryExpression": {
        const sqlOp = RLS_OP_MAP[node.operator];
        if (!sqlOp) return null;

        // FK traversal requires looking at both sides together — try before
        // falling through to independent side translation.
        if (node.type === "BinaryExpression" && sqlOp === "=" && fields) {
          const fk =
            tryFkTraversal(node.left, node.right) ??
            tryFkTraversal(node.right, node.left);
          if (fk) return fk;
        }

        const left = transpile(node.left);
        const right = transpile(node.right);
        if (left === null || right === null) return null;
        return `(${left} ${sqlOp} ${right})`;
      }

      case "UnaryExpression":
        if (node.operator === "!") {
          const arg = transpile(node.argument);
          return arg !== null ? `NOT (${arg})` : null;
        }
        return null;

      case "Identifier":
        return node.name === "id" ? `"id"` : null;

      case "Literal": {
        if (typeof node.value === "string")
          return `'${(node.value as string).replace(/'/g, "''")}'`;
        if (typeof node.value === "number" || typeof node.value === "boolean")
          return String(node.value);
        if (node.value === null) return "null";
        return null;
      }

      case "MemberExpression": {
        const chain = memberChain(node);
        if (!chain) return null;
        if (chain.path[0] === "user" && chain.path.length === 2)
          return `(SELECT "${sqlsanitize(
            chain.path[1]
          )}" FROM ${schema}"users" WHERE "id" = ${curUserId})`;
        if (chain.path[0] === "row" && chain.path.length === 2)
          return `"${sqlsanitize(chain.path[1])}"`;
        return null;
      }

      default:
        return null;
    }
  }

  // FK traversal: lhs is a.b where a is a FK field on this table and b is a
  // field on the referenced table; rhs must resolve to the current user's id.
  function tryFkTraversal(lhs: any, rhs: any): string | null {
    const lchain = memberChain(lhs);
    const rchain = memberChain(rhs);
    if (!lchain || !rchain) return null;
    if (lchain.path[0] === "user" || lchain.path[0] === "row") return null;
    if (lchain.path.length !== 2) return null;
    const [fkName, refField] = lchain.path;
    const fkField = fields!.find((f: any) => f.name === fkName);
    if (!fkField?.reftable_name) return null;
    // rhs must be user.id (the current user's primary key)
    if (
      rchain.path[0] === "user" &&
      rchain.path.length === 2 &&
      rchain.path[1] === "id"
    ) {
      return `"${sqlsanitize(
        fkName
      )}" IN (SELECT "id" FROM ${schema}"${sqlsanitize(
        fkField.reftable_name
      )}" WHERE "${sqlsanitize(refField)}" = ${curUserId})`;
    }
    return null;
  }

  return transpile(ast);
}

export {
  expressionValidator,
  expressionChecker,
  apply_calculated_fields,
  get_async_expression_function,
  get_expression_function,
  eval_expression,
  eval_statements,
  recalculate_for_stored,
  transform_for_async,
  apply_calculated_fields_stored,
  jsexprToWhere,
  jsexprToSQL,
  freeVariables,
  freeVariablesInInterpolation,
  add_free_variables_to_joinfields,
  add_free_variables_to_aggregations,
  removeComments,
  today,
  identifiersInCodepage,
  formulaToRlsUsing,
};
