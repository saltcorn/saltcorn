const gen = require("./generators");
const { get_return_contract, get_arguments_returns } = require("./util.js");

const auto_default_examples = 100;

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

const auto_test_fun = (f, contr, opts) => {
  for (let i = 0; i < (opts.n || auto_default_examples); i++) {
    const args = gen.gen_arguments(contr.arguments);
    f(...args);
  }
};

const auto_test_fun_async = async (f, contr, opts) => {
  for (let i = 0; i < (opts.n || auto_default_examples); i++) {
    const args = gen.gen_arguments(contr.arguments);
    await f(...args);
  }
};
const auto_test_class = (cls, contr, opts) => {
  for (let i = 0; i < (opts.n || 10); i++) {
    const inst = gen.generate_class(cls)();

    for (let j = 0; j < (opts.nmeth || 10); j++) {
      const [methnm, methcontr] = gen.oneOf(Object.entries(contr.methods));

      const margs = gen.gen_arguments(
        get_arguments_returns(methcontr).arguments
      );
      inst[methnm](...margs);
    }
  }
};

const auto_test_class_async = async (cls, contr, opts) => {
  for (let i = 0; i < (opts.n || 10); i++) {
    const inst = gen.generate_class(cls)();

    for (let j = 0; j < (opts.nmeth || 10); j++) {
      const [methnm, methcontr] = gen.oneOf(Object.entries(contr.methods));

      const margs = gen.gen_arguments(
        get_arguments_returns(methcontr).arguments
      );
      if (!margs || margs.length === 0) inst[methnm];
      else await inst[methnm](...margs);
    }
  }
};

const isPromise = (contr) =>
  get_arguments_returns(contr).returns &&
  get_arguments_returns(contr).returns.contract_name === "promise";

module.exports = (obj, opts = {}) => {
  if (isClass(obj)) {
    const contr = obj.contract;
    const has_async_methods = Object.entries(
      contr.methods
    ).some(([mnm, mcontr]) => isPromise(mcontr));
    if (has_async_methods) return auto_test_class_async(obj, contr, opts);
    else return auto_test_class(obj, contr, opts);
  }
  if (typeof obj === "function") {
    if (typeof obj.__contract === "undefined")
      throw new Error("auto_test: no contract found");
    const contr = get_arguments_returns(obj.__contract);
    if (isPromise(contr)) return auto_test_fun_async(obj, contr, opts);
    else return auto_test_fun(obj, contr, opts);
  }
};
