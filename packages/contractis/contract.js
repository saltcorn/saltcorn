const check_contract = (theContract, val) => {
  if (!theContract.check(val)) {
    if (theContract.get_error_message) {
      throw new Error(
        `Contract violation: ${theContract.get_error_message(val)}`
      );
    } else {
      const conStr = theContract.options
        ? `${theContract.name}(${theContract.options})`
        : theContract.name;
      throw new Error(`Contract violation: ${val} violates ${conStr}`);
    }
  }
};

const check_arguments = (arguments_contract_spec, args) => {
  const argsContract = Array.isArray(arguments_contract_spec)
    ? arguments_contract_spec
    : [arguments_contract_spec];
  argsContract.forEach((contr, ix) => {
    check_contract(contr, args[ix]);
  });
};

const get_return_contract = (returns, args) =>
  typeof returns === "function" ? returns(...args) : returns;

const contract_function = (fun, opts, that, check_vars) => {
  const newf = (...args) => {
    if (opts.arguments) check_arguments(opts.arguments, args);
    const rv = that ? fun.apply(that, args) : fun(...args);
    if (opts.returns)
      check_contract(get_return_contract(opts.returns, args), rv);
    if (check_vars) check_vars();
    return rv;
  };
  if (!that) newf.__contract = opts;
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
};

contract.disable = () => {
  enabled = false;
};

contract.class = contract_class;

contract.with = (obj, opts) => contract(opts, obj);
module.exports = contract;
