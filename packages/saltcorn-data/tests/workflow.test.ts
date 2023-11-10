import Form from "../models/form";
import Field from "../models/field";
import Workflow from "../models/workflow";
import View from "../models/view";
import db from "../db";
import { assertIsSet } from "./assertions";
import { afterAll, describe, it, expect } from "@jest/globals";
import { GenObj } from "@saltcorn/types/common_types";

const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
import mocks from "./mocks";
const { mockReqRes } = mocks;

afterAll(db.close);

const wf = new Workflow({
  steps: [
    {
      name: "step1",
      form: async (context: any) => {
        return new Form({
          blurb: "Specify the fields in the table to show",
          fields: [{ name: "colour", label: "Colour", input_type: "text" }],
        });
      },
    },
    {
      name: "step2",
      contextField: "substep",
      form: async (context: any) => {
        return new Form({
          blurb: "Specify the fields in the table to show",
          fields: [
            { name: "age", label: "Age", type: "Integer", required: true },
          ],
        });
      },
    },
  ],
});
const wf1 = new Workflow({
  steps: [
    {
      name: "step1",
      form: async (context: any) => {
        return new Form({
          blurb: "Specify the fields in the table to show",
          fields: [
            { name: "colour", label: "Colour", input_type: "text" },
            { name: "is_nice", type: "Bool" },
          ],
        });
      },
    },
  ],
});

const wfbuild = new Workflow({
  steps: [
    {
      name: "step1",
      builder: async (context: any) => {
        return { mode: "foo" };
      },
    },
  ],
});

describe("Workflow", () => {
  it("should run with context", async () => {
    const v = await wf.run({ foo: "bar" });
    assertIsSet(v);
    expect(v.renderForm.values.contextEnc).toContain("bar");
    const hiddenFields = v.renderForm.fields
      .filter((f: Field) => f.input_type === "hidden")
      .map((f: Field) => f.name);
    expect(hiddenFields).toContain("contextEnc");
    let submit: any = { colour: "Blue" };
    hiddenFields.forEach((f: string) => {
      submit[f] = v.renderForm.values[f];
    });
    const v1 = await wf.run(submit);
    assertIsSet(v1);
    expect(v1.renderForm.values.contextEnc).toContain("bar");

    const hiddenFields1 = v1.renderForm.fields
      .filter((f: Field) => f.input_type === "hidden")
      .map((f: Field) => f.name);
    expect(hiddenFields1).toContain("contextEnc");
    let submit1: any = { age: "67" };
    hiddenFields1.forEach((f: string) => {
      submit1[f] = v1.renderForm.values[f];
    });
    const v2 = await wf.run(submit1);
    expect(v2).toStrictEqual({
      colour: "Blue",
      foo: "bar",
      substep: { age: 67 },
    });
    var submit_missing: GenObj = {};
    hiddenFields1.forEach((f: string) => {
      submit_missing[f] = v1.renderForm.values[f];
    });
    const v3 = await wf.run(submit_missing);
    assertIsSet(v3);
    expect(v3.renderForm.values.contextEnc).toContain("bar");
  });
  it("should run with existing", async () => {
    const v = await wf1.run({ colour: "purple", is_nice: "on" });
    assertIsSet(v);
    expect(v.renderForm.values.colour).toBe("purple");
    expect(v.renderForm.values.is_nice).toBe(true);
  });
  it("should run builder", async () => {
    const v = await wfbuild.run({});
    assertIsSet(v);
    assertIsSet(v.renderBuilder);
    expect(v.renderBuilder.mode).toBe("foo");
    var submit1 = {
      layout: encodeURIComponent("{}"),
      columns: encodeURIComponent("{}"),
      stepName: v.stepName,
      contextEnc: encodeURIComponent(JSON.stringify(v.context)),
    };
    const v2 = await wfbuild.run(submit1);
    expect(v2).toEqual({ columns: {}, layout: {} });
  });
});

