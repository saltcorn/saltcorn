const get_return_contract = (returns, args) =>
  typeof returns === "function" ? returns(...args) : returns;

const get_arguments_returns = contract => {
  if (contract.name === "fun")
    return { arguments: contract.options[0], returns: contract.options[1] };
  else return contract;
};

class ContractViolation extends Error {
  constructor(theContract, val, location, caller) {
    const in_str = location ? ` (${location})` : "";
    var message;
    if (theContract.get_error_message) {
      message = theContract.get_error_message(val)+in_str
    
    } else {
      const conStr = theContract.options
        ? `${theContract.name}(${JSON.stringify(theContract.options)})`
        : theContract.name;
      message =`value ${JSON.stringify(val)} violates contract ${conStr}${in_str}`
    }
    
    super(message+(caller ? "\n at \n"+caller : ""));
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
    
  }
}

module.exports = { get_return_contract, get_arguments_returns,ContractViolation };
