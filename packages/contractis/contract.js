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

const contract_function = (fun, opts) => {
  return (...args) => {
    if (opts.arguments) check_arguments(opts.arguments, args);
    const rv = fun(...args);
    if (opts.returns)
      check_contract(get_return_contract(opts.returns, args), rv);
    return rv;
  };
};

var enabled = true;

const contract = (obj, opts) => {
  if (!enabled) return obj;
  if (typeof obj === "function") return contract_function(obj, opts);
};

contract.disable = () => {
  enabled = false;
};
module.exports = contract;
