import { runWithTenant } from "@saltcorn/db-common/multi-tenant";
import db from "../db/index.js";
import { assertIsSet } from "./assertions.js";
import {
  afterAll,
  describe,
  it,
  expect,
  beforeAll,
  jest,
} from "@saltcorn/db-common/test_expect";

import Table from "../models/table.js";
import Field from "../models/field.js";
import resetSchemaMod from "../db/reset_schema.js";
import fixturesMod from "../db/fixtures.js";
afterAll(db.close);
beforeAll(async () => {
  await resetSchemaMod();
  await fixturesMod();
});
jest.setTimeout(30000);

describe("where", () => {
  it("should support in", async () => {
    await Table.create("myothertable");
    const tf = await db.selectOne("_sc_tables", {
      name: { in: ["myothertable", "nosuchtable"] },
    });

    expect(tf.name).toStrictEqual("myothertable");
  });

  it("should support ilike", async () => {
    const tf = await db.selectOne("_sc_tables", {
      name: { ilike: "yothertabl" },
    });

    expect(tf.name).toStrictEqual("myothertable");
  });

  it("should  count", async () => {
    const tbls = await db.count("_sc_tables", {
      name: { ilike: "yothertabl" },
    });

    expect(tbls).toStrictEqual(1);
  });
});

describe("Transaction test", () => {
  if (!db.isSQLite)
    it("should insert", async () => {
      const books = Table.findOne({ name: "books" })!;
      assertIsSet(books);
      await runWithTenant(db.getTenantSchema(), async () => {
        await db.withTransaction(async () => {
          await books.insertRow({ author: "Trans Rights", pages: 688 });
        });
      });
      const b = await books.getRow({ author: "Trans Rights" });
      expect(b!.pages).toBe(688);
    });
  if (!db.isSQLite)
    it("should cancel", async () => {
      const books = Table.findOne({ name: "books" })!;
      assertIsSet(books);
      await runWithTenant(db.getTenantSchema(), async () => {
        await db.withTransaction(
          async () => {
            await books.insertRow({ author: "JK Rowling", pages: 684 });
            throw new Error("foo");
          },
          async (e: Error) => {}
        );
        const b = await books.getRow({ author: "JK Rowling" });
        expect(b).toBeNull();
      });
    });
});

