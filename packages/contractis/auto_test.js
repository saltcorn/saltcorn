const gen = require("./generators");

//https://stackoverflow.com/a/43197340
function isClass(obj) {
  const isCtorClass =
    obj.constructor && obj.constructor.toString().substring(0, 5) === "class";
  if (obj.prototype === undefined) {
    return isCtorClass;
  }
  const isPrototypeCtorClass =
    obj.prototype.constructor &&
    obj.prototype.constructor.toString &&
    obj.prototype.constructor.toString().substring(0, 5) === "class";
  return isCtorClass || isPrototypeCtorClass;
}

const gen_arguments = args => {
  const argumentcs = Array.isArray(args) ? args : [args];
  return argumentcs.map(c => gen.generate_from(c));
};

const auto_test_fun = (f, opts) => {
  for (let i = 0; i < (opts.n || 100); i++) {
    const args = gen_arguments(f.__contract.arguments);
    f(...args);
  }
};

const auto_test_class = (cls, opts) => {
  const contr = cls.contract;
  for (let i = 0; i < (opts.n || 10); i++) {
    const cargs = contr.arguments ? gen_arguments(contr.arguments) : [];
    const inst = new cls(...cargs);

    for (let j = 0; j < (opts.nmeth || 10); j++) {
      const [methnm, methcontr] = gen.oneOf(Object.entries(contr.methods));
      const margs = gen_arguments(methcontr.arguments);
      inst[methnm](...margs);
    }
  }
};

module.exports = (obj, opts = {}) => {
  if (isClass(obj)) {
    return auto_test_class(obj, opts);
  }
  if (typeof obj === "function") {
    if (typeof obj.__contract === "undefined")
      throw new Error("auto_test: no contract found");
    return auto_test_fun(obj, opts);
  }
};
