import Table from "../models/table";
import Field from "../models/field";
import View from "../models/view";
import db from "../db";
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
import mocks from "./mocks";
const { rick_file, plugin_with_routes, mockReqRes, createDefaultView } = mocks;
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
const non_owner_user = { id: 3, email: "foo@bar.com", role_id: 8 };
const owner_user = { id: 1, email: "foo@bar.com", role_id: 8 };

const test_person_table = async (persons: Table) => {
  const row = await persons.getRow({ age: 12 });
  assertIsSet(row);
  expect(row.lastname).toBe("Joe");
  expect(row.age).toBe(12);

  expect(persons.is_owner(non_owner_user, row)).toBe(false);
  const not_owned_row = await persons.getJoinedRow({
    where: { id: row.id },
    forUser: non_owner_user,
  });
  expect(not_owned_row).toBe(null);

  const row1 = await persons.getJoinedRow({
    where: { age: 13 },
    forUser: owner_user,
  });

  assertIsSet(row1);
  expect(persons.is_owner({ id: 1 }, row1)).toBe(true);
  const owned_row = await persons.getJoinedRow({
    where: { id: row1.id },

    forUser: owner_user,
  });
  expect(!!owned_row).toBe(true);

  const owned_rows = await persons.getJoinedRows({
    where: {},
    forUser: owner_user,
  });
  expect(owned_rows.length).toBe(1);
  expect(owned_rows[0].age).toBe(13);
  const not_owned_rows = await persons.getJoinedRows({
    where: {},

    forUser: non_owner_user,
  });
  expect(not_owned_rows.length).toBe(0);
  const public_owned_rows = await persons.getJoinedRows({
    where: {},
    forPublic: true,
  });
  expect(public_owned_rows.length).toBe(0);
  const owned_rows1 = await persons.getJoinedRows({
    forUser: owner_user,
  });
  expect(owned_rows1.length).toBe(1);
  expect(owned_rows1[0].age).toBe(13);

  //show
  const view = await createDefaultView(persons, "Show", 10);
  const contents = await view.run_possibly_on_page(
    { id: row1.id },
    { ...mockReqRes.req, user: non_owner_user },
    mockReqRes.res
  );
  expect(contents).toBe("<div>No row selected</div>");

  const contents1 = await view.run_possibly_on_page(
    { id: row1.id },
    { ...mockReqRes.req, user: owner_user },
    mockReqRes.res
  );
  expect(contents1).toContain(">13<");
  const contentsmo = await view.runMany(
    {},
    {
      req: { ...mockReqRes.req, user: owner_user },
      res: mockReqRes.res,
    }
  );
  expect(contentsmo.length).toBe(1);
  // @ts-ignore
  expect(contentsmo[0]?.row?.lastname).toBe("Sam");
  const contentsmno = await view.runMany(
    {},
    {
      req: { ...mockReqRes.req, user: non_owner_user },
      res: mockReqRes.res,
    }
  );
  expect(contentsmno.length).toBe(0);
  await view.delete();

  const { department, ...row1form } = row1;
  if (department) row1form.department = department.id;

  //edit
  const editView = await createDefaultView(persons, "Edit", 10);
  const econtents = await editView.run_possibly_on_page(
    { id: row1.id },
    { ...mockReqRes.req, user: non_owner_user },
    mockReqRes.res
  );
  expect(econtents).not.toContain('value="13"');
  const econtents1 = await editView.run_possibly_on_page(
    { id: row1.id },
    { ...mockReqRes.req, user: owner_user },
    mockReqRes.res
  );
  expect(econtents1).toContain('value="13"');
  await editView.runPost(
    {},
    { ...row1form, age: 5 },
    {
      req: { ...mockReqRes.req, user: non_owner_user },
      res: mockReqRes.res,
    },
    false
  );
  expect((await persons.getRow({ id: row1.id }))?.age).toBe(13);
  await editView.runPost(
    {},
    { ...row1form, age: 5 },
    {
      req: { ...mockReqRes.req, user: owner_user },
      res: mockReqRes.res,
    },
    false
  );
  expect((await persons.getRow({ id: row1.id }))?.age).toBe(5);
  await editView.delete();

  //update
  await persons.updateRow({ lastname: "Fred" }, row1.id, { role_id: 10 });
  expect((await persons.getRow({ id: row1.id }))?.lastname).toBe("Sam");
  await persons.updateRow({ lastname: "Fred" }, row1.id, non_owner_user);
  expect((await persons.getRow({ id: row1.id }))?.lastname).toBe("Sam");
  await persons.updateRow({ lastname: "Fred" }, row1.id, owner_user);
  expect((await persons.getRow({ id: row1.id }))?.lastname).toBe("Fred");
  if (!department) {
    await persons.updateRow(
      { lastname: "Sally", owner: non_owner_user.id },
      row1.id,
      non_owner_user
    );
    expect((await persons.getRow({ id: row1.id }))?.lastname).toBe("Fred");
  }
  //delete
  await persons.deleteRows({ id: row1.id }, { role_id: 10 });
  expect((await persons.getRow({ id: row1.id }))?.age).toBe(5);
  await persons.deleteRows({ id: row1.id }, non_owner_user);
  expect((await persons.getRow({ id: row1.id }))?.age).toBe(5);
  await persons.deleteRows({ id: row1.id }, owner_user);
  expect((await persons.getRow({ id: row1.id }))?.age).toBe(undefined);
};

