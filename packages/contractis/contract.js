var stackTrace = require("stack-trace");

const {
  get_return_contract,
  get_arguments_returns,
  ContractViolation
} = require("./util.js");

const check_contract = (theContract, val, loc, caller) => {
  if (!theContract.check(val)) {
    throw new ContractViolation(theContract, val, loc, caller);
  }
};

const check_arguments = (arguments_contract_spec, args, caller) => {
  const argsContract = Array.isArray(arguments_contract_spec)
    ? arguments_contract_spec
    : [arguments_contract_spec];
  argsContract.forEach((contr, ix) => {
    check_contract(contr, args[ix], `argument ${ix}`, caller);
  });
};

const contract_function = (fun, contr, that, check_vars, caller) => {
  const newf = (...args) => {
    const opts = get_arguments_returns(contr);
    if (opts.arguments) check_arguments(opts.arguments, args, caller);
    const rv = that ? fun.apply(that, args) : fun(...args);
    if (opts.returns)
      check_contract(
        get_return_contract(opts.returns, args),
        rv,
        "return value",
        caller
      );
    if (check_vars) check_vars();
    return rv;
  };
  if (!that) newf.__contract = contr;
  return newf;
};

const contract_class = (that, cls) => {
  const opts = cls.contract;
  const check_vars = () => {
    if (opts.variables) {
      Object.entries(opts.variables).forEach(([k, v]) => {
        check_contract(v, that[k]);
      });
    }
  };

  check_vars();

  if (opts.methods) {
    Object.entries(opts.methods).forEach(([k, v]) => {
      const oldf = that[k];
      that[k] = contract_function(oldf, v, that);
    });
  }
};

var enabled = true;

function contract(opts, obj) {
  if (!enabled) return obj;
  var trace = stackTrace.get();
  var callert = trace.find(
    t => !t.getFileName().includes("contractis/contract.js")
  );
  var caller = `${callert.getFunctionName()} (${callert.getFileName()}:${callert.getLineNumber()})`;
  if (typeof obj === "function")
    return contract_function(obj, opts, null, null, caller);
  else {
    const theContract = opts;
    check_contract(theContract, obj, "value", caller);
    return obj;
  }
}

contract.value = (theContract, x) => {
  check_contract(theContract, x);
  return x;
};

contract.disable = () => {
  enabled = false;
};

contract.class = contract_class;

contract.with = (obj, opts) => contract(opts, obj);
module.exports = contract;
