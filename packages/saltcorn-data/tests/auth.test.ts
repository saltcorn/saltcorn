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
import { AbstractUser } from "@saltcorn/types/model-abstracts/abstract_user";
const { freeVariables } = expressionModule;

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});
jest.setTimeout(30000);
const non_owner_user = { id: 3, email: "foo@bar.com", role_id: 80 };
const owner_user = { id: 1, email: "foo@bar.com", role_id: 80 };

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
  expect(persons.is_owner({ id: 1, role_id: 100 }, row1)).toBe(true);
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
  const view = await createDefaultView(persons, "Show", 100);
  const contents = await view.run_possibly_on_page(
    { id: row1.id },
    { ...mockReqRes.req, user: non_owner_user },
    mockReqRes.res
  );
  expect(contents).toBe("No row selected");

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
  const editView = await createDefaultView(persons, "Edit", 100);
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
  expect(
    await persons.updateRow({ lastname: "Fred" }, row1.id, { role_id: 100 })
  ).toBe("Not authorized");
  expect((await persons.getRow({ id: row1.id }))?.lastname).toBe("Sam");
  expect(
    await persons.updateRow({ lastname: "Fred" }, row1.id, non_owner_user)
  ).toBe("Not authorized");
  expect((await persons.getRow({ id: row1.id }))?.lastname).toBe("Sam");
  expect(
    await persons.updateRow({ lastname: "Fred" }, row1.id, owner_user)
  ).toBe(undefined);
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
  await persons.deleteRows({ id: row1.id }, { role_id: 100 });
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

    const joeid = await persons.insertRow({ lastname: "Joe", age: 12 });
    await persons.insertRow({ lastname: "Sam", age: 13, owner: 1 });

    await test_person_table(persons);
    const owner_fnm = await persons.owner_fieldname();
    expect(owner_fnm).toBe("owner");
    //insert
    await persons.insertRow(
      { age: 99, lastname: "Tim", owner: owner_user.id },
      { role_id: 100 }
    );
    expect((await persons.getRow({ lastname: "Tim" }))?.age).toBe(undefined);
    await persons.insertRow(
      { age: 99, lastname: "Tim", owner: owner_user.id },
      non_owner_user
    );
    expect((await persons.getRow({ lastname: "Tim" }))?.age).toBe(undefined);
    const timid = await persons.insertRow(
      { age: 99, lastname: "Tim", owner: owner_user.id },
      owner_user
    );
    const alexid = await persons.insertRow(
      { age: 99, lastname: "Alex", owner: owner_user.id },
      owner_user
    );
    expect((await persons.getRow({ lastname: "Tim" }))?.age).toBe(99);
    const aggs1 = await persons.aggregationQuery({
      npers: {
        field: "id",
        aggregate: "count",
      },
    });
    expect(+aggs1.npers).toBe(3);
    const aggs2 = await persons.aggregationQuery(
      {
        npers: {
          field: "id",
          aggregate: "count",
        },
      },
      { where: { lastname: "Tim" } }
    );
    const aggs_pub = await persons.aggregationQuery(
      {
        npers: {
          field: "id",
          aggregate: "count",
        },
      },
      { forPublic: true }
    );
    expect(+aggs_pub.npers).toBe(0);
    const aggs_owned = await persons.aggregationQuery(
      {
        npers: {
          field: "id",
          aggregate: "count",
        },
      },
      { forUser: owner_user }
    );
    expect(+aggs_owned.npers).toBe(2);
    const aggs_non_owned = await persons.aggregationQuery(
      {
        npers: {
          field: "id",
          aggregate: "count",
        },
      },
      { forUser: non_owner_user }
    );
    expect(+aggs_non_owned.npers).toBe(0);

    //not deleting as nonowner
    await persons.deleteRows({ id: timid }, non_owner_user);
    expect((await persons.getRow({ lastname: "Tim" }))?.age).toBe(99);
    //not deleting as public
    await persons.deleteRows({ id: timid }, { role_id: 100 });
    expect((await persons.getRow({ lastname: "Tim" }))?.age).toBe(99);

    //deleting without user
    await persons.deleteRows({ id: timid });
    expect(await persons.getRow({ lastname: "Tim" })).toBe(null);

    //deleting as owner
    await persons.deleteRows({ id: alexid }, owner_user);
    expect(await persons.getRow({ lastname: "Alex" })).toBe(null);

    const tstWhere = {};

    const ures = persons.updateWhereWithOwnership(tstWhere, owner_user, true);
    expect(ures).toBe(undefined);

    expect(tstWhere).toStrictEqual({ owner: 1 });
    await persons.delete();
  });
});
describe("Table with row ownership field and calculated", () => {
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
    await Field.create({
      table: persons,
      name: "nameandage",
      type: "String",
      calculated: true,
      stored: true,
      expression: "lastname+age",
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
      { role_id: 100 }
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
      { role_id: 100 }
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
    await persons.deleteRows({ lastname: "Tim" }, non_owner_user);
    expect((await persons.getRow({ lastname: "Tim" }))?.age).toBe(99);
    await persons.deleteRows({ lastname: "Tim" }, owner_user);
    expect((await persons.getRow({ lastname: "Tim" }))?.age).toBe(undefined);

    expect(persons.ownership_formula_where(owner_user)).toStrictEqual({
      owner: 1,
    });
    expect(persons.ownership_formula_where(non_owner_user)).toStrictEqual({
      owner: 3,
    });
    await persons.delete();
  });
  it("should create and delete table with reversed formula", async () => {
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
    await persons.update({ ownership_formula: "owner===user.id" });

    await persons.insertRow({ lastname: "Joe", age: 12 });
    await persons.insertRow({ lastname: "Sam", age: 13, owner: 1 });
    await test_person_table(persons);
    //insert
    await persons.insertRow(
      { age: 99, lastname: "Tim", owner: owner_user.id },
      { role_id: 100 }
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
    await persons.deleteRows({ lastname: "Tim" }, non_owner_user);
    expect((await persons.getRow({ lastname: "Tim" }))?.age).toBe(99);
    await persons.deleteRows({ lastname: "Tim" }, owner_user);
    expect((await persons.getRow({ lastname: "Tim" }))?.age).toBe(undefined);

    expect(persons.ownership_formula_where(owner_user)).toStrictEqual({
      owner: 1,
    });
    expect(persons.ownership_formula_where(non_owner_user)).toStrictEqual({
      owner: 3,
    });
    const tstWhere = {};

    const ures = persons.updateWhereWithOwnership(tstWhere, owner_user, true);
    expect(ures).toBe(undefined);

    expect(tstWhere).toStrictEqual({ owner: 1 });

    expect(persons.ownership_formula_where(owner_user)).toStrictEqual({
      owner: 1,
    });
    await persons.delete();
  });
});
describe("Table with row ownership joined formula nocalc", () => {
  it("should create and delete table", async () => {
    const department = await Table.create("_Department");
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
      type: "Key to _Department",
    });

    const own_opts = await Table.findOne({
      name: "TableOwnedJnFml",
    })?.ownership_options();
    expect(own_opts?.length).toBe(1);
    //expect(own_opts).toBe(1);
    expect(own_opts?.[0].label).toBe("Inherit department");
    expect(own_opts?.[0].value).toBe(
      "Fml:department?.manager===user.id /* Inherit department */"
    );
    await persons.update({
      ownership_formula: "department?.manager===user.id",
    });
    expect(persons.ownership_formula_where(owner_user)).toStrictEqual({
      department: {
        inSelect: {
          field: "id",
          table: "_Department",
          tenant: "public",
          where: { manager: 1 },
        },
      },
    });

    await department.insertRow({ name: "Accounting", manager: 1 });
    await department.insertRow({ name: "HR", manager: 2 });

    await persons.insertRow({ lastname: "Joe", age: 12, department: 2 });
    await persons.insertRow({ lastname: "Sam", age: 13, department: 1 });
    await test_person_table(persons);
    //insert
    await persons.insertRow(
      { age: 99, lastname: "Tim", department: 1 },
      { role_id: 100 }
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
  it("should create and delete table reversed formula", async () => {
    const department = await Table.create("_Department");
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
      type: "Key to _Department",
    });

    const own_opts = await Table.findOne({
      name: "TableOwnedJnFml",
    })?.ownership_options();
    expect(own_opts?.length).toBe(1);
    //expect(own_opts).toBe(1);
    expect(own_opts?.[0].label).toBe("Inherit department");
    expect(own_opts?.[0].value).toBe(
      "Fml:department?.manager===user.id /* Inherit department */"
    );
    await persons.update({
      ownership_formula: "user.id===department?.manager",
    });
    expect(persons.ownership_formula_where(owner_user)).toStrictEqual({
      department: {
        inSelect: {
          field: "id",
          table: "_Department",
          tenant: "public",
          where: { manager: 1 },
        },
      },
    });

    await department.insertRow({ name: "Accounting", manager: 1 });
    await department.insertRow({ name: "HR", manager: 2 });

    await persons.insertRow({ lastname: "Joe", age: 12, department: 2 });
    await persons.insertRow({ lastname: "Sam", age: 13, department: 1 });
    await test_person_table(persons);
    //insert
    await persons.insertRow(
      { age: 99, lastname: "Tim", department: 1 },
      { role_id: 100 }
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

describe("Table with row ownership double joined", () => {
  it("should create and delete table", async () => {
    const department = await Table.create("_Department");
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
    await Field.create({
      table: User.table,
      name: "supervisor",
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
      type: "Key to _Department",
    });

    await persons.update({
      ownership_formula: "department?.manager?.supervisor===user.id",
    });
    expect(persons.ownership_formula_where(owner_user)).toStrictEqual({
      department: {
        inSelect: {
          field: "id",
          table: "_Department",
          tenant: "public",
          through: "users",
          valField: "manager",
          where: { supervisor: 1 },
        },
      },
    });

    const owned_rows = await persons.getRows(
      persons.ownership_formula_where(owner_user)
    );
    expect(owned_rows.length).toBe(0);
    await persons.delete();
    await department.delete();
  });
});
describe("Table with row ownership joined formula and stored calc", () => {
  it("should create and delete table", async () => {
    const department = await Table.create("_Department");
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
    await Field.create({
      table: persons,
      name: "nameandage",
      type: "String",
      calculated: true,
      stored: true,
      expression: "lastname+age",
    });
    const deptkey = await Field.create({
      table: persons,
      name: "department",
      type: "Key to _Department",
    });

    const own_opts = await Table.findOne({
      name: "TableOwnedJnFml",
    })?.ownership_options();
    expect(own_opts?.length).toBe(1);
    //expect(own_opts).toBe(1);
    expect(own_opts?.[0].label).toBe("Inherit department");
    expect(own_opts?.[0].value).toBe(
      "Fml:department?.manager===user.id /* Inherit department */"
    );
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
      { role_id: 100 }
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
describe("ownerhip of users table", () => {
  it("should find own row", async () => {
    const users = Table.findOne({ name: "users" });
    assertIsSet(users);
    const u3 = await users.getRow({ id: 3 });
    assertIsSet(u3);

    expect(u3?.email).toBe("user@foo.com");
    const u3forUser = await users.getRow(
      { id: 3 },
      { forUser: u3 as AbstractUser }
    );
    expect(u3forUser?.email).toBe("user@foo.com");
    const u2forUser = await users.getRow(
      { id: 2 },
      { forUser: u3 as AbstractUser }
    );
    expect(u2forUser).toBe(null);
  });
});

describe("User group no spaces", () => {
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
    const user = await User.findOne({ role_id: 80 });
    assertIsSet(user);
    await user_works_proj.insertRow({ project: projid, user: user.id });

    const uobj = await User.findForSession({ id: user.id });
    assertIsSet(uobj);

    expect(uobj.id).toBe(user.id);
    expect(uobj.role_id).toBe(80);
    expect(uobj.UserWorksOnProject_by_user).toEqual([
      { id: 1, project: 1, user: 3 },
    ]);
    const owned_rows = await projs.getJoinedRows({
      where: {},
      forUser: uobj,
    });
    expect(owned_rows.length).toBe(1);

    const myproj = await projs.getRow({ id: projid });
    assertIsSet(myproj);
    expect(projs.is_owner(uobj, myproj)).toBe(true);

    const projid1 = await projects.insertRow({ name: "Take out trash" });
    const staff = await User.findOne({ role_id: 40 });
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
    assertIsSet(adminobj);
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
    const owned_rows1 = await tasks.getJoinedRows({
      where: {},
      forUser: uobj,
    });
    expect(owned_rows1.length).toBe(0);

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
    await subtasks.update({
      ownership_formula: subtask_opts?.[0].value.replace("Fml:", ""),
    });
    const owned_rows2 = await subtasks.getJoinedRows({
      where: {},
      forUser: uobj,
    });
    expect(owned_rows2.length).toBe(0);

    await subtasks.delete();
    await tasks.delete();
    await user_works_proj.delete();
    await projects.delete();
  });
});

describe("User group with spaces in name", () => {
  it("should support user groups", async () => {
    const projects = await Table.create("The Project");
    await Field.create({
      table: projects,
      name: "name",
      type: "String",
    });
    const user_works_proj = await Table.create("User Works On Project1");

    await Field.create({
      table: user_works_proj,
      name: "user",
      type: "Key to users",
    });
    await Field.create({
      table: user_works_proj,
      name: "project",
      type: "Key to The Project",
    });
    await user_works_proj.update({ is_user_group: true });

    const projs = Table.findOne({ name: "The Project" });
    assertIsSet(projs);

    const own_opts = await projs.ownership_options();
    expect(own_opts).toEqual([
      {
        label: "In User Works On Project1 user group by project",
        value:
          "Fml:user.UserWorksOnProject1_by_user.map(g=>g.project).includes(id) /* User group User Works On Project1 */",
      },
    ]);
    await projs.update({
      ownership_formula: own_opts[0].value.replace("Fml:", ""),
    });
    const projid = await projects.insertRow({ name: "World domination" });
    const user = await User.findOne({ role_id: 80 });
    assertIsSet(user);
    await user_works_proj.insertRow({ project: projid, user: user.id });

    const uobj = await User.findForSession({ id: user.id });
    assertIsSet(uobj);

    expect(uobj.id).toBe(user.id);
    expect(uobj.role_id).toBe(80);
    expect(uobj.UserWorksOnProject1_by_user).toEqual([
      { id: 1, project: 1, user: 3 },
    ]);

    const myproj = await projs.getRow({ id: projid });
    assertIsSet(myproj);
    expect(projs.is_owner(uobj, myproj)).toBe(true);
    const owned_rows = await projs.getJoinedRows({
      where: {},
      forUser: uobj,
    });
    expect(owned_rows.length).toBe(1);

    const projid1 = await projects.insertRow({ name: "Take out trash" });
    const staff = await User.findOne({ role_id: 40 });
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
    assertIsSet(adminobj);
    expect(projs.is_owner(adminobj, myproj)).toBe(false);
    expect(projs.is_owner(adminobj, myproj1)).toBe(false);

    const tasks = await Table.create("tasks1");

    await Field.create({
      table: tasks,
      name: "project",
      type: "Key to The Project",
    });

    const task_opts = await Table.findOne({
      name: "tasks1",
    })?.ownership_options();
    expect(task_opts).toEqual([
      {
        label: "Inherit project",
        value:
          "Fml:user.UserWorksOnProject1_by_user.map(g=>g.project).includes(project) /* Inherit project */",
      },
    ]);
    await tasks.update({
      ownership_formula: task_opts?.[0].value.replace("Fml:", ""),
    });

    const subtasks = await Table.create("subtasks1");

    await Field.create({
      table: subtasks,
      name: "task",
      type: "Key to tasks1",
    });
    const subtask_opts = await Table.findOne({
      name: "subtasks1",
    })?.ownership_options();

    expect(subtask_opts).toEqual([
      {
        label: "Inherit task",
        value:
          "Fml:user.UserWorksOnProject1_by_user.map(g=>g.project).includes(task?.project) /* Inherit task */",
      },
    ]);

    await subtasks.delete();
    await tasks.delete();
    await user_works_proj.delete();
    await projects.delete();
  });
});

describe("ownership_formula_where", () => {
  it("should create table", async () => {
    const tasks = await Table.create("tasks1");
    await Field.create({
      table: tasks,
      name: "name",
      type: "String",
    });
  });
  it("should do constant eq user", async () => {
    const tasks = Table.findOne("tasks1");
    assertIsSet(tasks);
    await tasks.update({ ownership_formula: 'user?.clearance==="ALL"' });
    const where = tasks.ownership_formula_where({
      id: 1,
      role_id: 80,
      clearance: "ALL",
    });
    expect(where).toStrictEqual({ eq: ["ALL", "ALL"] });
  });
  it("should do constant eq user", async () => {
    const tasks = Table.findOne("tasks1");
    assertIsSet(tasks);
    await tasks.update({ ownership_formula: 'user?.clearance==="ALL"' });
    const where = tasks.ownership_formula_where({
      id: 1,
      role_id: 80,
      clearance: "NONE",
    });
    expect(where).toStrictEqual({ eq: ["NONE", "ALL"] });
  });

  it("should do constant eq user", async () => {
    const tasks = Table.findOne("tasks1");
    assertIsSet(tasks);
    await tasks.update({
      ownership_formula:
        'user.department === name || user.department === "ALL"',
    });
    const where = tasks.ownership_formula_where({
      id: 1,
      role_id: 80,
      department: "ALL",
    });
    expect(JSON.stringify(where)).toBe(
      JSON.stringify({
        or: [{ eq: ["ALL", Symbol("name")] }, { eq: ["ALL", "ALL"] }],
      })
    );
  });
});

//user.department === bankid.access || user.department === "ALL
