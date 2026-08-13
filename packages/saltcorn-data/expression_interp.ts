import { parse } from "acorn";

const hasOwn = Object.prototype.hasOwnProperty;

/** Property names that lead to the Function constructor. */
const DENIED_PROPERTIES = new Set(["constructor", "__proto__", "prototype"]);

/**
 * `Object` is exposed only through these. Its reflection API is not safe here:
 * `Object.getOwnPropertyDescriptor(Object.getPrototypeOf(f), 'constructor')
 * .value` yields the Function constructor without ever naming `constructor` in
 * a member access.
 */
const SAFE_OBJECT: Record<string, any> = {
  keys: Object.keys,
  values: Object.values,
  entries: Object.entries,
  assign: Object.assign,
  fromEntries: Object.fromEntries,
  freeze: Object.freeze,
  isFrozen: Object.isFrozen,
  hasOwn: (Object as any).hasOwn,
};

/** Intrinsics vm2 exposes in its sandbox that expressions legitimately use. */
const SAFE_GLOBALS: Record<string, any> = {
  Math,
  JSON,
  String,
  Number,
  Boolean,
  Array,
  Object: SAFE_OBJECT,
  Date,
  RegExp,
  Error,
  Map,
  Set,
  Intl,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  encodeURIComponent,
  decodeURIComponent,
  encodeURI,
  decodeURI,
  NaN,
  Infinity,
  undefined,
};

/** Names the interpolate sandbox blanks out: undefined rather than an error. */
const BLANKED_GLOBALS = new Set([
  "global",
  "globalThis",
  "process",
  "require",
  "module",
]);

/** So that a binding whose value is `undefined` still resolves. */
const NOT_FOUND: unique symbol = Symbol("not_found");

/**
 * `vars` holds per-evaluation bindings (row fields, `row`, `user`); `globals`
 * holds the stable eval_context, so callers can rebuild `vars` per row without
 * re-spreading it.
 */
export class Scope {
  vars: Record<string, any>;
  globals: Record<string, any>;
  parent?: Scope;

  constructor(
    vars: Record<string, any>,
    globals: Record<string, any> = {},
    parent?: Scope
  ) {
    this.vars = vars;
    this.globals = globals;
    this.parent = parent;
  }

  lookup(name: string): any {
    let s: Scope | undefined = this;
    while (s) {
      if (hasOwn.call(s.vars, name)) return s.vars[name];
      s = s.parent;
    }
    if (hasOwn.call(this.globals, name)) return this.globals[name];
    if (hasOwn.call(SAFE_GLOBALS, name)) return SAFE_GLOBALS[name];
    if (BLANKED_GLOBALS.has(name)) return undefined;
    return NOT_FOUND;
  }

  child(vars: Record<string, any>): Scope {
    return new Scope(vars, this.globals, this);
  }
}

export type CompiledExpression = (scope: Scope) => any;

const unsupported = (what: string): never => {
  throw new Error(`unsupported: ${what}`);
};

/**
 * True for a host global we deliberately withhold (Reflect, Promise, console, ...).
 * Those exist in the vm2 sandbox, so evaluating one here would be a
 * ReferenceError where the VM succeeds - hand the expression to the VM instead.
 * Decided at compile time: falling back mid-evaluation would re-run any
 * function the expression had already called.
 *
 * Own property only; `in` would also match `toString` and friends.
 */
const isWithheldGlobal = (name: string) =>
  !hasOwn.call(SAFE_GLOBALS, name) &&
  !BLANKED_GLOBALS.has(name) &&
  hasOwn.call(globalThis, name);

const checkPropertyName = (name: string) => {
  if (DENIED_PROPERTIES.has(name)) unsupported(`property ${name}`);
};

/** Withheld SAFE_OBJECT members must fall back, not fail as "not a function". */
const checkObjectStatic = (objectNode: any, prop: string) => {
  if (
    objectNode.type === "Identifier" &&
    objectNode.name === "Object" &&
    !hasOwn.call(SAFE_OBJECT, prop)
  )
    unsupported(`Object.${prop}`);
};

/** Last line of defence, whatever route the value arrived by. */
const guard = (v: any): any => {
  if (v === Function)
    throw new Error("Access to the Function constructor is not allowed");
  return v;
};

/** Property read with the denied names refused, including computed keys. */
const getMember = (obj: any, key: any): any => {
  const name = typeof key === "symbol" ? key : String(key);
  if (typeof name === "string" && DENIED_PROPERTIES.has(name))
    throw new Error(`Access to '${name}' is not allowed`);
  return guard(obj[name as any]);
};

