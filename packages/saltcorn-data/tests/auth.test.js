import Table from "../models/table";
import Field from "../models/field";
import View from "../models/view";
import db from "../db";
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
import mocks from "./mocks";
const { rick_file, plugin_with_routes, mockReqRes } = mocks;
import {
  assertIsSet,
  assertsIsSuccessMessage,
  assertIsErrorMsg,
  assertIsType,
} from "./assertions";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import { add_free_variables_to_joinfields } from "../plugin-helper";
import expressionModule from "../models/expression";
const { freeVariables } = expressionModule;

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});
jest.setTimeout(30000);

describe("Table with row ownership", () => {
  it("should create and delete table", async () => {
    const persons = await Table.create("TableOwned");
    const name = await Field.create({
      table: persons,
      name: "name",
      type: "String",
    });
    const age = await Field.create({
      table: persons,
      name: "age",
      type: "String",
    });
    const owner = await Field.create({
      table: persons,
      name: "owner",
      type: "Key to users",
    });
    await persons.update({ ownership_field_id: owner.id });
    if (!db.isSQLite) {
      await age.update({ type: "Integer" });
      await name.update({ name: "lastname" });
      await persons.insertRow({ lastname: "Joe", age: 12 });
      await persons.insertRow({ lastname: "Sam", age: 13, owner: 1 });
      const row = await persons.getRow({ age: 12 });
      assertIsSet(row);
      expect(row.lastname).toBe("Joe");
      expect(row.age).toBe(12);
      const owner_fnm = await persons.owner_fieldname();
      expect(owner_fnm).toBe("owner");
      const is_owner = await persons.is_owner({ id: 6 }, row);
      expect(is_owner).toBe(false);
      const row1 = await persons.getRow({ age: 13 });
      assertIsSet(row1);
      const is_owner1 = await persons.is_owner({ id: 1 }, row1);
      expect(is_owner1).toBe(true);
    }
    await persons.delete();
  });
});
describe("Table with row ownership", () => {
  it("should create and delete table", async () => {
    const persons = await Table.create("TableOwnedFml");
    const name = await Field.create({
      table: persons,
      name: "name",
      type: "String",
    });
    const age = await Field.create({
      table: persons,
      name: "age",
      type: "String",
    });
    const owner = await Field.create({
      table: persons,
      name: "owner",
      type: "Key to users",
    });
    await persons.update({ ownership_formula: "user.id===owner" });
    if (!db.isSQLite) {
      await age.update({ type: "Integer" });
      await name.update({ name: "lastname" });
      await persons.insertRow({ lastname: "Joe", age: 12 });
      await persons.insertRow({ lastname: "Sam", age: 13, owner: 1 });
      const row = await persons.getRow({ age: 12 });
      assertIsSet(row);
      expect(row.lastname).toBe("Joe");
      expect(row.age).toBe(12);
      const is_owner = await persons.is_owner({ id: 6 }, row);
      expect(is_owner).toBe(false);
      const row1 = await persons.getRow({ age: 13 });
      assertIsSet(row1);
      const is_owner1 = await persons.is_owner({ id: 1 }, row1);
      expect(is_owner1).toBe(true);
    }
    await persons.delete();
  });
});
describe("User group", () => {
  it("should create and delete table", async () => {
    const projects = await Table.create("Project");
    await Field.create({
      table: projects,
      name: "name",
      type: "String",
    });
    const user_works_proj = await Table.create("UserWorksOnProject");

    await Field.create({
      table: user_works_proj,
      name: "user",
      type: "Key to users",
    });
    await Field.create({
      table: user_works_proj,
      name: "project",
      type: "Key to Projects",
    });
    await user_works_proj.update({ is_user_group: true });

    await persons.delete();
  });
});
