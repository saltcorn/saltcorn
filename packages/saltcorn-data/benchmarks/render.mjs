/**
 * Times rendering a List view four ways (issue #4298). All four render the same
 * cells; as_text evaluates nothing, so the difference from it is the cost of
 * evaluating expressions.
 *
 *   NODE_ENV=test PGDATABASE=saltcorn_test npm run bench:render
 *
 * Env: BENCH_ROWS, BENCH_COLS, BENCH_ITERS.
 */

// reset_schema() DROPS the schema it runs in, so keep to one of our own unless
// told otherwise - or running this wipes the test database
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

await db.close();
