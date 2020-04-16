const { ContractViolation } = require("./util.js");

module.exports = (theContract, val, loc, contrDefinition, callSite) => {
  if (!theContract.check(val)) {
    throw new ContractViolation(
      theContract,
      val,
      loc,
      contrDefinition,
      callSite
    );
  }
};