describe("delete where test", () => {
  const existingRows = [
    { id: 1, author: "Herman Melville", pages: 967, publisher: null },
    { id: 2, author: "Leo Tolstoy", pages: 728, publisher: 1 },
    { id: 3, author: "Trans Rights", pages: 688, publisher: null },
  ];

  beforeAll(async () => {
    const books = Table.findOne({ name: "books" })!;
    assertIsSet(books);
    const rows = await books.getRows();
    if (rows.length === 2) {
      await books.insertRow(existingRows[2]);
    }
  });

  it("should delete where", async () => {
    const books = Table.findOne({ name: "books" })!;
    assertIsSet(books);
    await books.insertRow({ author: "Crime and Punishment", pages: 688 });
    await books.insertRow({ author: "For Whom the Bell Tolls", pages: 401 });
    let rows = await books.getRows();
    expect(rows.length).toBe(5);
    await db.deleteWhere(books.name, { author: "The Gambler" });
    rows = await books.getRows();
    expect(rows.length).toBe(5);
    await db.deleteWhere(books.name, { author: "Crime and Punishment" });
    rows = await books.getRows();
    expect(rows.length).toBe(4);

    await db.deleteWhere(books.name, {
      not: { or: existingRows.map((r) => ({ author: r.author })) },
    });
    rows = await books.getRows();
    expect(rows.length).toBe(3);
  });

  it("should delete where with not in", async () => {
    const books = Table.findOne({ name: "books" })!;
    assertIsSet(books);
    await books.insertRow({ author: "Crime and Punishment", pages: 688 });
    await books.insertRow({ author: "For Whom the Bell Tolls", pages: 401 });
    await books.insertRow({ author: "The Gambler", pages: 501 });
    await books.insertRow({ author: "The Idiot", pages: 601 });
    let rows = await books.getRows();
    expect(rows.length).toBe(7);

    await db.deleteWhere(books.name, {
      author: {
        not: {
          in: [
            "Crime and Punishment",
            "For Whom the Bell Tolls",
            "The Gambler",
            "The Idiot",
            ...existingRows.map((r) => r.author),
          ],
        },
      },
    });
    rows = await books.getRows();
    expect(rows.length).toBe(7);
    await db.deleteWhere(books.name, {
      author: {
        not: {
          or: [
            {
              in: ["Crime and Punishment", "For Whom the Bell Tolls"],
            },
            { in: ["The Gambler", "The Idiot"] },
            { in: existingRows.map((r) => r.author) },
          ],
        },
      },
    });
    rows = await books.getRows();
    expect(rows.length).toBe(7);
    await db.deleteWhere(books.name, {
      author: {
        not: { in: ["The Gambler", ...existingRows.map((r) => r.author)] },
      },
    });
    rows = await books.getRows();
    expect(rows.length).toBe(4);
    await db.deleteWhere(books.name, {
      author: { not: { in: existingRows.map((r) => r.author) } },
    });
    rows = await books.getRows();
    expect(rows.length).toBe(3);
  });

  it("should delete where with in", async () => {
    const books = Table.findOne({ name: "books" })!;
    assertIsSet(books);
    await books.insertRow({ author: "Crime and Punishment", pages: 688 });
    await books.insertRow({ author: "For Whom the Bell Tolls", pages: 401 });
    await books.insertRow({ author: "The Gambler", pages: 501 });
    await books.insertRow({ author: "The Idiot", pages: 601 });
    let rows = await books.getRows();
    expect(rows.length).toBe(7);

    await db.deleteWhere(books.name, { author: { in: ["David Copperfield"] } });
    rows = await books.getRows();
    expect(rows.length).toBe(7);
    await db.deleteWhere(books.name, {
      author: { in: ["The Gambler", "The Idiot"] },
    });
    rows = await books.getRows();
    expect(rows.length).toBe(5);

    await db.deleteWhere(books.name, {
      author: {
        or: [
          { in: ["Crime and Punishment", "The Gambler"] },
          { in: ["For Whom the Bell Tolls", "The Idiot"] },
        ],
      },
    });
    rows = await books.getRows();
    expect(rows.length).toBe(3);
  });
});

