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
    if (!db.isSQLite) {
      const tf = await db.selectOne("_sc_tables", {
        name: { in: ["myothertable", "nosuchtable"] },
      });

      expect(tf.name).toStrictEqual("myothertable");
    }
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
      runWithTenant("public", async () => {
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
      runWithTenant("public", async () => {
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
