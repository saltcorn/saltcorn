/**
 * Render benchmark for expression evaluation (issue #4298).
 *
 * Two parts.
 *
 * 1. What a List view costs to render today, broken down by how its cells are
 *    produced, so the cost of evaluating expressions is separated from the cost
 *    of producing markup:
 *
 *      as_text            no expression evaluation at all - the control
 *      show_with_html     one {{ }} token per cell   -> interpolate()
 *      cell_css_formula   one formula per cell       -> eval_expression()
 *      FormulaValue       one formula per cell       -> eval_expression()
 *
 * 2. Where that cost comes from: the same number of evaluations run directly
 *    against vm2, once building a VM per evaluation (what the code does today)
 *    and once reusing a VM with the expression compiled to a function. This
 *    needs nothing from the product, so it measures the ceiling without
 *    depending on any particular fix.
 *
 * Usage, from packages/saltcorn-data (needs a database, as the tests do):
 *
 *   NODE_ENV=test PGDATABASE=saltcorn_test npm run bench:render
 *
 * Options (environment):
 *   BENCH_ROWS=25  BENCH_COLS=18  BENCH_ITERS=20
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

const time = async (view) => {
  for (let i = 0; i < 5; i++) await run(view); // warm up
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < ITERS; i++) await run(view);
  return Number(process.hrtime.bigint() - t0) / 1e6 / ITERS;
};

const pad = (s, n) => String(s).padEnd(n);

console.log(
  `\nrendering a List view: ${ROWS} rows x ${COLS} cols = ${CELLS} cells, ` +
    `${ITERS} renders each\n`
);

const rendered = {};
for (const [name, view] of Object.entries(views)) rendered[name] = await time(view);

for (const [name, ms] of Object.entries(rendered))
  console.log(`  ${pad(name, 20)}${ms.toFixed(2).padStart(9)} ms/render`);

console.log("\n  cost of evaluating, per cell, over the as_text control:");
for (const [name, ms] of Object.entries(rendered)) {
  if (name === "as_text") continue;
  const us = ((ms - rendered.as_text) * 1000) / CELLS;
  console.log(`  ${pad(name, 20)}${us.toFixed(1).padStart(9)} us/cell`);
}

// ---------------------------------------------------------------------------
// 2. where that cost comes from
//
// The same number of evaluations, run straight against vm2. Nothing from the
// product is involved, so this measures the two strategies rather than any
// particular implementation of them.
// ---------------------------------------------------------------------------
const { VM } = await import("vm2");
const evalContext = getState().eval_context;
const blanked = {
  global: undefined,
  globalThis: undefined,
  process: undefined,
  require: undefined,
  module: undefined,
  Function: undefined,
};
const mkRow = (i) => {
  const row = {};
  for (let c = 0; c < COLS; c++) row[`col${c}`] = `r${i}c${c}`;
  return row;
};
const names = Object.keys(mkRow(0));

const micro = (label, f) => {
  for (let i = 0; i < 2; i++) f();
  const t0 = process.hrtime.bigint();
  const N = 5;
  for (let i = 0; i < N; i++) f();
  const per = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  console.log(
    `  ${pad(label, 40)}${per.toFixed(2).padStart(8)} ms   ` +
      `(${((per * 1000) / CELLS).toFixed(1)} us/cell)`
  );
  return per;
};

console.log(`\nevaluating one expression over ${CELLS} cells, vm2 directly\n`);

const perEval = micro("a new VM for every evaluation", () => {
  for (let c = 0; c < CELLS; c++) {
    const row = mkRow(c);
    new VM({
      sandbox: { ...evalContext, ...blanked, row, ...row },
      eval: false,
      wasm: false,
      timeout: 200,
    }).run("(col0)");
  }
});

const reused = micro("one VM, expression compiled once", () => {
  const vm = new VM({
    sandbox: { ...evalContext, ...blanked },
    eval: false,
    wasm: false,
  });
  const fn = vm.run(`((row, ${names.join(",")}) => (col0))`);
  for (let c = 0; c < CELLS; c++) {
    const row = mkRow(c);
    fn(row, ...names.map((n) => row[n]));
  }
});

// console.log(
//   `\n  building a VM per evaluation costs ${(perEval / reused).toFixed(0)}x ` +
//     `more than reusing one\n`
// );

await db.close();
