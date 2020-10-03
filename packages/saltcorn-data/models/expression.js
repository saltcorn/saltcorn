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

module.exports = { expressionValidator, get_expression_function };
