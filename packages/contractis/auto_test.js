const gen = require("./generators");

const auto_test_fun = (f, opts) => {
  for (let index = 0; index < (opts.n || 100); index++) {
    const argumentcs = Array.isArray(f.__contract.arguments)
      ? f.__contract.arguments
      : [f.__contract.arguments];
    const args = argumentcs.map(c => gen.generate_from(c));
    f(...args);
  }
};

module.exports = (obj, opts = {}) => {
  if (typeof obj.__contract === "undefined")
    throw new Error("auto_test: no contract found");
  if (typeof obj === "function") {
    auto_test_fun(obj, opts);
  }
};
