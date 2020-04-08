var stackTrace = require("stack-trace");
const check_contract = require("./check");
const {
  get_return_contract,
  get_arguments_returns,
  ContractViolation
} = require("./util.js");

const check_arguments = (
  arguments_contract_spec,
  args,
  contrDefinition,
  callSite
) => {
  const argsContract = Array.isArray(arguments_contract_spec)
    ? arguments_contract_spec
    : [arguments_contract_spec];
  argsContract.forEach((contr, ix) => {
    check_contract(
      contr,
      args[ix],
      `argument ${ix}`,
      contrDefinition,
      callSite
    );
  });
};

const argcheck = (pred, args, contrDefinition, callSite) => {
  if (!pred(...args)) {
    throw new ContractViolation(
      { name: "Argument check" },
      args,
      undefined,
      contrDefinition,
      callSite
    );
  }
};

const retcheck = (pred, args, rv, contrDefinition, callSite) => {
  if (!pred(...args)(rv)) {
    throw new ContractViolation(
      { name: "Return check" },
      { arguments: args, return: rv },
      undefined,
      contrDefinition,
      callSite
    );
  }
};

const contract_function = (fun, contr, that, check_vars, contrDefinition) => {
  function newf(...args) {
    const opts = get_arguments_returns(contr);
    if (opts.arguments)
      check_arguments(opts.arguments, args, contrDefinition, newf);
    if (opts.argcheck) argcheck(opts.argcheck, args, contrDefinition, newf);
    var rv = that ? fun.apply(that, args) : fun(...args);

    if (opts.returns) {
      check_contract(
        get_return_contract(opts.returns, args),
        rv,
        "return value",
        contrDefinition,
        newf
      );
      if (opts.returns.name === "promise") {
        var pr_rv = rv;
        rv = pr_rv.then(v => {
          check_contract(
            opts.returns.options,
            v,
            "promise value",
            contrDefinition,
            newf
          );
          return v;
        });
        //console.log("promise", rv, rv.then)
      }
    }
    if (opts.retcheck) retcheck(opts.retcheck, args, rv, contrDefinition, newf);

    if (check_vars) check_vars();
    return rv;
  }
  if (!that) newf.__contract = contr;
  return newf;
};

const contract_class = that => {
  const proto = Object.getPrototypeOf(that);
  const opts = proto.constructor.contract;

  const check_vars = () => {
    if (opts.variables) {
      Object.entries(opts.variables).forEach(([k, v]) => {
        check_contract(v, that[k], "instance variables");
      });
    }
  };

  check_vars();

  if (opts.methods) {
    Object.entries(opts.methods).forEach(([k, v]) => {
      const d = Object.getOwnPropertyDescriptor(proto, k);
      if (!d) throw new Error(`No method ${k} in ${proto.constructor.name}`);
      if (d.value) {
        const oldf = d.value;
        d.value = contract_function(oldf, v, that);
      } else if (d.get) {
        const oldf = d.get;
        d.get = contract_function(oldf, v, that);
      }

      Object.defineProperty(that, k, d);
    });
  }
};

var enabled = true;

function contract(opts, obj) {
  if (!enabled) return obj;
  var trace = stackTrace.get();
  var callert = trace.find(
    t => !t.getFileName().includes("contractis/contract.js")
  );
  var caller = `${callert.getFunctionName()} (${callert.getFileName()}:${callert.getLineNumber()})`;
  if (typeof obj === "function")
    return contract_function(obj, opts, null, null, caller);
  else {
    const theContract = opts;
    check_contract(theContract, obj, "value", caller, contract);
    return obj;
  }
}

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
