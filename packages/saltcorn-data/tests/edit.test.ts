import Table from "../models/table";
import Field from "../models/field";
import Trigger from "../models/trigger";
import TableConstraint from "../models/table_constraints";

import View from "../models/view";
import db from "../db";
import mocks from "./mocks";
const { mockReqRes } = mocks;
const { getState } = require("../db/state");
import Page from "../models/page";
import type { PageCfg } from "@saltcorn/types/model-abstracts/abstract_page";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import { assertIsSet } from "./assertions";
import {
  prepareQueryEnviroment,
  sendViewToServer,
  deleteViewFromServer,
  renderEditInEditConfig,
} from "./remote_query_helper";

let remoteQueries = false;

getState().registerPlugin("base", require("../base-plugin"));

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

const mkConfig = (hasSave?: boolean) => {
  return {
    layout: {
      above: [
        {
          widths: [2, 10],
          besides: [
            {
              above: [null, { type: "blank", contents: "Name", isFormula: {} }],
            },
            {
              above: [
                null,
                { type: "field", fieldview: "edit", field_name: "name" },
              ],
            },
          ],
        },
        { type: "line_break" },
        {
          widths: [2, 10],
          besides: [
            {
              above: [null, { type: "blank", contents: "Age", isFormula: {} }],
            },
            {
              above: [
                null,
                { type: "field", fieldview: "edit", field_name: "age" },
              ],
            },
          ],
        },
        { type: "line_break" },

        ...(hasSave
          ? [
              {
                type: "action",
                rndid: "74310f",
                minRole: 100,
                isFormula: {},
                action_name: "Save",
                action_style: "btn-primary",
                configuration: {},
              },
            ]
          : []),
      ],
    },
    columns: [
      { type: "Field", fieldview: "edit", field_name: "name" },
      { type: "Field", fieldview: "edit", field_name: "age" },
      ...(hasSave
        ? [
            {
              type: "Action",
              rndid: "74310f",
              minRole: 100,
              isFormula: {},
              action_name: "Save",
              action_style: "btn-primary",
              configuration: {},
            },
          ]
        : []),
    ],
  };
};

describe("Edit view with constraints and validations", () => {
  it("should setup", async () => {
    const persons = await Table.create("ValidatedTable1");
    await Field.create({
      table: persons,
      name: "name",
      type: "String",
    });
    await Field.create({
      table: persons,
      name: "age",
      type: "Integer",
    });
    await TableConstraint.create({
      table_id: persons.id,
      type: "Formula",
      configuration: {
        formula: "age>12",
        errormsg: "Must be at least a teenager",
      },
    });
    await Trigger.create({
      action: "run_js_code",
      table_id: persons.id,
      when_trigger: "Validate",
      configuration: {
        code: `
        if(age && age<16) return {error: "Must be 16+ to qualify"}
        if(!row.name) return {set_fields: {name: "PersonAged"+age}}
      `,
      },
    });
    await View.create({
      name: "ValidatedWithSave",
      table_id: persons.id,
      viewtemplate: "Edit",
      min_role: 100,
      configuration: mkConfig(true),
    });
    await View.create({
      name: "ValidatedAutoSave",
      table_id: persons.id,
      viewtemplate: "Edit",
      min_role: 100,
      configuration: { ...mkConfig(false), auto_save: true },
    });
  });
  it("should return error on save constrain violation", async () => {
    const v = await View.findOne({ name: "ValidatedWithSave" });
    assertIsSet(v);
    mockReqRes.reset();
    await v.runPost({}, { name: "Fred", age: 10 }, mockReqRes);
    const res = mockReqRes.getStored();
    expect(res.flash).toStrictEqual(["error", "Must be at least a teenager"]);
    expect(res.sendWrap[1]).toContain("<form");
    expect(res.sendWrap[1]).toContain('value="Fred"');
    //console.log(res);
    expect(
      await Table.findOne("ValidatedTable1")!.countRows({ name: "Fred" })
    ).toBe(0);
  });
  it("should return error on save validate violation", async () => {
    const v = await View.findOne({ name: "ValidatedWithSave" });
    assertIsSet(v);
    mockReqRes.reset();
    await v.runPost({}, { name: "Fred", age: 14 }, mockReqRes);
    const res = mockReqRes.getStored();
    expect(res.flash).toStrictEqual(["error", "Must be 16+ to qualify"]);
    expect(res.sendWrap[1]).toContain("<form");
    expect(res.sendWrap[1]).toContain('value="Fred"');
    expect(
      await Table.findOne("ValidatedTable1")!.countRows({ name: "Fred" })
    ).toBe(0);
    //console.log(res);
  });
  it("should return save normally", async () => {
    const v = await View.findOne({ name: "ValidatedWithSave" });
    assertIsSet(v);
    mockReqRes.reset();
    await v.runPost({}, { name: "Fred", age: 18 }, mockReqRes);
    const res = mockReqRes.getStored();

    expect(!!res.flash).toBe(false);
    expect(res.url).toBe("/");

    expect(
      await Table.findOne("ValidatedTable1")!.countRows({ name: "Fred" })
    ).toBe(1);
  });
  it("should return error on autosave constrain violation", async () => {
    const v = await View.findOne({ name: "ValidatedAutoSave" });
    assertIsSet(v);
    mockReqRes.reset();
    mockReqRes.req.xhr = true;
    await v.runPost({}, { name: "Alex", age: 10 }, mockReqRes);
    const res = mockReqRes.getStored();
    expect(res.status).toBe(422);
    expect(res.json.error).toBe("Must be at least a teenager");

    expect(
      await Table.findOne("ValidatedTable1")!.countRows({ name: "Alex" })
    ).toBe(0);
    mockReqRes.reset();
  });
  it("should return error on autosave validate violation", async () => {
    const v = await View.findOne({ name: "ValidatedAutoSave" });
    assertIsSet(v);
    mockReqRes.reset();
    mockReqRes.req.xhr = true;
    await v.runPost({}, { name: "Alex", age: 14 }, mockReqRes);
    const res = mockReqRes.getStored();
    expect(res.status).toBe(422);
    expect(res.json.error).toBe("Must be 16+ to qualify");

    expect(
      await Table.findOne("ValidatedTable1")!.countRows({ name: "Alex" })
    ).toBe(0);
    mockReqRes.reset();
  });
  it("should autosave normally", async () => {
    const v = await View.findOne({ name: "ValidatedAutoSave" });
    assertIsSet(v);
    mockReqRes.reset();
    mockReqRes.req.xhr = true;
    await v.runPost({}, { name: "Alex", age: 18 }, mockReqRes);
    const res = mockReqRes.getStored();

    expect(res.json).toStrictEqual({
      view_when_done: undefined,
      url_when_done: "/",
      id: 2,
    });
    //expect(res.json.error).toBe("Must be 16+ to qualify");

    expect(
      await Table.findOne("ValidatedTable1")!.countRows({ name: "Alex" })
    ).toBe(1);
    mockReqRes.reset();
  });
});
