import Table from "../models/table";
import db from "../db";

import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

const initSyncInfo = async (tbls: any) => {
  for (const tbl of tbls) {
    const books = Table.findOne({ name: tbl });
    if (books) {
      if (books.has_sync_info) await db.deleteWhere(`${tbl}_sync_info`, {});
      else {
        books.has_sync_info = true;
        await books.update(books);
      }
    }
  }
};

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

describe("Table sync info", () => {
  if (!db.isSQLite) {
    beforeAll(async () => {
      await initSyncInfo(["books", "publisher", "patients"]);
    });

    it("sets updated_field timestamp on row update", async () => {
      const table = Table.findOne({ name: "books" });
      await table?.updateRow({ author: "New Autor" }, 1);
      let resu = await db.query("SELECT * FROM books_sync_info ");
      expect(resu.rows.length).toBe(1);
      let updatedFields = resu.rows[0].updated_fields;
      expect(updatedFields).toBeDefined();
      expect(updatedFields.author).toBeDefined();
      expect(Object.keys(updatedFields).length).toBe(1);
      const authorTimestamp = new Date(updatedFields.author);
      expect(authorTimestamp).toBeInstanceOf(Date);

      await table?.updateRow({ pages: "200" }, 1);
      resu = await db.query("SELECT * FROM books_sync_info ");
      expect(resu.rows.length).toBe(1);
      updatedFields = resu.rows[0].updated_fields;
      expect(updatedFields).toBeDefined();
      expect(updatedFields.author).toBeDefined();
      expect(updatedFields.pages).toBeDefined();
      expect(Object.keys(updatedFields).length).toBe(2);
      const pagesTimestamp = new Date(updatedFields.pages);
      expect(pagesTimestamp).toBeInstanceOf(Date);
      expect(pagesTimestamp.getTime()).toBeGreaterThan(
        authorTimestamp.getTime()
      );
      expect(authorTimestamp.getTime()).toBe(
        new Date(updatedFields.author).getTime()
      );
    });
  } else
    it("only pq support", () => {
      expect(true).toBe(true);
    });
});
