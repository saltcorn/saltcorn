const vm = require("vm");
let acorn = require("acorn");
const estraverse = require("estraverse");
const astring = require("astring");
function expressionValidator(s) {
  if (!s || s.length == 0) return "Missing formula";
  try {
    const f = new vm.Script(s);
    return true;
  } catch (e) {
    return e.message;
  }
}
function jsexprToSQL(expression) {
  if (!expression) return expression;
  return expression.replace(/===/g, "=").replace(/==/g, "=").replace(/"/g, "'");
}
function transform_for_async(expression, statefuns) {
  var isAsync = false;
  const ast = acorn.parseExpressionAt(expression, 0, {
    ecmaVersion: 2020,
    allowAwaitOutsideFunction: true,
    locations: false,
  });
  estraverse.replace(ast, {
    leave: function (node) {
      if (node.type === "CallExpression") {
        const sf = statefuns[node.callee.name];
        if (sf && sf.isAsync) {
          isAsync = true;
          return { type: "AwaitExpression", argument: node };
        }
      }
    },
  });

  return { isAsync, expr_string: astring.generate(ast) };
}

function get_expression_function(expression, fields) {
  const args = `{${fields.map((f) => f.name).join()}}`;
  const { getState } = require("../db/state");
  return vm.runInNewContext(
    `(${args})=>(${expression})`,
    getState().function_context
  );
}
function get_async_expression_function(expression, fields, extraContext = {}) {
  const args = `{${fields.map((f) => f.name).join()}}`;
  const { getState } = require("../db/state");
  const { expr_string } = transform_for_async(expression, getState().functions);
  const evalStr = `async (${args})=>(${expr_string})`;
  return vm.runInNewContext(evalStr, {
    ...getState().function_context,
    ...extraContext,
  });
}
function apply_calculated_fields(rows, fields) {
  let hasExprs = false;
  let transform = (x) => x;
  for (const field of fields) {
    if (field.calculated && !field.stored) {
      hasExprs = true;
      let f;
      try {
        f = get_expression_function(field.expression, fields);
      } catch (e) {
        throw new Error(`Error in calculating "${field.name}": ${e.message}`);
      }
      const oldf = transform;
      transform = (row) => {
        try {
          const x = f(row);
          row[field.name] = x;
        } catch (e) {
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
const apply_calculated_fields_stored = async (row, fields) => {
  let hasExprs = false;
  let transform = (x) => x;
  for (const field of fields) {
    if (field.calculated && field.stored) {
      hasExprs = true;
      let f;
      try {
        f = get_async_expression_function(field.expression, fields);
      } catch (e) {
        throw new Error(`Error in calculating "${field.name}": ${e.message}`);
      }
      const oldf = transform;
      transform = async (row) => {
        try {
          const x = await f(row);
          row[field.name] = x;
        } catch (e) {
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
 * @param table - table object
 * @returns {Promise<void>}
 */
const recalculate_for_stored = async (table) => {
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
      } catch (e) {
        console.error(e);
      }
    }
    if (rows.length > 0) maxid = rows[rows.length - 1].id;
  } while (rows.length === 20);
};
module.exports = {
  expressionValidator,
  apply_calculated_fields,
  get_async_expression_function,
  get_expression_function,
  recalculate_for_stored,
  transform_for_async,
  apply_calculated_fields_stored,
  jsexprToSQL,
};
