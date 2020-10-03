const vm = require("vm");

function expressionValidator(s) {
  if (!s || s.length == 0) return "Missing formula";
  try {
    const f = vm.runInNewContext(`()=>(${s})`);
    return true;
  } catch (e) {
    return e.message;
  }
}

function get_expression_function(expression, fields) {
  const args = `{${fields.map((f) => f.name).join()}}`;
  const { getState } = require("../db/state");
  return vm.runInNewContext(
    `(${args})=>(${expression})`,
    getState().function_context
  );
}

function apply_calculated_fields(rows, fields, stored) {
  let hasExprs = false;
  let transform = (x) => x;
  for (const field of fields) {
    if (field.calculated && field.stored === stored) {
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
const recalculate_for_stored = async (table, field) => {
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
  get_expression_function,
  recalculate_for_stored,
};
