/**
 * Evaluates Saltcorn expressions and `{{ }}` interpolations.
 *
 * Expressions were previously run by building a new vm2 `VM` for every
 * evaluation. A VM costs around half a millisecond to construct - most of it
 * creating a V8 context and proxy-bridging the intrinsics - which a List view
 * pays once per cell (issue #4298).
 *
 * This keeps the VM instead. An expression is compiled once into a function
 * whose parameters are the names in scope, exactly as eval_expression already
 * wrote it:
 *
 *     ((row, name, age) => (expression))
 *
 * and each row is then just a call with arguments. Because the values arrive as
 * arguments, nothing is written to the shared sandbox, so one VM can serve every
 * row without evaluations interfering with each other.
 *
 * Lives on State (`getState().evaluator`) and is discarded whenever the
 * eval_context changes, so the sandbox cannot go stale.
 *
 * @category saltcorn-data
 * @module evaluator
 */

import { GenObj } from "@saltcorn/db-common/types";
import { VM } from "vm2";

/** Local copy: importing it from utils would make utils and this circular. */
const VALID_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const RESERVED = new Set([
  "arguments",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

/**
 * Names are interpolated into the function's parameter list, so anything that
 * is not a plain identifier has to be left out - both because it would not
 * parse and because it would be a way to inject code. Row fields with awkward
 * names (`foo->bar`) are reached through `row` instead, as they already were.
 */
const usableAsParam = (name: string) =>
  VALID_IDENTIFIER.test(name) && !RESERVED.has(name);

export class Evaluator {
  /** The stable bindings - the State eval_context - shared by every evaluation. */
  globals: GenObj;

  private vm?: InstanceType<typeof VM>;

  /**
   * Compiled expressions, keyed by parameter list and source. Unbounded:
   * expression text comes from view configuration, of which there is a small
   * fixed amount. Note that `{{= ... }}` re-interpolates its own output, so
   * template text can also come from table rows - if that is ever used at scale
   * this needs a cap.
   */
  private cache: Map<string, Function> = new Map();

  constructor(globals: GenObj = {}) {
    this.globals = globals;
  }

  /** The shared sandbox: the eval_context, with the host blanked out. */
  private getVM(): InstanceType<typeof VM> {
    // console.debug("********", { globals: this.globals, vm: this.vm });
    if (!this.vm)
      this.vm = new VM({
        sandbox: {
          ...this.globals,
          global: undefined,
          globalThis: undefined,
          process: undefined,
          require: undefined,
          module: undefined,
          Function: undefined,
        },
        eval: false,
        wasm: false,
      });
    return this.vm;
  }

  /**
   * Compile an expression against a set of names, so later `evaluate` calls
   * with the same names are only a function call.
   */
  compile(expression: string, names: string[] = []): Function {
    const params = names.filter(usableAsParam);
    const key = params.join(",") + "|" + expression;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const fn: Function = this.getVM().run(
      `((${params.join(",")}) => (${expression}))`
    );
    this.cache.set(key, fn);
    return fn;
  }

  /**
   * Evaluate `expression` with `context` in scope. Names not in `context` fall
   * through to the sandbox - the eval_context - and are a ReferenceError if
   * absent there too, as before.
   */
  evaluate(expression: string, context: GenObj = {}): any {
    const names = Object.keys(context).filter(usableAsParam);
    return this.compile(expression, names)(...names.map((n) => context[n]));
  }
}