const BINARY_OPS: Record<string, (a: any, b: any) => any> = {
  "+": (a, b) => a + b,
  "-": (a, b) => a - b,
  "*": (a, b) => a * b,
  "/": (a, b) => a / b,
  "%": (a, b) => a % b,
  "**": (a, b) => a ** b,
  "==": (a, b) => a == b,
  "!=": (a, b) => a != b,
  "===": (a, b) => a === b,
  "!==": (a, b) => a !== b,
  "<": (a, b) => a < b,
  "<=": (a, b) => a <= b,
  ">": (a, b) => a > b,
  ">=": (a, b) => a >= b,
  "&": (a, b) => a & b,
  "|": (a, b) => a | b,
  "^": (a, b) => a ^ b,
  "<<": (a, b) => a << b,
  ">>": (a, b) => a >> b,
  ">>>": (a, b) => a >>> b,
  in: (a, b) => a in b,
  instanceof: (a, b) => a instanceof b,
};

/** Spread is not supported anywhere; such expressions fall back to the VM. */
const compileList = (nodes: any[]): CompiledExpression[] =>
  nodes.map((n) => {
    if (!n || n.type === "SpreadElement") unsupported("spread");
    return compileNode(n);
  });

const compileNode = (node: any): CompiledExpression => {
  switch (node.type) {
    case "Literal": {
      const v = node.value;
      return () => v;
    }

    case "TemplateLiteral": {
      const quasis = node.quasis.map((q: any) => q.value.cooked);
      const exprs = node.expressions.map(compileNode);
      return (scope) => {
        let out = quasis[0];
        for (let i = 0; i < exprs.length; i++)
          out += String(exprs[i](scope)) + quasis[i + 1];
        return out;
      };
    }

    case "Identifier": {
      const name = node.name;
      if (isWithheldGlobal(name)) unsupported(`global ${name}`);
      return (scope) => {
        const v = scope.lookup(name);
        if (v === NOT_FOUND) throw new ReferenceError(`${name} is not defined`);
        return v;
      };
    }

    case "ChainExpression":
      return compileNode(node.expression);

    case "MemberExpression": {
      const obj = compileNode(node.object);
      const optional = !!node.optional;
      if (node.computed) {
        const key = compileNode(node.property);
        return (scope) => {
          const o = obj(scope);
          if (optional && (o === null || o === undefined)) return undefined;
          return getMember(o, key(scope));
        };
      }
      const name = node.property.name;
      checkPropertyName(name);
      checkObjectStatic(node.object, name);
      return (scope) => {
        const o = obj(scope);
        if (optional && (o === null || o === undefined)) return undefined;
        return guard(o[name]);
      };
    }

    case "CallExpression": {
      const args = compileList(node.arguments);
      const optional = !!node.optional;
      const callee =
        node.callee.type === "ChainExpression"
          ? node.callee.expression
          : node.callee;
      // method call: `this` stays bound, and the object is evaluated once
      if (callee.type === "MemberExpression") {
        const objFn = compileNode(callee.object);
        const objOptional = !!callee.optional;
        const keyFn = callee.computed ? compileNode(callee.property) : null;
        const name = callee.computed ? null : callee.property.name;
        if (name !== null) {
          checkPropertyName(name);
          checkObjectStatic(callee.object, name);
        }
        return (scope) => {
          const o = objFn(scope);
          if (objOptional && (o === null || o === undefined)) return undefined;
          const fn = keyFn ? getMember(o, keyFn(scope)) : guard(o[name!]);
          if (optional && (fn === null || fn === undefined)) return undefined;
          if (typeof fn !== "function")
            throw new TypeError(`${name ?? "expression"} is not a function`);
          // guarded: `[Function].find(v => v)` yields it with no property read
          return guard(
            fn.apply(
              o,
              args.map((a) => a(scope))
            )
          );
        };
      }
      const calleeFn = compileNode(callee);
      return (scope) => {
        const fn = guard(calleeFn(scope));
        if (optional && (fn === null || fn === undefined)) return undefined;
        if (typeof fn !== "function") throw new TypeError("not a function");
        return guard(fn(...args.map((a) => a(scope))));
      };
    }

    case "NewExpression": {
      const calleeFn = compileNode(node.callee);
      const args = compileList(node.arguments);
      return (scope) => {
        const C = guard(calleeFn(scope));
        if (typeof C !== "function") throw new TypeError("not a constructor");
        return guard(new C(...args.map((a) => a(scope))));
      };
    }

    case "ConditionalExpression": {
      const test = compileNode(node.test);
      const cons = compileNode(node.consequent);
      const alt = compileNode(node.alternate);
      return (scope) => (test(scope) ? cons(scope) : alt(scope));
    }

    case "LogicalExpression": {
      const left = compileNode(node.left);
      const right = compileNode(node.right);
      switch (node.operator) {
        case "&&":
          return (scope) => left(scope) && right(scope);
        case "||":
          return (scope) => left(scope) || right(scope);
        case "??":
          return (scope) => left(scope) ?? right(scope);
        default:
          return unsupported(`operator ${node.operator}`);
      }
    }

    case "BinaryExpression": {
      const left = compileNode(node.left);
      const right = compileNode(node.right);
      const op = BINARY_OPS[node.operator];
      if (!op) unsupported(`operator ${node.operator}`);
      return (scope) => op(left(scope), right(scope));
    }

    case "UnaryExpression": {
      // `typeof someUndeclared` must not throw, so it needs the raw lookup
      if (node.operator === "typeof" && node.argument.type === "Identifier") {
        const name = node.argument.name;
        if (isWithheldGlobal(name)) unsupported(`typeof ${name}`);
        return (scope) => {
          const v = scope.lookup(name);
          return v === NOT_FOUND ? "undefined" : typeof v;
        };
      }
      const arg = compileNode(node.argument);
      switch (node.operator) {
        case "-":
          return (scope) => -arg(scope);
        case "+":
          return (scope) => +arg(scope);
        case "!":
          return (scope) => !arg(scope);
        case "~":
          return (scope) => ~arg(scope);
        case "typeof":
          return (scope) => typeof arg(scope);
        case "void":
          return (scope) => void arg(scope);
        default:
          return unsupported(`operator ${node.operator}`);
      }
    }

    case "ArrayExpression": {
      const elems = compileList(node.elements);
      return (scope) => elems.map((e) => e(scope));
    }

    case "ObjectExpression": {
      const props = node.properties.map((p: any) => {
        if (p.type !== "Property" || p.kind !== "init" || p.method)
          unsupported("object property");
        const value = compileNode(p.value);
        if (p.computed) return { computed: compileNode(p.key), value };
        const key =
          p.key.type === "Identifier" ? p.key.name : String(p.key.value);
        checkPropertyName(key);
        return { key, value };
      });
      return (scope) => {
        const out: Record<string, any> = {};
        for (const p of props) {
          if (p.computed) {
            const k = String(p.computed(scope));
            if (DENIED_PROPERTIES.has(k))
              throw new Error(`Access to '${k}' is not allowed`);
            out[k] = p.value(scope);
          } else out[p.key!] = p.value(scope);
        }
        return out;
      };
    }

    case "ArrowFunctionExpression": {
      if (node.async || node.generator) unsupported("async arrow");
      if (node.body.type === "BlockStatement") unsupported("arrow block body");
      const params: string[] = node.params.map((p: any) =>
        p.type === "Identifier" ? p.name : unsupported("destructured param")
      );
      const body = compileNode(node.body);
      return (scope) =>
        (...callArgs: any[]) => {
          const vars: Record<string, any> = {};
          for (let i = 0; i < params.length; i++) vars[params[i]] = callArgs[i];
          return body(scope.child(vars));
        };
    }

    default:
      // assignment, update, function expressions, `this`, await, ... use the VM
      return unsupported(`node type ${node.type}`);
  }
};

const cache = new Map<string, CompiledExpression | null>();

/** Escape hatch: send every expression to the VM. Used by the render benchmark. */
const disabled = !!process.env.SALTCORN_DISABLE_EXPR_INTERP;

/**
 * Compile an expression to a closure, or null if it is outside the supported
 * subset and the caller should use the VM.
 */
export function compileExpression(source: string): CompiledExpression | null {
  if (disabled) return null;
  const cached = cache.get(source);
  if (cached !== undefined) return cached;

  let compiled: CompiledExpression | null = null;
  try {
    const prog = parse(`(${source})`, { ecmaVersion: 2020, locations: false });
    if (prog.body.length === 1 && prog.body[0].type === "ExpressionStatement")
      compiled = compileNode(prog.body[0].expression);
  } catch {
    compiled = null;
  }

  if (cache.size >= 5000) cache.clear();
  cache.set(source, compiled);
  return compiled;
}

export function clearExpressionCache() {
  cache.clear();
}
