const Table = require("saltcorn-data/models/table");
const Field = require("saltcorn-data/models/field");
const Form = require("saltcorn-data/models/form");
const { renderForm } = require("saltcorn-markup");
require("./load_base_types")();

describe("Form", () => {
  it("should render", async done => {
    const form = new Form({
      fields: [
        new Field({
          name: "age",
          label: "Age",
          type: "Integer",
          attributes: { min: 16 }
        })
      ]
    });
    const html = renderForm(form);
    expect(html.includes("<form")).toBe(true);
    expect(html.includes('min="16"')).toBe(true);
    done();
  });
});