describe("Edit view Workflow", () => {
  beforeAll(async () => {
    await require("../db/reset_schema")();
    await require("../db/fixtures")();
  });

  it("runs step 3: Edit options", async () => {
    const view = View.findOne({ name: "authoredit" });
    assertIsSet(view);
    const configFlow = await view.get_config_flow(mockReqRes.req);
    assertIsSet(configFlow);
    configFlow.onStepSuccess = async (step, context) => {
      expect(step.name).toBe("Edit options");
      expect(context).toEqual({
        table_id: 2,
        viewname: "edit_mybook",
        layout: view.configuration.layout,
        columns: view.configuration.columns,
        auto_save: true,
        split_paste: true,
        destination_type: "View",
        view_when_done: "authorlist",
        page_when_done: null,
        dest_url_formula: null,
        formula_destinations: [],
      });
    };
    const wfres = await configFlow.run(
      {
        contextEnc: JSON.stringify({
          table_id: view.table_id,
          viewname: "edit_mybook",
          layout: view.configuration.layout,
          columns: view.configuration.columns,
        }),
        stepName: "Edit options",
        destination_type: "View",
        view_when_done: "authorlist",
        auto_save: "on",
        split_paste: "on",
      },
      mockReqRes.req
    );
    assertIsSet(wfres);
    expect(wfres).toEqual({
      redirect: "/viewedit",
      flash: ["success", "View authoredit saved"],
    });

    const viewNew = View.findOne({ name: "authoredit" });
    assertIsSet(viewNew);

    expect(viewNew.configuration).toEqual({
      layout: {
        above: [{ type: "field", fieldview: "edit", field_name: "author" }],
      },
      columns: [{ type: "Field", field_name: "author" }],
      viewname: "edit_mybook",
      auto_save: true,
      split_paste: true,
      page_when_done: null,
      view_when_done: "authorlist",
      dest_url_formula: null,
      destination_type: "View",
      formula_destinations: [],
    });
  });

  it("runs step 2: Fixed and blocked fields", async () => {
    const view = View.findOne({ name: "authoredit" });
    assertIsSet(view);
    const configFlow = await view.get_config_flow(mockReqRes.req);
    assertIsSet(configFlow);
    configFlow.onStepSuccess = async (step, context) => {
      expect(step.name).toBe("Fixed and blocked fields");
      expect(step.contextField).toBe("fixed");
      expect(context).toEqual({
        table_id: 2,
        viewname: "edit_mybook",
        layout: view.configuration.layout,
        columns: view.configuration.columns,
        fixed: {
          pages: 4,
          publisher: null,
          _block_pages: false,
          _block_publisher: false,
        },
      });
    };
    const wfres = await configFlow.run({
      contextEnc: JSON.stringify({
        table_id: view.table_id,
        viewname: "edit_mybook",
        layout: view.configuration.layout,
        columns: view.configuration.columns,
      }),
      stepName: "Fixed and blocked fields",
      pages: 4,
    });
    assertIsSet(wfres);

    expect(wfres.context).toEqual({
      table_id: 2,
      viewname: "edit_mybook",
      layout: {
        above: [{ type: "field", fieldview: "edit", field_name: "author" }],
      },
      columns: [{ type: "Field", field_name: "author" }],
      fixed: {
        pages: 4,
        publisher: null,
        _block_pages: false,
        _block_publisher: false,
      },
    });
    expect(wfres.title).toBe("Edit options (step 3 / 3)");
  });

  it("run step 3 with a fixed field", async () => {
    const view = View.findOne({ name: "authoredit" });
    assertIsSet(view);
    const configFlow = await view.get_config_flow(mockReqRes.req);
    assertIsSet(configFlow);
    const wfres = await configFlow.run(
      {
        contextEnc: JSON.stringify({
          table_id: 2,
          viewname: "edit_mybook",
          layout: view.configuration.layout,
          columns: view.configuration.columns,
          fixed: {
            pages: 4,
            publisher: null,
            _block_pages: false,
            _block_publisher: false,
          },
        }),
        stepName: "Edit options",
        destination_type: "View",
        view_when_done: "authorlist",
        auto_save: "on",
        split_paste: "on",
      },
      mockReqRes.req
    );
    assertIsSet(wfres);
    expect(wfres).toEqual({
      redirect: "/viewedit",
      flash: ["success", "View authoredit saved"],
    });

    const viewNew = View.findOne({ name: "authoredit" });
    assertIsSet(viewNew);

    expect(viewNew.configuration).toEqual({
      fixed: {
        pages: 4,
        publisher: null,
        _block_pages: false,
        _block_publisher: false,
      },
      layout: {
        above: [{ type: "field", fieldview: "edit", field_name: "author" }],
      },
      columns: [{ type: "Field", field_name: "author" }],
      viewname: "edit_mybook",
      auto_save: true,
      split_paste: true,
      page_when_done: null,
      view_when_done: "authorlist",
      dest_url_formula: null,
      destination_type: "View",
      formula_destinations: [],
    });
  });
});
