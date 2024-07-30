/*global document*/
var iFrame = null;

var indexOf = function (xs, item) {
  if (xs.indexOf) return xs.indexOf(item);
  else
    for (var i = 0; i < xs.length; i++) {
      if (xs[i] === item) return i;
    }
  return -1;
};
var Object_keys = function (obj) {
  if (Object.keys) return Object.keys(obj);
  else {
    var res = [];
    for (var key in obj) res.push(key);
    return res;
  }
};

var forEach = function (xs, fn) {
  if (xs.forEach) return xs.forEach(fn);
  else
    for (var i = 0; i < xs.length; i++) {
      fn(xs[i], i, xs);
    }
};

var defineProp = (function () {
  try {
    Object.defineProperty({}, "_", {});
    return function (obj, name, value) {
      Object.defineProperty(obj, name, {
        writable: true,
        enumerable: false,
        configurable: true,
        value: value,
      });
    };
  } catch (e) {
    return function (obj, name, value) {
      obj[name] = value;
    };
  }
})();

var globals = [
  "Array",
  "Boolean",
  "Date",
  "Error",
  "EvalError",
  "Function",
  "Infinity",
  "JSON",
  "Math",
  "NaN",
  "Number",
  "Object",
  "RangeError",
  "ReferenceError",
  "RegExp",
  "String",
  "SyntaxError",
  "TypeError",
  "URIError",
  "decodeURI",
  "decodeURIComponent",
  "encodeURI",
  "encodeURIComponent",
  "escape",
  "eval",
  "isFinite",
  "isNaN",
  "parseFloat",
  "parseInt",
  "undefined",
  "unescape",
];

function Context() {}
Context.prototype = {};

var Script = (exports.Script = function NodeScript(code) {
  if (!(this instanceof Script)) return new Script(code);

  if (!iFrame) {
    iFrame = document.createElement("iframe");
    if (!iFrame.style) iFrame.style = {};
    iFrame.style.display = "none";

    document.body.appendChild(iFrame);
  }

  this.code = code;
  this.iFrame = iFrame;
});

Script.prototype.runInContext = function (context) {
  if (!(context instanceof Context)) {
    throw new TypeError("needs a 'context' argument.");
  }

  var win = this.iFrame.contentWindow;
  var winOriginal = Object_keys(win);
  let originalToRestore = [];
  var wEval = win.eval,
    wExecScript = win.execScript;

  if (!wEval && wExecScript) {
    // win.eval() magically appears when this is called in IE:
    wExecScript.call(win, "null");
    wEval = win.eval;
  }

  forEach(Object_keys(context), function (key) {
    if (win[key] !== undefined) {
      let restore = {
        key: key,
        value: win[key],
      };
      originalToRestore.push(restore);
    }
    win[key] = context[key];
  });

  var winKeys = Object_keys(win);

  var res;
  try {
    res = wEval.call(win, this.code);
  } finally {
    forEach(Object_keys(win), function (key) {
      // Avoid copying circular objects like `top` and `window` by only
      // updating existing context properties or new properties in the `win`
      // that was only introduced after the eval.
      if (key in context || indexOf(winKeys, key) === -1) {
        context[key] = win[key];
      }
    });

    forEach(globals, function (key) {
      if (!(key in context)) {
        defineProp(context, key, win[key]);
      }
    });

    // remove new properties from `win`
    forEach(Object_keys(win), function (key) {
      if (indexOf(winOriginal, key) === -1) delete win[key];
    });

    // restore overwritten window vars to original values
    forEach(originalToRestore, function (orig) {
      win[orig.key] = orig.value;
    });
  }
  return res;
};

Script.prototype.runInThisContext = function () {
  return eval(this.code); // maybe...
};

Script.prototype.runInNewContext = function (context) {
  var ctx = Script.createContext(context);
  var res = this.runInContext(ctx);

  if (context) {
    forEach(Object_keys(ctx), function (key) {
      context[key] = ctx[key];
    });
  }

  return res;
};

forEach(Object_keys(Script.prototype), function (name) {
  exports[name] = Script[name] = function (code) {
    var s = Script(code);
    return s[name].apply(s, [].slice.call(arguments, 1));
  };
});

exports.isContext = function (context) {
  return context instanceof Context;
};

exports.createScript = function (code) {
  return exports.Script(code);
};

exports.createContext = Script.createContext = function (context) {
  var copy = new Context();
  if (typeof context === "object") {
    forEach(Object_keys(context), function (key) {
      copy[key] = context[key];
    });
  }
  return copy;
};
