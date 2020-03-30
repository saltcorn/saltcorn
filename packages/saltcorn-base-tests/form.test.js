const Table = require("saltcorn-data/models/table");
const Field = require("saltcorn-data/models/field");
const FieldRepeat = require("saltcorn-data/models/fieldrepeat");
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
    form.validate({ age: 32 });
    expect(html.includes("<form")).toBe(true);
    expect(html.includes('min="16"')).toBe(true);
    expect(form.values.age).toBe(32);
    done();
  });

  it("should render with repeats", async done => {
    const form = new Form({
      fields: [
        new Field({
          name: "subject",
          label: "Subject",
          type: "String"
        }),
        new FieldRepeat({
          name: "students",
          fields: [
            new Field({
              name: "name",
              label: "Name",
              type: "String"
            }),
            new Field({
              name: "age",
              label: "Age",
              type: "Integer",
              attributes: { min: 16 }
            })
          ]
        })
      ]
    });
    const html = renderForm(form);
    form.validate({
      subject: "Maths",
      age_0: 18,
      name_0: "Fred",
      age_1: 19,
      name_1: "George"
    });
    expect(html.includes("<form")).toBe(true);
    expect(html.includes('name="age_0"')).toBe(true);
    expect(form.values.subject).toBe("Maths");
    expect(form.values.students.length).toBe(2);
    expect(form.values.students[0].name).toBe("Fred");
    expect(form.values.students[1].age).toBe(19);
    done();
  });
});
