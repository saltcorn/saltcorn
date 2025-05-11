import { runWithTenant } from "@saltcorn/db-common/multi-tenant";
import db from "../db";
import { assertIsSet } from "./assertions";
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
          (e: any) => {}
        );
        const b = await books.getRow({ author: "JK Rowling" });
        expect(b).toBeNull();
      });
    });
});

describe("delete where test", () => {
  it("should delete where", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    await books.insertRow({ author: "Crime and Punishment", pages: 688 });
    await books.insertRow({ author: "For Whom the Bell Tolls", pages: 401 });
    let rows = await books.getRows();
    expect(rows.length).toBe(4);
    await db.deleteWhere(books.name, { author: "The Gambler" });
    rows = await books.getRows();
    expect(rows.length).toBe(4);
    await db.deleteWhere(books.name, { author: "Crime and Punishment" });
    rows = await books.getRows();
    expect(rows.length).toBe(3);
    await db.deleteWhere(books.name, {
      not: { author: "For Whom the Bell Tolls" },
    });
    rows = await books.getRows();
    expect(rows.length).toBe(1);
    await db.deleteWhere(books.name);
    rows = await books.getRows();
    expect(rows.length).toBe(0);
  });

  it("should delete where with not in", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    await books.insertRow({ author: "Crime and Punishment", pages: 688 });
    await books.insertRow({ author: "For Whom the Bell Tolls", pages: 401 });
    await books.insertRow({ author: "The Gambler", pages: 501 });
    await books.insertRow({ author: "The Idiot", pages: 601 });
    let rows = await books.getRows();
    expect(rows.length).toBe(4);

    await db.deleteWhere(books.name, {
      author: {
        not: {
          in: [
            "Crime and Punishment",
            "For Whom the Bell Tolls",
            "The Gambler",
            "The Idiot",
          ],
        },
      },
    });
    rows = await books.getRows();
    expect(rows.length).toBe(4);
    await db.deleteWhere(books.name, {
      author: {
        not: {
          and: [
            {
              in: ["Crime and Punishment", "For Whom the Bell Tolls"],
            },
            { in: ["The Gambler", "The Idiot"] },
          ],
        },
      },
    });
    rows = await books.getRows();
    expect(rows.length).toBe(4);
    await db.deleteWhere(books.name, {
      author: { not: { in: ["The Gambler"] } },
    });
    rows = await books.getRows();
    expect(rows.length).toBe(1);
    await db.deleteWhere(books.name, { pages: { not: { in: [601] } } });
    rows = await books.getRows();
    expect(rows.length).toBe(0);
  });

  it("should delete where with in", async () => {
    const books = Table.findOne({ name: "books" });
    assertIsSet(books);
    await books.insertRow({ author: "Crime and Punishment", pages: 688 });
    await books.insertRow({ author: "For Whom the Bell Tolls", pages: 401 });
    await books.insertRow({ author: "The Gambler", pages: 501 });
    await books.insertRow({ author: "The Idiot", pages: 601 });
    let rows = await books.getRows();
    expect(rows.length).toBe(4);

    await db.deleteWhere(books.name, { author: { in: ["David Copperfield"] } });
    rows = await books.getRows();
    expect(rows.length).toBe(4);
    await db.deleteWhere(books.name, {
      author: { in: ["The Gambler", "The Idiot"] },
    });
    rows = await books.getRows();
    expect(rows.length).toBe(2);

    await db.deleteWhere(books.name, {
      author: {
        or: [
          { in: ["Crime and Punishment", "The Gambler"] },
          { in: ["For Whom the Bell Tolls", "The Idiot"] },
        ],
      },
    });
    rows = await books.getRows();
    expect(rows.length).toBe(0);
  });
});
