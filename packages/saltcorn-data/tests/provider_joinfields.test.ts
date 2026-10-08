import Table from "../models/table";
import Field from "../models/field";
import db from "../db";
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
import { assertIsSet } from "./assertions";
import { afterAll, describe, it, expect, beforeAll, jest } from "@jest/globals";
import { add_free_variables_to_joinfields } from "../plugin-helper";
import expressionModule from "../models/expression";
const { freeVariables, recalculate_for_stored } = expressionModule;

// Joins from a database table onto a table provider's table are resolved
// with lookupFunction (not SQL joins), and must then be renamed into nested
// objects by joinfield_renamer for dot-notation expressions.

const people = [
  { id: 1, name: "Alice", favbook: 1 },
  { id: 2, name: "Bob", favbook: 2 },
];

const provider_plugin = {
  sc_plugin_api_version: 1,
  table_providers: {
    provpeople: {
      configuration_workflow: () => null,
      fields: () => [
        {
          name: "id",
          label: "ID",
          type: "Integer",
          primary_key: true,
          is_unique: true,
        },
        { name: "name", label: "Name", type: "String" },
        {
          name: "favbook",
          label: "Favourite book",
          type: "Key",
          reftable_name: "books",
        },
      ],
      get_table: () => ({ getRows: async () => people.map((p) => ({ ...p })) }),
    },
  },
};

afterAll(db.close);
jest.setTimeout(30000);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
  getState()!.registerPlugin("provider_plugin", provider_plugin as any);
  await Table.create("ProvPeople", { provider_name: "provpeople" });
  const addr = await Table.create("ProvAddress");
  await Field.create({
    table: addr,
    name: "street",
    label: "Street",
    type: "String",
  });
  await Field.create({
    table: addr,
    name: "owner",
    label: "Owner",
    type: "Key to ProvPeople",
  });
  await getState()!.refresh_tables();
});

const addrTable = () => {
  const t = Table.findOne({ name: "ProvAddress" });
  assertIsSet(t);
  return t;
};

const joinFieldsFor = (expression: string) => {
  const joinFields: any = {};
  add_free_variables_to_joinfields(
    freeVariables(expression),
    joinFields,
    addrTable().fields
  );
  return joinFields;
};

describe("getJoinedRows onto provider table", () => {
  it("inserts a row", async () => {
    await addrTable().insertRow({ street: "Elm St", owner: 1 });
  });
  it("looks up explicit joinfield", async () => {
    const rows = await addrTable().getJoinedRows({
      joinFields: { owner_name: { ref: "owner", target: "name" } },
    });
    expect(rows.length).toBe(1);
    expect(rows[0].owner_name).toBe("Alice");
    expect(rows[0].owner).toBe(1);
  });
  it("looks up dot notation joinfield", async () => {
    const joinFields = joinFieldsFor("owner.name");
    expect(joinFields.owner_name.rename_object).toEqual(["owner", "name"]);
    const rows = await addrTable().getJoinedRows({ joinFields });
    expect(rows.length).toBe(1);
    expect(rows[0].owner.name).toBe("Alice");
    expect(rows[0].owner.id).toBe(1);
  });
  it("looks up half-h notation joinfield", async () => {
    const rows = await addrTable().getJoinedRows({
      joinFields: joinFieldsFor("ownerⱵname"),
    });
    expect(rows.length).toBe(1);
    expect(rows[0]["ownerⱵname"]).toBe("Alice");
    expect(rows[0].owner).toBe(1);
  });
  it("looks up dot notation through joinfield", async () => {
    const rows = await addrTable().getJoinedRows({
      joinFields: joinFieldsFor("owner.favbook.author"),
    });
    expect(rows.length).toBe(1);
    expect(rows[0].owner.favbook.author).toBe("Herman Melville");
    expect(rows[0].owner.id).toBe(1);
  });
  it("looks up half-h notation through joinfield", async () => {
    const rows = await addrTable().getJoinedRows({
      joinFields: joinFieldsFor("ownerⱵfavbookⱵauthor"),
    });
    expect(rows.length).toBe(1);
    expect(rows[0]["ownerⱵfavbookⱵauthor"]).toBe("Herman Melville");
  });
  it("looks up dot and half-h notation together", async () => {
    const rows = await addrTable().getJoinedRows({
      joinFields: {
        ...joinFieldsFor("owner.name"),
        ...joinFieldsFor("ownerⱵfavbookⱵauthor"),
      },
    });
    expect(rows[0].owner.name).toBe("Alice");
    expect(rows[0]["ownerⱵfavbookⱵauthor"]).toBe("Herman Melville");
  });
  it("returns null for missing key", async () => {
    const id = await addrTable().insertRow({ street: "Nowhere" });
    const rows = await addrTable().getJoinedRows({
      where: { id },
      joinFields: {
        ...joinFieldsFor("owner.name"),
        ...joinFieldsFor("ownerⱵname"),
      },
    });
    expect(rows[0].owner.name).toBeFalsy();
    expect(rows[0]["ownerⱵname"]).toBeFalsy();
    await addrTable().deleteRows({ id });
  });
});

describe("stored calculated fields onto provider table", () => {
  const calcFields: [string, string][] = [
    ["owner_name_dot", "owner.name"],
    ["owner_name_h", "ownerⱵname"],
    ["owner_author_dot", "owner.favbook.author"],
    ["owner_author_h", "ownerⱵfavbookⱵauthor"],
  ];
  it("creates fields and recalculates existing rows", async () => {
    for (const [name, expression] of calcFields)
      await Field.create({
        table: addrTable(),
        name,
        label: name,
        type: "String",
        calculated: true,
        stored: true,
        expression,
      });
    await getState()!.refresh_tables();
    await recalculate_for_stored(addrTable());
    const rows = await addrTable().getRows({ street: "Elm St" });
    expect(rows.length).toBe(1);
    expect(rows[0].owner_name_dot).toBe("Alice");
    expect(rows[0].owner_name_h).toBe("Alice");
    expect(rows[0].owner_author_dot).toBe("Herman Melville");
    expect(rows[0].owner_author_h).toBe("Herman Melville");
  });
  it("calculates on insert", async () => {
    const id = await addrTable().insertRow({ street: "Oak St", owner: 2 });
    const row = await addrTable().getRow({ id });
    expect(row?.owner_name_dot).toBe("Bob");
    expect(row?.owner_name_h).toBe("Bob");
    expect(row?.owner_author_dot).toBe("Leo Tolstoy");
    expect(row?.owner_author_h).toBe("Leo Tolstoy");
  });
  it("recalculates on update of key", async () => {
    const t = addrTable();
    const row0 = await t.getRow({ street: "Oak St" });
    assertIsSet(row0);
    await t.updateRow({ owner: 1 }, row0.id);
    const row = await t.getRow({ id: row0.id });
    expect(row?.owner_name_dot).toBe("Alice");
    expect(row?.owner_name_h).toBe("Alice");
    expect(row?.owner_author_dot).toBe("Herman Melville");
    expect(row?.owner_author_h).toBe("Herman Melville");
  });
});
