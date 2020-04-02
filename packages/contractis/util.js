const get_return_contract = (returns, args) =>
  typeof returns === "function" ? returns(...args) : returns;

const get_arguments_returns = contract => {
  if (contract.name === "fun")
    return { arguments: contract.options[0], returns: contract.options[1] };
  else return contract;
};

module.exports = { get_return_contract, get_arguments_returns };
