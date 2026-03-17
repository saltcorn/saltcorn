import { runWithTenant } from "@saltcorn/db-common/multi-tenant";
import db from "../db";
import { assertIsSet } from "./assertions";
import { afterAll, describe, it, expect, beforeAll, jest } from "@jest/globals";
const Table = require("../models/table");

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
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
      const books = Table.findOne({ name: "books" });
      assertIsSet(books);
      await runWithTenant("public", async () => {
        await db.withTransaction(async () => {
          await books.insertRow({ author: "Trans Rights", pages: 688 });
        });
      });
      const b = await books.getRow({ author: "Trans Rights" });
      expect(b.pages).toBe(688);
    });
  if (!db.isSQLite)
    it("should cancel", async () => {
      const books = Table.findOne({ name: "books" });
      assertIsSet(books);
      await runWithTenant("public", async () => {
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
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    const rows = await books.getRows();
    if (rows.length === 2) {
      await books.insertRow(existingRows[2]);
    }
  });

  it("should delete where", async () => {
    const books = Table.findOne({ name: "books" });
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
    const books = Table.findOne({ name: "books" });
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
    const books = Table.findOne({ name: "books" });
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
