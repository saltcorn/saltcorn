import db from "../db";
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import Tag from "../models/tag";
import Table from "../models/table";
import View from "../models/view";
import Page from "../models/page";

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

describe("Tag IO", () => {
  let books: Table, patients: Table;
  let authorlist: View, authorshow: View;
  let pageA: Page;

  beforeAll(async () => {
    books = await Table.findOne({ name: "books" })!;
    patients = Table.findOne({ name: "books" })!;
    authorlist = await View.findOne({ name: "authorlist" })!;
    authorshow = await View.findOne({ name: "authorshow" })!;
    pageA = await Page.findOne({ name: "a_page" })!;
  });

  const compare = (actual: any, expected: any) => {
    if (!expected) expect(!actual).toBe(true);
    else expect(actual).toBe(expected);
  };

  const compareExpected = (entries: any, expectedIds: any) => {
    expect(entries).toBeDefined();
    expect(entries.length).toBe(expectedIds.length);
    for (let index = 0; index < entries.length; index++) {
      compare(entries[index].table_id, expectedIds[index][0]);
      compare(entries[index].view_id, expectedIds[index][1]);
      compare(entries[index].page_id, expectedIds[index][2]);
      compare(entries[index].trigger_id, expectedIds[index][3]);
    }
  };

  const testCreate = async (
    tagName: string,
    entryIds: any,
    expectedIds: any
  ) => {
    const tc = await Tag.create({
      name: tagName,
      entries: entryIds,
    });
    const entries = await tc.getEntries();
    expect(tc.entries).toBeDefined();
    compareExpected(entries, expectedIds);
    return tc.id;
  };

  const testAdd = async (tagName: string, entryIds: any, expectedIds: any) => {
    const tc = await Tag.create({ name: tagName });
    let entries = await tc.getEntries();
    expect(tc.entries).toBeDefined();
    expect(entries).toBeDefined();
    expect(entries.length).toBe(0);
    for (const entryId of entryIds) {
      tc.addEntry(entryId);
    }
    const tag = await Tag.findOne({ name: tagName });
    const addedEntries = await tag.getEntries();
    compareExpected(addedEntries, expectedIds);
  };

  const tester = async (tagName: string, entryIds: any, expectedIds: any) => {
    const id = await testCreate(tagName, entryIds, expectedIds);
    await Tag.delete(id!);
    await testAdd(tagName, entryIds, expectedIds);
  };

  it("empty", async () => {
    await tester("MyTag", [], []);
  });

  it("with tables", async () => {
    await tester(
      "Book_Tbl_Tag",
      [{ table_id: books.id }],
      [[books.id, undefined, undefined, undefined]]
    );
    await tester(
      "Book_Patients_Tbl_Tag",
      [{ table_id: books.id }, { table_id: patients.id }],
      [
        [books.id, undefined, undefined, undefined],
        [patients.id, undefined, undefined, undefined],
      ]
    );
  });

  it("with views", async () => {
    await tester(
      "Author_list_Tag",
      [{ view_id: authorlist.id }],
      [[undefined, authorlist.id, undefined, undefined]]
    );
    await tester(
      "Author_list_show_Tag",
      [{ view_id: authorlist.id }, { view_id: authorshow.id }],
      [
        [undefined, authorlist.id, undefined, undefined],
        [undefined, authorshow.id, undefined, undefined],
      ]
    );
  });

  it("with pages", async () => {
    await tester(
      "page_a_Tag",
      [{ page_id: pageA.id }],
      [[undefined, undefined, pageA.id, undefined]]
    );
  });

  // TODO trigger and mixed
});
