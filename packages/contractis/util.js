const get_return_contract = (returns, args) =>
  typeof returns === "function" && !(returns.check && returns.contract_name)
    ? returns(...args)
    : returns;

const get_arguments_returns = contract => {
  if (contract.contract_name === "fun")
    return { arguments: contract.options[0], returns: contract.options[1] };
  else return contract;
};

class ContractViolation extends Error {
  constructor(theContract, val, location, caller, callSite) {
    const in_str = location ? ` (${location})` : "";
    var message;
    if (theContract.get_error_message) {
      message = theContract.get_error_message(val) + in_str;
    } else {
      const conStr = theContract.options
        ? `${theContract.contract_name}(${JSON.stringify(theContract.options)})`
        : theContract.contract_name;
      message = `value ${JSON.stringify(
        val
      )} violates contract ${conStr}${in_str}`;
    }

    super(message + (caller ? "\n contract defined near \n" + caller : ""));
    this.name = this.constructor.name;
    Error.captureStackTrace(this, callSite || this.constructor);
  }
}

function log_it(x) {
  console.log(x);
  return x;
}

module.exports = {
  get_return_contract,
  get_arguments_returns,
  ContractViolation,
  log_it
};
