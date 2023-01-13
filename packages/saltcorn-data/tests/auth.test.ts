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
import User from "../models/user";
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

    const own_opts = await Table.findOne({
      name: "TableOwnedFml",
    })?.ownership_options();
    expect(own_opts?.length).toBe(1);
    expect(own_opts?.[0].label).toBe("owner");
    expect(own_opts?.[0].value).toBe(`${owner.id}`);
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
  it("should support user groups", async () => {
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
      type: "Key to Project",
    });
    await user_works_proj.update({ is_user_group: true });

    const projs = Table.findOne({ name: "Project" });
    assertIsSet(projs);

    const own_opts = await projs.ownership_options();
    expect(own_opts).toEqual([
      {
        label: "In UserWorksOnProject user group by project",
        value:
          "Fml:user.UserWorksOnProject_by_user.map(g=>g.project).includes(id)",
      },
    ]);
    await projs.update({
      ownership_formula: own_opts[0].value.replace("Fml:", ""),
    });
    const projid = await projects.insertRow({ name: "World domination" });
    const user = await User.findOne({ role_id: 8 });
    assertIsSet(user);
    await user_works_proj.insertRow({ project: projid, user: user.id });

    const uobj = await User.findForSession({ id: user.id });
    assertIsSet(uobj);

    expect(uobj.id).toBe(user.id);
    expect(uobj.role_id).toBe(8);
    expect(uobj.UserWorksOnProject_by_user).toEqual([
      { id: 1, project: 1, user: 3 },
    ]);

    const myproj = await projs.getRow({ id: projid });
    assertIsSet(myproj);
    expect(projs.is_owner(uobj, myproj)).toBe(true);

    const projid1 = await projects.insertRow({ name: "Take out trash" });
    const staff = await User.findOne({ role_id: 4 });
    assertIsSet(staff);
    await user_works_proj.insertRow({ project: projid1, user: staff.id });
    const myproj1 = await projs.getRow({ id: projid1 });
    assertIsSet(myproj1);
    const staffobj = await User.findForSession({ id: staff.id });
    assertIsSet(staffobj);
    expect(projs.is_owner(staffobj, myproj)).toBe(false);
    expect(projs.is_owner(staffobj, myproj1)).toBe(true);
    expect(projs.is_owner(uobj, myproj1)).toBe(false);

    // admin is not "owner" but can still read/write due to min_role etc.
    const adminobj = await User.findForSession({ role_id: 1 });
    expect(projs.is_owner(adminobj, myproj)).toBe(false);
    expect(projs.is_owner(adminobj, myproj1)).toBe(false);

    const tasks = await Table.create("tasks");

    await Field.create({
      table: tasks,
      name: "project",
      type: "Key to Project",
    });

    const task_opts = await Table.findOne({
      name: "tasks",
    })?.ownership_options();
    expect(task_opts).toEqual([
      {
        label: "Inherit project",
        value:
          "Fml:user.UserWorksOnProject_by_user.map(g=>g.project).includes(project)",
      },
    ]);
    await tasks.update({
      ownership_formula: task_opts?.[0].value.replace("Fml:", ""),
    });

    const subtasks = await Table.create("subtasks");

    await Field.create({
      table: subtasks,
      name: "task",
      type: "Key to tasks",
    });
    const subtask_opts = await Table.findOne({
      name: "subtasks",
    })?.ownership_options();

    expect(subtask_opts).toEqual([
      {
        label: "Inherit task",
        value:
          "Fml:user.UserWorksOnProject_by_user.map(g=>g.project).includes(task.project)",
      },
    ]);

    await subtasks.delete();
    await tasks.delete();
    await user_works_proj.delete();
    await projects.delete();
  });
});
