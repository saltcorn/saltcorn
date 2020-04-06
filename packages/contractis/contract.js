const { get_return_contract, get_arguments_returns } = require("./util.js");

const check_contract = (theContract, val, loc) => {
  if (!theContract.check(val)) {
    const in_str = loc ? ` in ${loc}` : "";
    if (theContract.get_error_message) {
      throw new Error(
        `Contract violation${in_str}: ${theContract.get_error_message(val)}`
      );
    } else {
      const conStr = theContract.options
        ? `${theContract.name}(${JSON.stringify(theContract.options)})`
        : theContract.name;
      throw new Error(
        `Contract violation${in_str}: ${JSON.stringify(val)} violates ${conStr}`
      );
    }
  }
};

const check_arguments = (arguments_contract_spec, args) => {
  const argsContract = Array.isArray(arguments_contract_spec)
    ? arguments_contract_spec
    : [arguments_contract_spec];
  argsContract.forEach((contr, ix) => {
    check_contract(contr, args[ix], `argument ${ix}`);
  });
};

const contract_function = (fun, contr, that, check_vars) => {
  const newf = (...args) => {
    const opts = get_arguments_returns(contr);
    if (opts.arguments) check_arguments(opts.arguments, args);
    const rv = that ? fun.apply(that, args) : fun(...args);
    if (opts.returns)
      check_contract(
        get_return_contract(opts.returns, args),
        rv,
        "return value"
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

const contract = (opts, obj) => {
  if (!enabled) return obj;

  if (typeof obj === "function") return contract_function(obj, opts);
  else {
    const theContract = opts;
    check_contract(theContract, obj);
    return obj;
  }
};

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
