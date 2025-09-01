import Table from "../models/table";
import TableConstraint from "../models/table_constraints";
import Field from "../models/field";
import View from "../models/view";
import db from "../db";
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
import discovery from "../models/discovery";
const { discoverable_tables, discover_tables, implement_discovery } = discovery;
import { writeFile } from "fs/promises";
import mocks from "./mocks";
const { rick_file, plugin_with_routes, mockReqRes, createDefaultView } = mocks;
import {
  assertIsSet,
  assertsIsSuccessMessage,
  assertIsErrorMsg,
  assertIsType,
} from "./assertions";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import {
  add_free_variables_to_joinfields,
  stateFieldsToQuery,
  stateFieldsToWhere,
} from "../plugin-helper";
import expressionModule from "../models/expression";
import {
  PrimaryKeyValue,
  Row,
  sqlBinOp,
  sqlFun,
  Where,
} from "@saltcorn/db-common/internal";
import { ResultMessage } from "@saltcorn/types/common_types";
const { freeVariables, jsexprToWhere, add_free_variables_to_aggregations } =
  expressionModule;

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
  await db.query(
    `create table tstcomppk ( name text, age int, address text, primary key(name,age));`
  );
  const pack = await discover_tables(["tstcomppk"]);
  await implement_discovery(pack);
});
jest.setTimeout(30000);

describe("Composite PK table properties", () => {
  it("should store attributes", async () => {
    const tc = Table.findOne("tstcomppk");
    assertIsSet(tc);
    expect(tc.composite_pk_names?.length).toBe(2);
    expect(tc.composite_pk_names).toContain("name");
    expect(tc.composite_pk_names).toContain("age");
    expect(tc.pk_name).toBe("age");
  });
  it("should insert", async () => {
    const tc = Table.findOne("tstcomppk");
    assertIsSet(tc);
    await tc.insertRow({ name: "Sam", age: 38 });
    const count = await tc.countRows({});
    expect(count).toBe(1);
    const rows = await tc.getRows({ name: "Sam", age: 38 });
    expect(rows.length).toBe(1);
    expect(rows[0].age).toBe(38);
  });
  it("should update", async () => {
    const tc = Table.findOne("tstcomppk");
    assertIsSet(tc);
    await tc.insertRow({ name: "Alex", age: 38 });
    await tc.updateRow(
      { name: "Sammy" },
      {
        name: "Sam",
        age: 38,
      }
    );

    const rows = await tc.getRows({});
    //expect(rows.length).toBe(2);
    const names = rows.map((r) => r.name);
    expect(names).toContain("Alex");
    expect(names).toContain("Sammy");
  });
  it("should create Edit view", async () => {
    const tc = Table.findOne("tstcomppk");
    assertIsSet(tc);
    const view = await createDefaultView(tc, "Edit", 1);
    expect(view.configuration.columns.length).toBe(3);
    await view.runPost(
      {},
      { name: "Fred", age: 10, address: "29 Park Road" },
      mockReqRes
    );
    const rows = await tc.getRows({ name: "Fred" });
    expect(rows.length).toBe(1);
    expect(rows[0].address).toBe("29 Park Road");
    await view.runPost(
      {},
      { name: "Fred", age: 10, address: "25 Park Road" },
      mockReqRes
    );
    const rows1 = await tc.getRows({ name: "Fred" });
    expect(rows1.length).toBe(1);
    expect(rows1[0].address).toBe("25 Park Road");
  });
});