describe("RLS CRUD enforcement", () => {
  if (db.isSQLite) return;

  const WRITER = { id: 201, role: 40 }; // role 40 = staff (min_role_write)
  const READER = { id: 202, role: 80 }; // role 80 = user  (min_role_read only)
  const PUBLIC = { id: 0, role: 100 }; // unauthenticated

  let table: Table;
  let writerRowId: number;
  let readerRowId: number;

  const asUser = (user: { id: number; role: number }, fn: () => Promise<any>) =>
    runWithTenant(
      {
        tenant: db.getTenantSchema(),
        req: { user: { id: user.id, role_id: user.role } },
      },
      () =>
        db.withTransaction(async () => {
          await db.query("SET LOCAL ROLE saltcorn_rls_tester");
          return fn();
        })
    );

  beforeAll(async () => {
    // Clean up any leftover from a previous failed run.
    const existing = Table.findOne({ name: "rls_crud_test" });
    if (existing) await existing.delete();

    const newTable = await Table.create("rls_crud_test");
    const ownerField = await Field.create({
      table: newTable,
      label: "Owner",
      name: "owner_id",
      type: "Integer",
      required: false,
    });
    await Field.create({
      table: newTable,
      label: "Name",
      name: "name",
      type: "String",
      required: false,
    });
    table = Table.findOne({ name: "rls_crud_test" })!;
    await table.update({
      min_role_read: 80,
      min_role_write: 40,
      ownership_field_id: ownerField.id,
      rls_enabled: true,
    });

    // Non-superuser role so RLS is enforced inside asUser transactions.
    // Superusers bypass FORCE ROW LEVEL SECURITY; SET LOCAL ROLE switches identity.
    await db.query(`DROP ROLE IF EXISTS saltcorn_rls_tester`);
    await db.query(`CREATE ROLE saltcorn_rls_tester NOSUPERUSER NOLOGIN`);
    const pfx = db.getTenantSchemaPrefix();
    await db.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ${pfx}"rls_crud_test" TO saltcorn_rls_tester`
    );
    const seqRef = `${pfx}"rls_crud_test_id_seq"`;
    await db.query(`GRANT USAGE ON SEQUENCE ${seqRef} TO saltcorn_rls_tester`);

    // Seed rows via pool (no GUC → role defaults to 1 = admin → sc_rls_elevated_write passes).
    writerRowId = await table.insertRow({
      owner_id: WRITER.id,
      name: "writer-owned",
    });
    readerRowId = await table.insertRow({
      owner_id: READER.id,
      name: "reader-owned",
    });
  });

  afterAll(async () => {
    await table.delete();
    await db.query(`DROP ROLE IF EXISTS saltcorn_rls_tester`);
  });

  // ── SELECT ────────────────────────────────────────────────────────────────

  it("writer sees all rows via sc_rls_elevated", async () => {
    const rows = await asUser(WRITER, () => table.getRows());
    expect(rows.map((r: any) => r.id)).toEqual(
      expect.arrayContaining([writerRowId, readerRowId])
    );
  });

  it("reader sees all rows via sc_rls_elevated", async () => {
    const rows = await asUser(READER, () => table.getRows());
    expect(rows.map((r: any) => r.id)).toEqual(
      expect.arrayContaining([writerRowId, readerRowId])
    );
  });

  it("public user sees no rows", async () => {
    const rows = await asUser(PUBLIC, () => table.getRows());
    expect(rows).toHaveLength(0);
  });

  // ── INSERT ────────────────────────────────────────────────────────────────

  it("writer can insert a row owned by anyone", async () => {
    const newId = await asUser(WRITER, async () => {
      const id = await table.insertRow({ owner_id: READER.id, name: "temp" });
      await table.deleteRows({ id });
      return id;
    });
    expect(newId).toBeDefined();
  });

  it("reader can insert a row they own", async () => {
    const newId = await asUser(READER, async () => {
      const id = await table.insertRow({
        owner_id: READER.id,
        name: "reader self-insert",
      });
      await table.deleteRows({ id });
      return id;
    });
    expect(newId).toBeDefined();
  });

  it("reader cannot insert a row owned by someone else", async () => {
    await expect(
      asUser(READER, () =>
        table.insertRow({ owner_id: WRITER.id, name: "reader forging owner" })
      )
    ).rejects.toThrow();
  });

  // ── UPDATE ────────────────────────────────────────────────────────────────

  it("writer can update any row", async () => {
    await asUser(WRITER, () =>
      table.updateRow({ name: "writer-updated" }, readerRowId)
    );
    const row = await table.getRow({ id: readerRowId });
    expect(row?.name).toBe("writer-updated");
  });

  it("reader can update their own row", async () => {
    await asUser(READER, () =>
      table.updateRow({ name: "reader-updated" }, readerRowId)
    );
    const row = await table.getRow({ id: readerRowId });
    expect(row?.name).toBe("reader-updated");
  });

  it("reader cannot update a row they do not own", async () => {
    const before = await table.getRow({ id: writerRowId });
    await asUser(READER, () =>
      table.updateRow({ name: "hacked" }, writerRowId)
    );
    const after = await table.getRow({ id: writerRowId });
    expect(after?.name).toBe(before?.name);
  });

  // ── DELETE ────────────────────────────────────────────────────────────────

  it("writer can delete any row", async () => {
    const tmpId = await table.insertRow({
      owner_id: READER.id,
      name: "to be deleted by writer",
    });
    await asUser(WRITER, () => table.deleteRows({ id: tmpId }));
    expect(await table.getRow({ id: tmpId })).toBeNull();
  });

  it("reader cannot delete a row they do not own (DELETE uses min_role_write, not min_role_read)", async () => {
    await asUser(READER, () => table.deleteRows({ id: writerRowId }));
    expect(await table.getRow({ id: writerRowId })).toBeTruthy();
  });

  it("reader can delete their own row", async () => {
    const tmpId = await table.insertRow({
      owner_id: READER.id,
      name: "reader-owned deletable",
    });
    await asUser(READER, () => table.deleteRows({ id: tmpId }));
    expect(await table.getRow({ id: tmpId })).toBeNull();
  });
});

describe("RLS policy structure", () => {
  if (db.isSQLite) return;

  let table: Table;

  beforeAll(async () => {
    const existing = Table.findOne({ name: "rls_policy_structure_test" });
    if (existing) await existing.delete();

    const newTable = await Table.create("rls_policy_structure_test");
    const ownerField = await Field.create({
      table: newTable,
      label: "Owner",
      name: "owner_id",
      type: "Integer",
      required: false,
    });
    table = Table.findOne({ name: "rls_policy_structure_test" })!;
    await table.update({
      min_role_read: 80,
      min_role_write: 40,
      ownership_field_id: ownerField.id,
      rls_enabled: true,
    });
    // Reload so rls_enabled reflects what was actually committed.
    table = Table.findOne({ name: "rls_policy_structure_test" })!;
  });

  afterAll(async () => {
    if (table) await table.delete();
  });

  it("persists rls_enabled=true after enableOwnershipRLS succeeds", () => {
    // If enableOwnershipRLS() threw (e.g. invalid policy syntax), the savepoint
    // would have rolled back and rls_enabled would still be false here.
    expect(table.rls_enabled).toBe(true);
  });

  it("enables and forces RLS on the pg_class row", async () => {
    const cls = await db.query(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1`,
      ["rls_policy_structure_test"]
    );
    expect(cls.rows[0]?.relrowsecurity).toBe(true);
    expect(cls.rows[0]?.relforcerowsecurity).toBe(true);
  });

  it("creates exactly the expected policies in pg_policies", async () => {
    const schema = db.getTenantSchema();
    const res = await db.query(
      `SELECT policyname, cmd
       FROM pg_catalog.pg_policies
       WHERE schemaname = $1 AND tablename = $2
       ORDER BY policyname`,
      [schema, "rls_policy_structure_test"]
    );
    const policies = res.rows.map((r: any) => ({
      name: r.policyname,
      cmd: r.cmd,
    }));
    // Verify the three write policies exist with the correct per-command scope.
    // The old single 'FOR INSERT, UPDATE, DELETE' policy was a PostgreSQL syntax
    // error — only one command keyword is allowed per CREATE POLICY.
    expect(policies).toEqual(
      expect.arrayContaining([
        { name: "sc_rls_elevated", cmd: "SELECT" },
        { name: "sc_rls_elevated_write_ins", cmd: "INSERT" },
        { name: "sc_rls_elevated_write_upd", cmd: "UPDATE" },
        { name: "sc_rls_elevated_write_del", cmd: "DELETE" },
        { name: "sc_rls_owner", cmd: "ALL" },
      ])
    );
    // The old combined policy must not exist.
    expect(policies.map((p: any) => p.name)).not.toContain(
      "sc_rls_elevated_write"
    );
  });

  it("sc_rls_owner USING clause references the ownership column and GUC", async () => {
    const schema = db.getTenantSchema();
    const qualRes = await db.query(
      `SELECT qual FROM pg_policies
       WHERE schemaname = $1 AND tablename = $2 AND policyname = 'sc_rls_owner'`,
      [schema, "rls_policy_structure_test"]
    );
    const qual: string = qualRes.rows[0]?.qual ?? "";
    expect(qual).toContain("owner_id");
    expect(qual).toContain("current_setting");
  });

  it("disableOwnershipRLS removes all policies and clears pg_class flags", async () => {
    await table.disableOwnershipRLS();
    const schema = db.getTenantSchema();
    const polRes = await db.query(
      `SELECT policyname FROM pg_catalog.pg_policies
       WHERE schemaname = $1 AND tablename = $2`,
      [schema, "rls_policy_structure_test"]
    );
    expect(polRes.rows).toHaveLength(0);
    const cls = await db.query(
      `SELECT relrowsecurity FROM pg_class WHERE relname = $1`,
      ["rls_policy_structure_test"]
    );
    expect(cls.rows[0]?.relrowsecurity).toBe(false);
  });
});
