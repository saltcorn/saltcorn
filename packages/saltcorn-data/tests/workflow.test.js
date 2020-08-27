const Form = require("../models/form");
const Field = require("../models/field");
const View = require("../models/view");
const Workflow = require("../models/workflow");
const db = require("../db");

const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
const { mockReqRes } = require("./mocks");

afterAll(db.close);

const wf = new Workflow({
  steps: [
    {
      name: "step1",
      form: async context => {
        return new Form({
          blurb: "Specify the fields in the table to show",
          fields: [{ name: "colour", label: "Colour", input_type: "text" }]
        });
      }
    },
    {
      name: "step2",
      contextField: "substep",
      form: async context => {
        return new Form({
          blurb: "Specify the fields in the table to show",
          fields: [
            { name: "age", label: "Age", type: "Integer", required: true }
          ]
        });
      }
    }
  ]
});
const wf1 = new Workflow({
  steps: [
    {
      name: "step1",
      form: async context => {
        return new Form({
          blurb: "Specify the fields in the table to show",
          fields: [
            { name: "colour", label: "Colour", input_type: "text" },
            { name: "is_nice", type: "Bool" }
          ]
        });
      }
    }
  ]
});

const wfbuild = new Workflow({
  steps: [
    {
      name: "step1",
      builder: async context => {
        return { mode: "foo" };
      }
    }
  ]
});

describe("Workflow", () => {
  it("should run with context", async () => {
    const v = await wf.run({ foo: "bar" });
    expect(v.renderForm.values.contextEnc).toContain("bar");
    const hiddenFields = v.renderForm.fields
      .filter(f => f.input_type === "hidden")
      .map(f => f.name);
    expect(hiddenFields).toContain("contextEnc");
    var submit = { colour: "Blue" };
    hiddenFields.forEach(f => {
      submit[f] = v.renderForm.values[f];
    });
    const v1 = await wf.run(submit);
    expect(v1.renderForm.values.contextEnc).toContain("bar");

    const hiddenFields1 = v1.renderForm.fields
      .filter(f => f.input_type === "hidden")
      .map(f => f.name);
    expect(hiddenFields1).toContain("contextEnc");
    var submit1 = { age: "67" };
    hiddenFields1.forEach(f => {
      submit1[f] = v1.renderForm.values[f];
    });
    const v2 = await wf.run(submit1);
    expect(v2).toStrictEqual({
      colour: "Blue",
      foo: "bar",
      substep: { age: 67 }
    });
    var submit_missing = {};
    hiddenFields1.forEach(f => {
      submit_missing[f] = v1.renderForm.values[f];
    });
    const v3 = await wf.run(submit_missing);
    expect(v3.renderForm.values.contextEnc).toContain("bar");
  });
  it("should run with existing", async () => {
    const v = await wf1.run({ colour: "purple", is_nice: "on" });
    expect(v.renderForm.values.colour).toBe("purple");
    expect(v.renderForm.values.is_nice).toBe(true);
  });
  it("should run builder", async () => {
    const v = await wfbuild.run({});
    expect(v.renderBuilder.mode).toBe("foo");
    var submit1 = {
      layout: encodeURIComponent("{}"),
      columns: encodeURIComponent("{}"),
      stepName: v.stepName,
      contextEnc: encodeURIComponent(JSON.stringify(v.context))
    };
    const v2 = await wfbuild.run(submit1);
    expect(v2).toEqual({ columns: {}, layout: {} });
  });
});
