import Table from "../models/table.js";
import Field from "../models/field.js";
import View from "../models/view.js";
import Page from "../models/page.js";
import Trigger from "../models/trigger.js";
import db from "../db/index.js";
import { getState } from "../db/state.js";
import basePluginMod from "../base-plugin/index.js";
import resetSchemaMod from "../db/reset_schema.js";
import fixturesMod from "../db/fixtures.js";
getState()!.registerPlugin("base", basePluginMod);
import * as mocks from "./mocks.js";
const { rick_file, plugin_with_routes, mockReqRes, createDefaultView } = mocks;
import {
  assertIsSet,
  assertsIsSuccessMessage,
  assertIsErrorMsg,
  assertIsType,
} from "./assertions.js";
import {
  afterAll,
  describe,
  it,
  expect,
  beforeAll,
  jest,
} from "@saltcorn/db-common/test_expect";
import { add_free_variables_to_joinfields } from "../plugin-helper.js";
import * as expressionModule from "../models/expression.js";
import User from "../models/user.js";
import { AbstractUser } from "@saltcorn/types/model-abstracts/abstract_user";
import type {
  Plugin,
  AuthorizeAccessViewRequest,
  AuthorizeAccessPageRequest,
  AuthorizeAccessTriggerRequest,
  AuthorizeAccessApiRequest,
} from "@saltcorn/types/base_types";
const { freeVariables } = expressionModule;

afterAll(db.close);
beforeAll(async () => {
  await resetSchemaMod();
  await fixturesMod();
});
jest.setTimeout(30000);
const non_owner_user = { id: 3, email: "foo@bar.com", role_id: 80 };
const owner_user = { id: 1, email: "foo@bar.com", role_id: 80 };
const req = mockReqRes.req;

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

  const TableWithUser = Table.subClass({ user: non_owner_user });
  const personsWithUser = TableWithUser.findOne({ name: persons.name });
  assertIsSet(personsWithUser);
  const not_owned_row1 = await personsWithUser.getRow({
    id: row.id,
  });
  expect(not_owned_row1).toBe(null);

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

