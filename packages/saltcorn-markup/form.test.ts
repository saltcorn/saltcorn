import { describe, it, expect } from "@jest/globals";
import tags = require("./tags");
const { a, input, div, ul, text, text_attr } = tags;
import index = require(".");
const { renderForm } = index;

class Form {
  constructor(o: any) {
    Object.entries(o).forEach(([k, v]: [string, any]) => {
      (this as any)[k] = v;
    });
  }
}

const nolines = (s: string) => s.split("\n").join("");

describe("form render", () => {
  it("renders a simple form", () => {
    const form = new Form({
      action: "/",
      fields: [
        {
          name: "name",
          label: "Name",
          input_type: "text",
          form_name: "name",
        },
      ],
    });
    const want = `<form action="/" class="form-namespace  " method="post">
<input type="hidden" name="_csrf" value=""><div class="form-group">
<div><label for="inputname">Name</label></div>
<div><input type="text" class="form-control  " data-fieldname="name" name="name" id="inputname">
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
          form_name: "name",
        },
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
            field_name: "name",
          },
          { type: "line_break" },
        ],
      },
    });
    const want = `<form action="/" class="form-namespace " method="post">
<input type="hidden" name="_csrf" value="">
<h2>
<input type="text" class="form-control  " data-fieldname="name" name="name" id="inputname">
</h2><br /></form>`;
    expect(nolines(renderForm(form, ""))).toBe(nolines(want));
  });
  it("renders a simple form with errors", () => {
    const form = new Form({
      action: "/",
      errors: { name: "Not a foo" },
      values: { name: "Bar" },
      fields: [
        {
          name: "name",
          label: "Name",
          input_type: "text",
          form_name: "name",
        },
      ],
    });
    const want = `<form action="/" class="form-namespace  " method="post">
<input type="hidden" name="_csrf" value=""><div class="form-group">
<div><label for="inputname">Name</label></div>
<div><input type="text" class="form-control is-invalid " data-fieldname="name" name="name" id="inputname" value="Bar"><div>Not a foo</div>
</div></div><div class="form-group row">
  <div class="col-sm-12">
        <button type="submit" class="btn btn-primary">Save</button>
  </div>
</div>
</form>`;
    expect(nolines(renderForm(form, ""))).toBe(nolines(want));
  });
});