describe("Table with row ownership field", () => {
  it("should create and delete table", async () => {
    const persons = await Table.create("TableOwned");
    await Field.create({
      table: persons,
      name: "lastname",
      type: "String",
    });
    await Field.create({
      table: persons,
      name: "age",
      type: "Integer",
    });
    const owner = await Field.create({
      table: persons,
      name: "owner",
      type: "Key to users",
    });
    await persons.update({ ownership_field_id: owner.id });

    await persons.insertRow({ lastname: "Joe", age: 12 });
    await persons.insertRow({ lastname: "Sam", age: 13, owner: 1 });

    await test_person_table(persons);
    const owner_fnm = await persons.owner_fieldname();
    expect(owner_fnm).toBe("owner");
    //insert
    await persons.insertRow(
      { age: 99, lastname: "Tim", owner: owner_user.id },
      { role_id: 10 }
    );
    expect((await persons.getRow({ lastname: "Tim" }))?.age).toBe(undefined);
    await persons.insertRow(
      { age: 99, lastname: "Tim", owner: owner_user.id },
      non_owner_user
    );
    expect((await persons.getRow({ lastname: "Tim" }))?.age).toBe(undefined);
    await persons.insertRow(
      { age: 99, lastname: "Tim", owner: owner_user.id },
      owner_user
    );
    expect((await persons.getRow({ lastname: "Tim" }))?.age).toBe(99);

    await persons.delete();
  });
});
describe("Table with row ownership formula", () => {
  it("should create and delete table", async () => {
    const persons = await Table.create("TableOwnedFml");
    await Field.create({
      table: persons,
      name: "lastname",
      type: "String",
    });
    await Field.create({
      table: persons,
      name: "age",
      type: "Integer",
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

    await persons.insertRow({ lastname: "Joe", age: 12 });
    await persons.insertRow({ lastname: "Sam", age: 13, owner: 1 });
    await test_person_table(persons);
    //insert
    await persons.insertRow(
      { age: 99, lastname: "Tim", owner: owner_user.id },
      { role_id: 10 }
    );
    expect((await persons.getRow({ lastname: "Tim" }))?.age).toBe(undefined);
    await persons.insertRow(
      { age: 99, lastname: "Tim", owner: owner_user.id },
      non_owner_user
    );
    expect((await persons.getRow({ lastname: "Tim" }))?.age).toBe(undefined);
    await persons.insertRow(
      { age: 99, lastname: "Tim", owner: owner_user.id },
      owner_user
    );
    expect((await persons.getRow({ lastname: "Tim" }))?.age).toBe(99);
    await persons.delete();
  });
});
describe("Table with row ownership joined formula", () => {
  it("should create and delete table", async () => {
    const department = await Table.create("Department");
    await Field.create({
      table: department,
      name: "name",
      type: "String",
    });
    const manager = await Field.create({
      table: department,
      name: "manager",
      type: "Key to users",
    });
    await department.update({ ownership_field_id: manager.id });

    const persons = await Table.create("TableOwnedJnFml");
    await Field.create({
      table: persons,
      name: "lastname",
      type: "String",
    });
    await Field.create({
      table: persons,
      name: "age",
      type: "Integer",
    });
    const deptkey = await Field.create({
      table: persons,
      name: "department",
      type: "Key to Department",
    });

    const own_opts = await Table.findOne({
      name: "TableOwnedJnFml",
    })?.ownership_options();
    expect(own_opts?.length).toBe(1);
    //expect(own_opts).toBe(1);
    expect(own_opts?.[0].label).toBe("Inherit department");
    expect(own_opts?.[0].value).toBe("Fml:department?.manager===user.id");
    await persons.update({
      ownership_formula: "department?.manager===user.id",
    });
    await department.insertRow({ name: "Accounting", manager: 1 });
    await department.insertRow({ name: "HR", manager: 2 });

    await persons.insertRow({ lastname: "Joe", age: 12, department: 2 });
    await persons.insertRow({ lastname: "Sam", age: 13, department: 1 });
    await test_person_table(persons);
    //insert
    await persons.insertRow(
      { age: 99, lastname: "Tim", department: 1 },
      { role_id: 10 }
    );
    expect((await persons.getRow({ lastname: "Tim" }))?.age).toBe(undefined);
    await persons.insertRow(
      { age: 99, lastname: "Tim", department: 1 },
      non_owner_user
    );
    expect((await persons.getRow({ lastname: "Tim" }))?.age).toBe(undefined);
    await persons.insertRow(
      { age: 99, lastname: "Tim", department: 1 },
      owner_user
    );
    expect((await persons.getRow({ lastname: "Tim" }))?.age).toBe(99);
    await persons.delete();
    await department.delete();
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
          "Fml:user.UserWorksOnProject_by_user.map(g=>g.project).includes(id) /* User group UserWorksOnProject */",
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
          "Fml:user.UserWorksOnProject_by_user.map(g=>g.project).includes(project) /* Inherit project */",
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
          "Fml:user.UserWorksOnProject_by_user.map(g=>g.project).includes(task?.project) /* Inherit task */",
      },
    ]);

    await subtasks.delete();
    await tasks.delete();
    await user_works_proj.delete();
    await projects.delete();
  });
});