describe("Table with simple row ownership field", () => {
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
      attributes: { summary_field: "email" },
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
    const nauthins = await persons.insertRow(
      { age: 99, lastname: "Tim", owner: owner_user.id },
      non_owner_user
    );
    expect(nauthins).toBe(undefined);

    const timRow0 = await persons.getRow({ lastname: "Tim" });

    expect(timRow0).toBe(null);
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

    const lastnameField = persons.getField("lastname");
    assertIsSet(lastnameField);

    const dvs1 = await lastnameField.distinct_values({ user: non_owner_user });
    expect(dvs1.length).toBe(1);
    expect(dvs1[0].value).toBe("");
    const dvs2 = await lastnameField.distinct_values({ user: owner_user });

    expect(dvs2.length).toBe(3);

    const ownerField = persons.getField("owner");
    assertIsSet(ownerField);
    const dvs3 = await ownerField.distinct_values({ user: non_owner_user });

    expect(dvs3.length).toBe(2);
    expect(dvs3[0].value).toBe("");
    expect(dvs3[1].value).toBe(non_owner_user.id);
    const dvs4 = await ownerField.distinct_values({ user: owner_user });

    expect(dvs4.length).toBe(2);
    expect(dvs4[0].value).toBe("");
    expect(dvs4[1].value).toBe(owner_user.id);

    const dvs5 = await persons.distinctValues("lastname", {}, non_owner_user);
    expect(dvs5.length).toBe(0);

    expect(dvs5.length).toBe(0);
    const dvs6 = await persons.distinctValues("lastname", {}, owner_user);

    expect(dvs6.length).toBe(2);

    //prevent setting owner to someone else
    const upres = await persons.updateRow(
      { owner: non_owner_user },
      alexid,
      owner_user
    );
    expect(upres).toBe("Not authorized");

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
describe("Table with row ownership formula and no ownership field", () => {
  it("blocks non-owner inserts and forging ownership", async () => {
    const notes = await Table.create("PrivateNotes", { min_role_write: 1 });
    await Field.create({
      table: notes,
      name: "author_id",
      type: "Integer",
    });
    await Field.create({
      table: notes,
      name: "content",
      type: "String",
    });
    // Formula-only ownership: the row's author_id must equal the acting user's id.
    await notes.update({
      ownership_formula: "user.id === author_id",
      ownership_field_id: null,
    });
    const owner_less_than_min = owner_user.role_id > notes.min_role_write;
    expect(owner_less_than_min).toBe(true); // role 80 > min_role_write 1

    // A below-min_role_write user forging another user's ownership: blocked.
    const forged = await notes.insertRow(
      { author_id: 999, content: "injected by attacker" },
      non_owner_user
    );
    expect(forged).toBe(undefined);
    expect(await notes.getRow({ content: "injected by attacker" })).toBe(null);

    // Same user trying to attribute a row to another real user: blocked.
    const forgedAdmin = await notes.insertRow(
      { author_id: owner_user.id, content: "spam" },
      non_owner_user
    );
    expect(forgedAdmin).toBe(undefined);
    expect(await notes.getRow({ content: "spam" })).toBe(null);

    // Inserting a row the user actually owns (author_id === own id): allowed.
    const okId = await notes.insertRow(
      { author_id: non_owner_user.id, content: "mine" },
      non_owner_user
    );
    expect(okId).toBeTruthy();
    expect((await notes.getRow({ content: "mine" }))?.author_id).toBe(
      non_owner_user.id
    );

    await notes.delete();
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
          tenant: db.getTenantSchema(),
          where: { manager: 1 },
        },
      },
    });

    await department.insertRow({ name: "Accounting", manager: 1 });
    await department.insertRow({ name: "HR", manager: 2 });

    await persons.insertRow({ lastname: "Joe", age: 12, department: 2 });
    await persons.insertRow({ lastname: "Sam", age: 13, department: 1 });
    const owned_rows = await persons.getRows({}, { forUser: owner_user });
    expect(owned_rows.length).toBe(1);
    expect(owned_rows[0].lastname).toBe("Sam");
    expect(owned_rows[0].department).toBe(1);
    const selected_owned_rows = await persons.getRows(
      {},
      { forUser: owner_user, fields: ["lastname"] }
    );
    expect(selected_owned_rows.length).toBe(1);
    expect(selected_owned_rows[0].lastname).toBe("Sam");
    if (!db.isSQLite)
      expect(selected_owned_rows).toStrictEqual([{ lastname: "Sam" }]);
    const owned_row_get = await persons.getRow(
      { lastname: "Sam" },
      { forUser: owner_user }
    );
    expect(owned_row_get?.lastname).toBe("Sam");
    expect(
      await persons.getRow({ lastname: "Joe" }, { forUser: owner_user })
    ).toBe(null);
    const selected_owned_row = await persons.getRow(
      { lastname: "Sam" },
      { forUser: owner_user, fields: ["lastname"] }
    );
    expect(selected_owned_row?.lastname).toBe("Sam");
    if (!db.isSQLite)
      expect(selected_owned_row).toStrictEqual({ lastname: "Sam" });
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
          tenant: db.getTenantSchema(),
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
          field: "manager",
          table: "_Department",
          tenant: db.getTenantSchema(),
          through: "users",
          through_pk: "id",
          valField: "id",
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
    const users = Table.findOne({ name: "users" })!;
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

    const projs = Table.findOne({ name: "Project" })!;
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

    const projs = Table.findOne({ name: "The Project" })!;
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
    const tasks = Table.findOne("tasks1")!;
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
    const tasks = Table.findOne("tasks1")!;
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
    const tasks = Table.findOne("tasks1")!;
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

describe("ownership_options cases", () => {
  it("case 2: reverse FK from users appears in ownership_options", async () => {
    // users.home_project → Key to projects
    const projects = await Table.create("OwnerOptProjects");
    await Field.create({ table: projects, name: "title", type: "String" });

    const users = Table.findOne({ name: "users" })!;
    assertIsSet(users);
    await Field.create({
      table: users,
      name: "home_project",
      type: "Key to OwnerOptProjects",
    });

    const projs = Table.findOne({ name: "OwnerOptProjects" })!;
    assertIsSet(projs);
    const opts = await projs.ownership_options();
    const revFk = opts.find((o) =>
      o.value.startsWith("Fml:user.home_project===id")
    );
    expect(revFk).toBeDefined();
    expect(revFk?.label).toBe("users.home project [Key to OwnerOptProjects]");

    // delete the FK field on users before dropping the referenced table
    const hpField = await Field.findOne({
      name: "home_project",
      table_id: users.id,
    });
    if (hpField) await hpField.delete();
    await projs.delete();
  });

  it("case 3: inherit via ownership_field_id appears in ownership_options", async () => {
    const dept = await Table.create("OwnerOptDept");
    await Field.create({ table: dept, name: "name", type: "String" });
    const mgr = await Field.create({
      table: dept,
      name: "manager",
      type: "Key to users",
    });
    await dept.update({ ownership_field_id: mgr.id });

    const items = await Table.create("OwnerOptItems");
    await Field.create({ table: items, name: "label", type: "String" });
    await Field.create({
      table: items,
      name: "dept",
      type: "Key to OwnerOptDept",
    });

    const itemsT = Table.findOne({ name: "OwnerOptItems" })!;
    assertIsSet(itemsT);
    const opts = await itemsT.ownership_options();
    const inherit = opts.find((o) => o.label === "Inherit dept");
    expect(inherit).toBeDefined();
    expect(inherit?.value).toBe(
      "Fml:dept?.manager===user.id /* Inherit dept */"
    );

    await items.delete();
    await dept.delete();
  });
});

describe("authorize_* hook dispatch", () => {
  it("only runs hooks matching the request kind", async () => {
    let viewCalls = 0;
    let pageCalls = 0;
    let triggerCalls = 0;
    let apiCalls = 0;
    // scoped to a probe marker (not a real entity name) - this test only
    // checks that dispatch is scoped by kind, not any specific target, but
    // an unconditional deny would otherwise leak into every later test that
    // expects a genuine abstain (null) for an unrelated view/page/trigger
    const probe = "counting_hooks_test_probe";
    const countingPlugin = {
      sc_plugin_api_version: 1,
      authorize_view: async (request: any) => {
        if (request.probe !== probe) return null;
        viewCalls++;
        return { decision: "deny" };
      },
      authorize_page: async (request: any) => {
        if (request.probe !== probe) return null;
        pageCalls++;
        return { decision: "deny" };
      },
      authorize_trigger: async (request: any) => {
        if (request.probe !== probe) return null;
        triggerCalls++;
        return { decision: "deny" };
      },
      authorize_api: async (request: any) => {
        if (request.route !== "dispatch_test_api") return null;
        apiCalls++;
        return { decision: "deny" };
      },
    } as unknown as Plugin;
    getState()!.registerPlugin("counting_hooks_plugin", countingPlugin);

    // view/page/trigger requests are otherwise incomplete on purpose
    // (unknown-cast) - this test only checks that dispatch is scoped by
    // kind, not any specific target. The real call sites (View.authorize,
    // Page.authorize, Trigger.authorize) always populate a real entity.
    await getState()!.authorizeView(
      { action: "get", req, probe } as unknown as AuthorizeAccessViewRequest,
      req.user
    );
    expect(viewCalls).toBe(1);
    expect(pageCalls).toBe(0);
    expect(triggerCalls).toBe(0);
    expect(apiCalls).toBe(0);

    await getState()!.authorizePage(
      { action: "get", req, probe } as unknown as AuthorizeAccessPageRequest,
      req.user
    );
    expect(pageCalls).toBe(1);
    expect(viewCalls).toBe(1);

    await getState()!.authorizeTrigger(
      {
        action: "post",
        req,
        probe,
      } as unknown as AuthorizeAccessTriggerRequest,
      req.user
    );
    expect(triggerCalls).toBe(1);
    expect(pageCalls).toBe(1);
    expect(viewCalls).toBe(1);

    await getState()!.authorizeApi(
      req.user,
      {
        route: "dispatch_test_api",
        action: "get",
        req,
      },
      1,
      1
    );
    expect(apiCalls).toBe(1);
    expect(triggerCalls).toBe(1);
    expect(pageCalls).toBe(1);
    expect(viewCalls).toBe(1);
  });

  it("allows if any hook allows, regardless of registration order", async () => {
    const probeName = "authz_test_allow_wins";
    getState()!.registerPlugin("deny_hook_plugin", {
      sc_plugin_api_version: 1,
      authorize_api: async (request: AuthorizeAccessApiRequest) => {
        if (request.route !== probeName) return null;
        return { decision: "deny", reason: "first hook says no" };
      },
    } as unknown as Plugin);
    getState()!.registerPlugin("allow_hook_plugin", {
      sc_plugin_api_version: 1,
      authorize_api: async (request: AuthorizeAccessApiRequest) => {
        if (request.route !== probeName) return null;
        return { decision: "allow" };
      },
    } as unknown as Plugin);

    const allowed = await getState()!.authorizeApi(
      req.user,
      {
        route: probeName,
        action: "get",
        req,
      },
      100,
      1
    );
    expect(allowed).toBe(true);
  });

  it("abstains (null) when no hook has an opinion, but preserves an explicit deny's reason", async () => {
    // Uses authorizeTrigger (rather than authorizeApi) since it's one of
    // the methods that surfaces the raw AuthorizeAccessResult (with
    // .reason) - the underlying aggregation logic is shared across all kinds.
    const result = await getState()!.authorizeTrigger(
      {
        action: "get",
        trigger: { name: "authz_test_no_hook_allows" } as any,
        req,
      } as AuthorizeAccessTriggerRequest,
      req.user
    );
    expect(result).toBe(null);

    getState()!.registerPlugin("reason_hook_plugin", {
      sc_plugin_api_version: 1,
      authorize_trigger: async (request: AuthorizeAccessTriggerRequest) => {
        if (request.trigger.name !== "authz_test_reason") return null;
        return { decision: "deny", reason: "explicitly not allowed" };
      },
    } as unknown as Plugin);
    const result2 = await getState()!.authorizeTrigger(
      {
        action: "get",
        trigger: { name: "authz_test_reason" } as any,
        req,
      } as AuthorizeAccessTriggerRequest,
      req.user
    );
    expect(result2?.decision).toBe("deny");
    expect((result2 as any)?.reason).toBe("explicitly not allowed");
  });

  it("skips hooks that abstain by returning null/undefined", async () => {
    const probeName = "authz_test_abstain";
    getState()!.registerPlugin("null_abstain_hook_plugin", {
      sc_plugin_api_version: 1,
      authorize_api: async (request: AuthorizeAccessApiRequest) => {
        if (request.route !== probeName) return null;
        return undefined; // abstains even though it matched the route
      },
    } as unknown as Plugin);
    getState()!.registerPlugin("undefined_abstain_then_allow_hook_plugin", {
      sc_plugin_api_version: 1,
      authorize_api: async (request: AuthorizeAccessApiRequest) => {
        if (request.route !== probeName) return undefined;
        return { decision: "allow" };
      },
    } as unknown as Plugin);

    const allowed = await getState()!.authorizeApi(
      req.user,
      {
        route: probeName,
        action: "get",
        req,
      },
      100,
      1
    );
    expect(allowed).toBe(true);
  });

  it("calls (cfg) => hook once per request on a plugin with a configuration_workflow, not once at registration", async () => {
    // Plugins with a configuration_workflow have every facility, including
    // authorize_* hooks, invoked as (cfg) => value by registerPlugin - so
    // the hook itself must be wrapped in an extra (cfg) => ... layer.
    let wrappedHookRequestCalls = 0;
    getState()!.registerPlugin("configured_plugin_correct_hook", {
      sc_plugin_api_version: 1,
      configuration_workflow: () => ({} as any),
      authorize_view:
        (cfg: any) => async (request: AuthorizeAccessViewRequest) => {
          if (request.view.name !== "cfg_wrapped_view") return null;
          wrappedHookRequestCalls++;
          return { decision: "allow" };
        },
    } as unknown as Plugin);
    expect(wrappedHookRequestCalls).toBe(0); // not called at registration time

    const allowed = await getState()!.authorizeView(
      {
        action: "get",
        view: { name: "cfg_wrapped_view" } as any,
        req,
      } as AuthorizeAccessViewRequest,
      req.user
    );
    expect(allowed?.decision).toBe("allow");
    expect(wrappedHookRequestCalls).toBe(1);
  });

  it("a higher-priority deny overrides a lower-priority allow", async () => {
    const probeName = "authz_test_priority_deny_wins";
    getState()!.registerPlugin("low_priority_allow_hook_plugin", {
      sc_plugin_api_version: 1,
      authorize_api: async (request: AuthorizeAccessApiRequest) => {
        if (request.route !== probeName) return null;
        return { decision: "allow" }; // priority defaults to 0
      },
    } as unknown as Plugin);
    getState()!.registerPlugin("high_priority_deny_hook_plugin", {
      sc_plugin_api_version: 1,
      authorize_api: async (request: AuthorizeAccessApiRequest) => {
        if (request.route !== probeName) return null;
        return { decision: "deny", priority: 10 };
      },
    } as unknown as Plugin);

    const allowed = await getState()!.authorizeApi(
      req.user,
      { route: probeName, action: "get", req },
      1,
      1
    );
    expect(allowed).toBe(false);
  });

  it("a higher-priority allow overrides a lower-priority deny", async () => {
    const probeName = "authz_test_priority_allow_wins";
    getState()!.registerPlugin("low_priority_deny_hook_plugin", {
      sc_plugin_api_version: 1,
      authorize_api: async (request: AuthorizeAccessApiRequest) => {
        if (request.route !== probeName) return null;
        return { decision: "deny" }; // priority defaults to 0
      },
    } as unknown as Plugin);
    getState()!.registerPlugin("high_priority_allow_hook_plugin", {
      sc_plugin_api_version: 1,
      authorize_api: async (request: AuthorizeAccessApiRequest) => {
        if (request.route !== probeName) return null;
        return { decision: "allow", priority: 10 };
      },
    } as unknown as Plugin);

    const allowed = await getState()!.authorizeApi(
      req.user,
      { route: probeName, action: "get", req },
      100,
      1
    );
    expect(allowed).toBe(true);
  });
});

// req.user is role_id 1, which passes almost any min_role - need a weaker
// user to test "role check fails" and "role check already passes" scenarios
const lowPrivReq = { ...req, user: { id: 99, role_id: 40, attributes: {} } };

// authorize() is the one full access decision: a hook's explicit allow/deny
// always wins over role; only when every hook abstains does min_role decide.
describe("View.authorize", () => {
  it("denies when role fails min_role and no hook has an opinion", async () => {
    const v = await View.create({
      viewtemplate: "Show",
      name: "AuthzTestView",
      description: "",
      min_role: 1, // admin-only - lowPrivReq's role fails
      table_id: Table.findOne("books")!.id,
      default_render_page: "",
      slug: { label: "", steps: [] },
      attributes: {},
      configuration: { columns: [], layout: { type: "blank", contents: "hi" } },
    });
    const allowed = await v.authorize(lowPrivReq.user, {
      action: "get",
      req: lowPrivReq,
      state: {},
    });
    expect(allowed).toBe(false);
  });

  it("grants access via a hook despite a failing role", async () => {
    const v = View.findOne({ name: "AuthzTestView" });
    assertIsSet(v);
    getState()!.registerPlugin("view_allow_hook_plugin", {
      sc_plugin_api_version: 1,
      authorize_view: async (request: AuthorizeAccessViewRequest) => {
        if (request.view.name !== "AuthzTestView") return null;
        return { decision: "allow" };
      },
    } as unknown as Plugin);
    const allowed = await v.authorize(lowPrivReq.user, {
      action: "get",
      req: lowPrivReq,
      state: {},
    });
    expect(allowed).toBe(true);
  });

  it("denies via a hook despite an already-passing role", async () => {
    const v = await View.create({
      viewtemplate: "Show",
      name: "AuthzTestDenyOverrideView",
      description: "",
      min_role: 100, // public - lowPrivReq's role already qualifies
      table_id: Table.findOne("books")!.id,
      default_render_page: "",
      slug: { label: "", steps: [] },
      attributes: {},
      configuration: {
        columns: [],
        layout: { type: "blank", contents: "SHOULD_NOT_APPEAR" },
      },
    });
    getState()!.registerPlugin("view_deny_override_plugin", {
      sc_plugin_api_version: 1,
      authorize_view: async (request: AuthorizeAccessViewRequest) => {
        if (request.view.name !== "AuthzTestDenyOverrideView") return null;
        return { decision: "deny", reason: "blocked despite qualifying role" };
      },
    } as unknown as Plugin);
    const allowed = await v.authorize(lowPrivReq.user, {
      action: "get",
      req: lowPrivReq,
      state: {},
    });
    expect(allowed).toBe(false);
  });

  it("falls back to min_role when every hook abstains", async () => {
    // a fresh view name, untouched by the deny hook registered above
    const v = await View.create({
      viewtemplate: "Show",
      name: "AuthzTestAbstainFallbackView",
      description: "",
      min_role: 100,
      table_id: Table.findOne("books")!.id,
      default_render_page: "",
      slug: { label: "", steps: [] },
      attributes: {},
      configuration: {
        columns: [],
        layout: { type: "blank", contents: "FALLBACK_OK" },
      },
    });
    const allowed = await v.authorize(lowPrivReq.user, {
      action: "get",
      req: lowPrivReq,
      state: {},
    });
    expect(allowed).toBe(true);
  });

  it("uses a user's real role even when their id is 0 (room.ts renders for other viewers as {...user, id: 0})", async () => {
    const v = await View.create({
      viewtemplate: "Show",
      name: "AuthzTestIdZeroUser",
      description: "",
      min_role: 40,
      table_id: Table.findOne("books")!.id,
      default_render_page: "",
      slug: { label: "", steps: [] },
      attributes: {},
      configuration: {
        columns: [],
        layout: { type: "blank", contents: "ID_ZERO_OK" },
      },
    });
    const allowed = await v.authorize(
      { ...lowPrivReq.user, id: 0 },
      { action: "get", req: lowPrivReq, state: {} }
    );
    expect(allowed).toBe(true);
  });

  it("deprecated authorise_get/authorise_post still delegate to authorize()", async () => {
    const v = View.findOne({ name: "AuthzTestView" });
    assertIsSet(v);
    const allowedGet = await v.authorise_get({
      query: {},
      table_id: v.table_id as number,
      req: lowPrivReq,
    });
    // view_allow_hook_plugin (registered above) still grants an exception
    expect(allowedGet).toBe(true);
  });
});

describe("Page.authorize", () => {
  it("denies when role fails min_role and no hook has an opinion", async () => {
    const page = await Page.create({
      name: "AuthzTestPage",
      title: "t",
      description: "",
      min_role: 1,
      layout: { type: "blank", contents: "hi" },
    });
    const allowed = await page.authorize(lowPrivReq.user, {
      action: "get",
      req: lowPrivReq,
      state: {},
    });
    expect(allowed).toBe(false);
  });

  it("grants access via a hook despite a failing role", async () => {
    const page = Page.findOne({ name: "AuthzTestPage" });
    assertIsSet(page);
    getState()!.registerPlugin("page_allow_hook_plugin", {
      sc_plugin_api_version: 1,
      authorize_page: async (request: AuthorizeAccessPageRequest) => {
        if (request.page.name !== "AuthzTestPage") return null;
        return { decision: "allow" };
      },
    } as unknown as Plugin);
    const allowed = await page.authorize(lowPrivReq.user, {
      action: "get",
      req: lowPrivReq,
      state: {},
    });
    expect(allowed).toBe(true);
  });

  it("denies via a hook despite an already-passing role", async () => {
    const page = await Page.create({
      name: "AuthzTestDenyOverridePage",
      title: "t",
      description: "",
      min_role: 100, // public - lowPrivReq's role already qualifies
      layout: { type: "blank", contents: "SHOULD_NOT_APPEAR" },
    });
    getState()!.registerPlugin("page_deny_override_plugin", {
      sc_plugin_api_version: 1,
      authorize_page: async (request: AuthorizeAccessPageRequest) => {
        if (request.page.name !== "AuthzTestDenyOverridePage") return null;
        return { decision: "deny", reason: "blocked despite qualifying role" };
      },
    } as unknown as Plugin);
    const allowed = await page.authorize(lowPrivReq.user, {
      action: "get",
      req: lowPrivReq,
      state: {},
    });
    expect(allowed).toBe(false);
  });
});

describe("Trigger.authorize", () => {
  it("denies when role fails min_role and no hook has an opinion", async () => {
    const trig = await Trigger.create({
      name: "AuthzTestTrigger",
      action: "run_js_code",
      when_trigger: "API call",
      min_role: 1,
      configuration: { code: "return 1" },
    });
    const allowed = await trig.authorize(lowPrivReq.user, {
      action: "post",
      req: lowPrivReq,
      body: {},
    });
    expect(allowed).toBe(false);
  });

  it("grants access via a hook despite a failing role", async () => {
    const trig = Trigger.findOne({ name: "AuthzTestTrigger" });
    assertIsSet(trig);
    getState()!.registerPlugin("trigger_allow_hook_plugin", {
      sc_plugin_api_version: 1,
      authorize_trigger: async (request: AuthorizeAccessTriggerRequest) => {
        if (request.trigger.name !== "AuthzTestTrigger") return null;
        return { decision: "allow" };
      },
    } as unknown as Plugin);
    const allowed = await trig.authorize(lowPrivReq.user, {
      action: "post",
      req: lowPrivReq,
      body: {},
    });
    expect(allowed).toBe(true);
  });

  it("denies via a hook despite an already-passing role", async () => {
    const trig = await Trigger.create({
      name: "AuthzTestDenyOverrideTrigger",
      action: "run_js_code",
      when_trigger: "API call",
      min_role: 100, // public - lowPrivReq's role already qualifies
      configuration: { code: "return 1" },
    });
    getState()!.registerPlugin("trigger_deny_override_plugin", {
      sc_plugin_api_version: 1,
      authorize_trigger: async (request: AuthorizeAccessTriggerRequest) => {
        if (request.trigger.name !== "AuthzTestDenyOverrideTrigger") return null;
        return { decision: "deny", reason: "blocked despite qualifying role" };
      },
    } as unknown as Plugin);
    const allowed = await trig.authorize(lowPrivReq.user, {
      action: "post",
      req: lowPrivReq,
      body: {},
    });
    expect(allowed).toBe(false);
  });
});

describe("View.run honors authorize_view, not just min_role", () => {
  it("returns empty when role fails min_role and no hook grants access", async () => {
    const view = await View.create({
      viewtemplate: "Show",
      name: "AuthzTestRunShow",
      description: "",
      min_role: 1,
      table_id: Table.findOne("books")!.id,
      default_render_page: "",
      slug: { label: "", steps: [] },
      attributes: {},
      configuration: {
        columns: [],
        layout: { type: "blank", contents: "RUN_SHOW_SENTINEL" },
      },
    });
    const html = await view.run({ id: 1 }, { req: lowPrivReq, res: mockReqRes.res } as any);
    expect(html).toBe("");
  });

  it("runs when an authorize_view hook grants access despite insufficient role", async () => {
    getState()!.registerPlugin("view_run_allow_hook_plugin", {
      sc_plugin_api_version: 1,
      authorize_view: async (request: AuthorizeAccessViewRequest) => {
        if (request.view.name !== "AuthzTestRunShow") return null;
        return { decision: "allow" };
      },
    } as unknown as Plugin);
    const view = View.findOne({ name: "AuthzTestRunShow" });
    assertIsSet(view);
    const html = await view.run({ id: 1 }, { req: lowPrivReq, res: mockReqRes.res } as any);
    expect(html).toContain("RUN_SHOW_SENTINEL");
  });
});

// alreadyAuthorizedFor is a reference check (`!==`), safe only because
// View.findOne/find always return a fresh object - never a cached instance
// shared between two lookups of the same view. These tests guard that
// invariant directly, so a future change that breaks it fails loudly here
// instead of silently reopening the embedding bypass it was added to fix.
describe("alreadyAuthorizedFor relies on View lookups never being aliased", () => {
  it("View.findOne returns a distinct object on every call", () => {
    const a = View.findOne({ name: "AuthzTestRunShow" });
    const b = View.findOne({ name: "AuthzTestRunShow" });
    assertIsSet(a);
    assertIsSet(b);
    expect(a).not.toBe(b);
  });

  it("a second lookup of the same view is still independently authorized, even if alreadyAuthorizedFor points at the first", async () => {
    await View.create({
      viewtemplate: "Show",
      name: "AuthzTestAliasingShow",
      description: "",
      min_role: 1,
      table_id: Table.findOne("books")!.id,
      default_render_page: "",
      slug: { label: "", steps: [] },
      attributes: {},
      configuration: {
        columns: [],
        layout: { type: "blank", contents: "ALIASING_SENTINEL" },
      },
    });
    const first = View.findOne({ name: "AuthzTestAliasingShow" });
    const second = View.findOne({ name: "AuthzTestAliasingShow" });
    assertIsSet(first);
    assertIsSet(second);
    expect(first).not.toBe(second);
    const html = await second.run(
      { id: 1 },
      {
        req: lowPrivReq,
        res: mockReqRes.res,
        alreadyAuthorizedFor: first,
      } as any
    );
    expect(html).toBe("");
  });
});

// Page.run() itself does not check min_role/authorize_page - direct visits
// are gated by the route (server/routes/page.ts), embeds by the embedder
// (Page.renderEachEmbeddedPageInLayout). See that describe block below.
describe("Page.run does not gate access itself", () => {
  it("renders regardless of min_role for a direct call", async () => {
    const page = await Page.create({
      name: "AuthzTestRunPage",
      title: "t",
      description: "",
      min_role: 1,
      layout: { type: "blank", contents: "RUN_PAGE_SENTINEL" },
    });
    const contents = await page.run({}, { req: lowPrivReq, res: mockReqRes.res });
    expect(JSON.stringify(contents)).toContain("RUN_PAGE_SENTINEL");
  });
});

describe("Page embeds honor authorize_page, checked by the embedder", () => {
  it("enforces min_role/authorize_page on an embedded page", async () => {
    const inner = await Page.create({
      name: "AuthzTestEmbeddedInnerPage",
      title: "t",
      description: "",
      min_role: 1,
      layout: { type: "blank", contents: "INNER_PAGE_SENTINEL" },
    });
    const outer = await Page.create({
      name: "AuthzTestEmbeddedOuterPage",
      title: "t",
      description: "",
      min_role: 100, // public - the outer page itself is always reachable
      layout: { type: "page", page: inner.name },
    });

    const deniedContents = await outer.run(
      {},
      { req: lowPrivReq, res: mockReqRes.res }
    );
    expect(JSON.stringify(deniedContents)).not.toContain("INNER_PAGE_SENTINEL");

    getState()!.registerPlugin("embedded_page_allow_hook_plugin", {
      sc_plugin_api_version: 1,
      authorize_page: async (request: AuthorizeAccessPageRequest) => {
        if (request.page.name !== "AuthzTestEmbeddedInnerPage") return null;
        return { decision: "allow" };
      },
    } as unknown as Plugin);
    const allowedContents = await outer.run(
      {},
      { req: lowPrivReq, res: mockReqRes.res }
    );
    expect(JSON.stringify(allowedContents)).toContain("INNER_PAGE_SENTINEL");
  });
});

