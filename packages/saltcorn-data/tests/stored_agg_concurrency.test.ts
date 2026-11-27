import { runWithTenant } from "@saltcorn/db-common/multi-tenant";
import db from "../db/index.js";
import Table from "../models/table.js";
import Field from "../models/field.js";
import TableConstraint from "../models/table_constraints.js";
import resetSchemaMod from "../db/reset_schema.js";
import fixturesMod from "../db/fixtures.js";
import { sleep } from "./mocks.js";
import {
  afterAll,
  beforeAll,
  describe,
  it,
  expect,
  jest,
} from "@saltcorn/db-common/test_expect";

afterAll(db.close);
beforeAll(async () => {
  await resetSchemaMod();
  await fixturesMod();
});
jest.setTimeout(30000);

// two transactions each insert a child row. Without a lock on
// the parent, the second one computes the stored Sum before the first commits
// and then overwrites the parent with that out-of-date total.
describe("stored aggregations under concurrent writes", () => {
  // needs postgres row locks (and pg_stat_activity below)
  if (!db.supports_for_no_key_update) return;

  let accounts: Table;
  let ledger: Table;

  const inOwnTransaction = (fn: () => Promise<any>) =>
    runWithTenant({ tenant: db.getTenantSchema(), req: {} }, () =>
      db.withTransaction(fn)
    );

  // wait until some backend is blocked on a lock in a query on these tables
  const waitUntilBlocked = async () => {
    for (let i = 0; i < 100; i++) {
      const { rows } = await db.query(
        `select count(*)::int as n from pg_stat_activity
         where wait_event_type = 'Lock' and query ilike '%agg_lock_%'`
      );
      if (rows[0].n > 0) return;
      await sleep(50);
    }
    throw new Error("second transaction never blocked");
  };

  // t1 inserts and stays open; t2 inserts and blocks on the parent; then t1
  // commits. Resolves to the settled results of [t1, t2].
  const insertConcurrently = async (account: number, amount: number) => {
    let release!: () => void;
    const t1CanCommit = new Promise<void>((r) => (release = r));
    let t1Inserted!: () => void;
    const t1HasInserted = new Promise<void>((r) => (t1Inserted = r));

    const t1 = inOwnTransaction(async () => {
      await ledger.insertRow({ account, amount });
      t1Inserted();
      await t1CanCommit;
    });
    t1.then(t1Inserted, t1Inserted); // don't wait forever if t1 fails
    await t1HasInserted;
    const t2 = inOwnTransaction(async () => {
      await ledger.insertRow({ account, amount });
    });
    const settled = Promise.allSettled([t1, t2]);
    try {
      await waitUntilBlocked();
    } finally {
      release(); // always let t1 commit, or the test hangs
    }
    return await settled;
  };

  const realSum = async (account: number) =>
    (await ledger.getRows({ account })).reduce((s, r) => s + r.amount, 0);

  beforeAll(async () => {
    const accTable = await Table.create("agg_lock_accounts");
    await Field.create({ table: accTable, label: "Name", type: "String" });
    const ledgerTable = await Table.create("agg_lock_ledger");
    await Field.create({
      table: ledgerTable,
      label: "Account",
      type: "Key to agg_lock_accounts",
    });
    await Field.create({ table: ledgerTable, label: "Amount", type: "Integer" });
    await Field.create({
      table: accTable,
      label: "Balance",
      type: "Integer",
      calculated: true,
      stored: true,
      expression: "__aggregation",
      attributes: {
        aggregate: "Sum",
        aggwhere: "",
        agg_field: "amount@Integer",
        agg_relation: "agg_lock_ledger.account",
        table: "agg_lock_ledger",
        ref: "account",
      },
    });
    accounts = Table.findOne({ name: "agg_lock_accounts" })!;
    ledger = Table.findOne({ name: "agg_lock_ledger" })!;
  });

  it("keeps the stored sum correct", async () => {
    const id = await accounts.insertRow({ name: "alice" });
    await ledger.insertRow({ account: id, amount: 100 });

    const results = await insertConcurrently(id, -10);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);

    expect(await realSum(id)).toBe(80);
    expect((await accounts.getRow({ id }))!.balance).toBe(80);
  });

  it("rejects an overspend with a balance constraint", async () => {
    await TableConstraint.create({
      table_id: accounts.id,
      type: "Formula",
      configuration: {
        formula: "balance >= 0",
        errormsg: "Insufficient balance",
      },
    });
    accounts = Table.findOne({ name: "agg_lock_accounts" })!;
    const id = await accounts.insertRow({ name: "bob" });
    await ledger.insertRow({ account: id, amount: 100 });

    const results = await insertConcurrently(id, -60);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);

    expect(await realSum(id)).toBe(40);
    expect((await accounts.getRow({ id }))!.balance).toBe(40);
  });
});
