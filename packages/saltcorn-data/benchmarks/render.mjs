/**
 * Render benchmark for expression evaluation (issue #4298).
 *
 * Renders a List view several ways, so the cost of evaluating expressions can
 * be separated from the cost of rendering markup:
 *
 *   as_text            no expression evaluation at all - the control
 *   show_with_html     one {{ }} token per cell   -> interpolate()
 *   cell_css_formula   one formula per cell       -> eval_expression()
 *   FormulaValue       one formula per cell       -> eval_expression()
 *
 * Usage, from packages/saltcorn-data (needs a database, as the tests do):
 *
 *   NODE_ENV=test PGDATABASE=saltcorn_test npm run bench:render
 *
 * Options (environment):
 *   BENCH_ROWS=15  BENCH_COLS=13  BENCH_ITERS=20
 *
 * reset_schema() below DROPS the schema it runs in, so this keeps to a schema
 * of its own unless SALTCORN_DEFAULT_SCHEMA names one - otherwise running the
 * benchmark wipes the test database, extensions included.
 */
process.env.SALTCORN_DEFAULT_SCHEMA =
  process.env.SALTCORN_DEFAULT_SCHEMA || "bench_render";

const ROWS = +(process.env.BENCH_ROWS || 25);
const COLS = +(process.env.BENCH_COLS || 18);
const ITERS = +(process.env.BENCH_ITERS || 20);
const CELLS = ROWS * COLS;

const { default: db } = await import("../dist/db/index.js");
const { getState } = await import("../dist/db/state.js");
const { default: basePlugin } = await import("../dist/base-plugin/index.js");
const { default: resetSchema } = await import("../dist/db/reset_schema.js");
const { default: Table } = await import("../dist/models/table.js");
const { default: Field } = await import("../dist/models/field.js");
const { default: View } = await import("../dist/models/view.js");
const { mockReqRes } = await import("../dist/tests/mocks.js");

getState().registerPlugin("base", basePlugin);
await resetSchema();

const table = await Table.create("benchtbl");
for (let i = 0; i < COLS; i++)
  await Field.create({
    table,
    name: `col${i}`,
    label: `Col ${i}`,
    type: "String",
    required: false,
  });
for (let r = 0; r < ROWS; r++) {
  const row = {};
  for (let i = 0; i < COLS; i++) row[`col${i}`] = `r${r}c${i}`;
  await table.insertRow(row);
}

const mkView = (name, columns) =>
  View.create({
    viewtemplate: "List",
    description: "",
    min_role: 100,
    name,
    table_id: table.id,
    default_render_page: "",
    slug: { label: "", steps: [] },
    attributes: {},
    configuration: { columns, default_state: { _rows_per_page: ROWS } },
  });

const fieldCols = (extra) =>
  Array.from({ length: COLS }, (_, i) => ({
    type: "Field",
    field_name: `col${i}`,
    fieldview: "as_text",
    ...extra(i),
  }));

const views = {
  as_text: await mkView(
    "bench_as_text",
    fieldCols(() => ({}))
  ),
  show_with_html: await mkView(
    "bench_html",
    fieldCols(() => ({
      fieldview: "show_with_html",
      code: `<span class="c">{{ it }}</span>`,
    }))
  ),
  cell_css_formula: await mkView(
    "bench_css",
    fieldCols((i) => ({ cell_css_formula: `col${i} ? "bg-light" : ""` }))
  ),
  FormulaValue: await mkView(
    "bench_formula",
    Array.from({ length: COLS }, (_, i) => ({
      type: "FormulaValue",
      formula: `col${i}`,
      header_label: `Col ${i}`,
    }))
  ),
};

const req = { ...mockReqRes.req, user: { id: 1, role_id: 1 } };
const run = (v) => v.run({}, { req, res: mockReqRes.res });

// the control and the expression views must render the same number of cells,
// otherwise the difference is not measuring what it claims to
const cells = (s) => (String(s).match(/<td/g) || []).length;
for (const [name, view] of Object.entries(views)) {
  const n = cells(await run(view));
  if (n !== CELLS)
    throw new Error(`${name} rendered ${n} cells, expected ${CELLS}`);
}

// ---------------------------------------------------------------------------
// The "before" for comparison. This is what the code did prior to the fix: a
// fresh VM built for every evaluation, with the values put in its sandbox.
// It lives here rather than behind a flag in the product, so the old cost can
// still be measured without keeping the old code around.
// ---------------------------------------------------------------------------
const { VM } = await import("vm2");
const evaluator = getState().evaluator;
const currentEvaluate = evaluator.evaluate.bind(evaluator);

const legacyEvaluate = (expression, context = {}) =>
  new VM({
    sandbox: {
      ...evaluator.globals,
      global: undefined,
      globalThis: undefined,
      process: undefined,
      require: undefined,
      module: undefined,
      Function: undefined,
      ...context,
    },
    eval: false,
    wasm: false,
    timeout: 200,
  }).run(`(${expression})`);

const time = async (view) => {
  for (let i = 0; i < 5; i++) await run(view); // warm up
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < ITERS; i++) await run(view);
  return Number(process.hrtime.bigint() - t0) / 1e6 / ITERS;
};

console.log(
  `\nrendering a List view: ${ROWS} rows x ${COLS} cols = ${CELLS} cells, ` +
    `${ITERS} renders each\n`
);

const results = {};
for (const [name, view] of Object.entries(views)) {
  evaluator.evaluate = legacyEvaluate;
  const before = await time(view);
  evaluator.evaluate = currentEvaluate;
  const after = await time(view);
  results[name] = { before, after };
}

const pad = (s, n) => String(s).padEnd(n);
console.log(
  `${pad("", 22)}${"a VM per eval".padStart(14)}${"reused VM".padStart(12)}`
);
console.log("-".repeat(48));
for (const [name, r] of Object.entries(results))
  console.log(
    `${pad(name, 22)}${r.before.toFixed(2).padStart(11)} ms${r.after.toFixed(2).padStart(9)} ms`
  );

console.log("\nper-cell cost of evaluating, over the as_text control:");
for (const [name, r] of Object.entries(results)) {
  if (name === "as_text") continue;
  const us = (t) => ((t - results.as_text.after) * 1000) / CELLS;
  console.log(
    `  ${pad(name, 20)}${us(r.before).toFixed(0).padStart(6)} us ->` +
      `${us(r.after).toFixed(1).padStart(7)} us   ` +
      `${(us(r.before) / us(r.after)).toFixed(0)}x`
  );
}
console.log("");

await db.close();
