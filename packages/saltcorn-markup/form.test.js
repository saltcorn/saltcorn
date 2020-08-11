const { a, input, div, ul, text, text_attr } = require("./tags");
const { renderForm } = require(".");

class Form {
  constructor(o) {
    Object.entries(o).forEach(([k, v]) => {
      this[k] = v;
    });
  }
}

const nolines = s => s.split("\n").join("");

describe("form render", () => {
  it("renders a simple form", () => {
    const form = new Form({
      action: "/",
      fields: [
        {
          name: "name",
          label: "Name",
          input_type: "text",
          form_name: "name"
        }
      ]
    });
    const want = `<form action="/" class="form-namespace  undefined" method="post" >
<input type="hidden" name="_csrf" value=""><div class="form-group">
<label for="inputname" >Name</label>
<div><input type="text" class="form-control undefined" name="name" id="inputname" >
</div></div><div class="form-group row">
  <div class="col-sm-12">
    <button type="submit" class="btn btn-primary">Save</button>
  </div>
</div>
</form>`;
    expect(nolines(renderForm(form, ""))).toBe(nolines(want));
  });
  it("renders a form with layout", () => {
    const form = new Form({
      action: "/",
      fields: [
        {
          name: "name",
          label: "Name",
          input_type: "text",
          form_name: "name"
        }
      ],
      values: {},
      errors: {},
      layout: {
        above: [
          {
            type: "field",
            block: false,
            fieldview: "edit",
            textStyle: "h2",
            field_name: "name"
          },
          { type: "line_break" }
        ]
      }
    });
    const want = `<form action="/" class="form-namespace undefined" method="post" >
<input type="hidden" name="_csrf" value="">
<span class="h2">
<input type="text" class="form-control undefined" name="name" id="inputname" >
</span><br /></form>`;
    expect(nolines(renderForm(form, ""))).toBe(nolines(want));
  });
});
