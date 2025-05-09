import { describe, it, expect } from "@jest/globals";
// import tags = require("./tags");
import * as tags from "./tags";
const { a, input, div, ul, text, text_attr } = tags;
// import index = require("./index");
import index from "./index";
const {
  renderForm,
  mkFormContentNoLayout,
  mkForm,
  renderBuilder,
  renderFormLayout,
} = index;

import { AbstractForm as Form } from "@saltcorn/types/model-abstracts/abstract_form";

const nolines = (s: string) => s.split("\n").join("");

describe("form render", () => {
  it("renders a simple form", () => {
    const form: Form = {
      action: "/",
      fields: [
        {
          name: "name",
          label: "Name",
          input_type: "text",
          form_name: "name",
          required: false,
          attributes: {},
          is_fkey: false,
        },
      ],
      errors: {},
      values: {},
      viewname: "testform",
      formStyle: "",
      methodGET: false,
      xhrSubmit: false,
      req: {},
    };
    const want = `<form data-viewname="testform" action="/" class="form-namespace " method="post">
<input type="hidden" name="_csrf" value=""><div class="form-group">
<div><label for="inputname">Name</label></div>
<div><input type="text" class="form-control  " data-fieldname="name" name="name" id="inputname">
</div></div><div class="form-group row">
  <div class="col-sm-2"></div>
  <div class="col-sm-10">
        <button type="submit" class="btn btn-primary">Save</button>
  </div>
</div>
</form>`;
    expect(nolines(renderForm(form, ""))).toBe(nolines(want));
  });
  it("renders a form with layout", () => {
    const form: Form = {
      action: "/",
      fields: [
        {
          name: "name",
          label: "Name",
          input_type: "text",
          form_name: "name",
          required: false,
          attributes: {},
          is_fkey: false,
        },
      ],
      values: {},
      errors: {},
      formStyle: "",
      methodGET: false,
      xhrSubmit: false,
      req: {},
      viewname: "testform",
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
    };
    const want = `<form data-viewname="testform" action="/" class="form-namespace " method="post">
<input type="hidden" name="_csrf" value="">
<h2>
<input type="text" class="form-control  " data-fieldname="name" name="name" id="inputname">
</h2><br /></form>`;
    expect(nolines(renderForm(form, ""))).toBe(nolines(want));
  });
  it("renders a simple form with errors", () => {
    const form: Form = {
      action: "/",
      errors: { name: "Not a foo" },
      values: { name: "Bar" },
      fields: [
        {
          name: "name",
          label: "Name",
          input_type: "text",
          form_name: "name",
          required: false,
          attributes: {},
          is_fkey: false,
        },
      ],
      formStyle: "",
      methodGET: false,
      xhrSubmit: false,
      viewname: "testform",
      req: {},
    };
    const want = `<form data-viewname="testform" action="/" class="form-namespace " method="post">
<input type="hidden" name="_csrf" value=""><div class="form-group">
<div><label for="inputname">Name</label></div>
<div><input type="text" class="form-control is-invalid  " data-fieldname="name" name="name" id="inputname" value="Bar"><div>Not a foo</div>
</div></div><div class="form-group row">
  <div class="col-sm-2"></div>
  <div class="col-sm-10">
        <button type="submit" class="btn btn-primary">Save</button>
  </div>
</div>
</form>`;
    expect(nolines(renderForm(form, ""))).toBe(nolines(want));
  });
});

describe("mkFormContentNoLayout", () => {
  it("renders form fields without layout", () => {
    const form: Form = {
      action: "/submit",
      fields: [
        {
          name: "username",
          label: "Username",
          input_type: "text",
          form_name: "username",
          required: true,
          attributes: {},
          is_fkey: false,
        },
        {
          name: "password",
          label: "Password",
          input_type: "password",
          form_name: "password",
          required: true,
          attributes: {},
          is_fkey: false,
        },
      ],
      errors: {},
      values: {},
      formStyle: "vert",
      methodGET: false,
      xhrSubmit: false,
      req: {},
    };
    const result = mkFormContentNoLayout(form);
    expect(result).toContain('<label for="inputusername">Username</label>');
    expect(result).toContain('<input type="text" class="form-control');
    expect(result).toContain('<label for="inputpassword">Password</label>');
    expect(result).toContain('<input type="password" class="form-control');
  });
});

describe("mkForm", () => {
  // it("renders a complete form with fields and submit button", () => {
  //   const form: Form = {
  //     action: "/submit",
  //     fields: [
  //       {
  //         name: "email",
  //         label: "Email",
  //         input_type: "text",
  //         form_name: "email",
  //         required: true,
  //         attributes: {},
  //         is_fkey: false,
  //       },
  //     ],
  //     errors: {},
  //     values: {},
  //     formStyle: "vert",
  //     methodGET: false,
  //     xhrSubmit: false,
  //     req: {},
  //     submitLabel: "Submit",
  //   };
  //   const csrfToken = "test-csrf-token";
  //   const result = mkForm(form, csrfToken);
  //   expect(result).toContain('<form data-viewname="" action="/submit"');
  //   expect(result).toContain('<input type="hidden" name="_csrf" value="test-csrf-token">');
  //   expect(result).toContain('<label for="inputemail">Email</label>');
  //   expect(result).toContain('<input type="email" class="form-control');
  //   expect(result).toContain('<button type="submit" class="btn btn-primary">Submit</button>');
  // });

  it("renders a complete form with fields and submit button", () => {
    const form: Form = {
      action: "/submit",
      fields: [
        {
          name: "email",
          label: "Email",
          input_type: "text",
          form_name: "email",
          required: true,
          attributes: {},
          is_fkey: false,
        },
      ],
      errors: {},
      values: {},
      formStyle: "vert",
      methodGET: false,
      xhrSubmit: false,
      req: {},
      submitLabel: "Submit",
      viewname: "test-form",
    };
    const csrfToken = "test-csrf-token";
    const result = mkForm(form, csrfToken);

    expect(result).toContain('action="/submit"');
    expect(result).toContain('method="post"');
    expect(result).toContain(
      '<input type="hidden" name="_csrf" value="test-csrf-token">'
    );
    expect(result).toContain('<label for="inputemail">Email</label>');
    expect(result).toContain('type="text"');
    expect(result).toContain('class="form-control');
    expect(result).toContain(
      '<button type="submit" class="btn btn-primary">Submit</button>'
    );
  });

  // it("renders a form with errors", () => {
  //   const form: Form = {
  //     action: "/submit",
  //     fields: [
  //       {
  //         name: "username",
  //         label: "Username",
  //         input_type: "text",
  //         form_name: "username",
  //         required: true,
  //         attributes: {},
  //         is_fkey: false,
  //       },
  //     ],
  //     errors: { username: "Username is required" },
  //     values: {},
  //     formStyle: "vert",
  //     methodGET: false,
  //     xhrSubmit: false,
  //     req: {},
  //   };
  //   const csrfToken = "test-csrf-token";
  //   const result = mkForm(form, csrfToken, form.errors);
  //   expect(result).toContain('<div class="invalid-feedback">Username is required</div>');
  //   expect(result).toContain('<input type="text" class="form-control is-invalid');
  // });

  it("renders a form with errors", () => {
    const form: Form = {
      action: "/submit",
      fields: [
        {
          name: "username",
          label: "Username",
          input_type: "text",
          form_name: "username",
          required: true,
          attributes: {},
          is_fkey: false,
        },
      ],
      errors: { username: "Username is required" },
      values: {},
      formStyle: "vert",
      methodGET: false,
      xhrSubmit: false,
      req: {},
      viewname: "test-form",
    };
    const csrfToken = "test-csrf-token";
    const result = mkForm(form, csrfToken, form.errors);

    expect(result).toContain('class="form-control is-invalid');
    expect(result).toContain("Username is required</div>");
    expect(result).toMatch(
      /<div class="form-group".*?<div>Username is required<\/div>/s
    );
  });
});

describe("renderFormLayout", () => {
  // it("renders a form layout with fields", () => {
  //   const form: Form = {
  //     action: "/submit",
  //     fields: [
  //       {
  //         name: "first_name",
  //         label: "First Name",
  //         input_type: "text",
  //         form_name: "first_name",
  //         required: true,
  //         attributes: {},
  //         is_fkey: false,
  //       },
  //       {
  //         name: "last_name",
  //         label: "Last Name",
  //         input_type: "text",
  //         form_name: "last_name",
  //         required: true,
  //         attributes: {},
  //         is_fkey: false,
  //       },
  //     ],
  //     layout: {
  //       above: [
  //         { type: "field", field_name: "first_name" },
  //         { type: "field", field_name: "last_name" },
  //       ],
  //     },
  //     errors: {},
  //     values: {},
  //     formStyle: "vert",
  //     methodGET: false,
  //     xhrSubmit: false,
  //     req: {},
  //   };
  //   const result = renderFormLayout(form);
  //   expect(result).toContain('<label for="inputfirst_name">First Name</label>');
  //   expect(result).toContain('<input type="text" class="form-control');
  //   expect(result).toContain('<label for="inputlast_name">Last Name</label>');
  //   expect(result).toContain('<input type="text" class="form-control');
  // });
  // it("renders a form layout with fields", () => {
  //   const form: Form = {
  //     action: "/submit",
  //     fields: [
  //       {
  //         name: "first_name",
  //         label: "First Name",
  //         input_type: "text",
  //         form_name: "first_name",
  //         required: true,
  //         attributes: {},
  //         is_fkey: false,
  //       },
  //       {
  //         name: "last_name",
  //         label: "Last Name",
  //         input_type: "text",
  //         form_name: "last_name",
  //         required: true,
  //         attributes: {},
  //         is_fkey: false,
  //       },
  //     ],
  //     layout: {
  //       above: [
  //         { type: "field", field_name: "first_name" },
  //         { type: "field", field_name: "last_name" },
  //       ],
  //     },
  //     errors: {},
  //     values: {},
  //     formStyle: "vert",
  //     methodGET: false,
  //     xhrSubmit: false,
  //     req: {},
  //   };
  //   const result = renderFormLayout(form);
  //   // Check inputs are rendered with correct attributes
  //   expect(result).toContain('<input type="text" class="form-control " data-fieldname="first_name" name="first_name" id="inputfirst_name">');
  //   expect(result).toContain('<input type="text" class="form-control " data-fieldname="last_name" name="last_name" id="inputlast_name">');
  //   // If labels should be included but aren't, this would fail:
  //   // expect(result).toContain('<label for="inputfirst_name">First Name</label>');
  // });
  // it("renders a form layout with hidden fields", () => {
  //   const form: Form = {
  //     action: "/submit",
  //     fields: [
  //       {
  //         name: "hidden_field",
  //         label: "Hidden Field",
  //         input_type: "hidden",
  //         form_name: "hidden_field",
  //         required: false,
  //         attributes: {},
  //         is_fkey: false,
  //       },
  //     ],
  //     layout: {
  //       above: [{ type: "field", field_name: "hidden_field" }],
  //     },
  //     errors: {},
  //     values: { hidden_field: "hidden_value" },
  //     formStyle: "vert",
  //     methodGET: false,
  //     xhrSubmit: false,
  //     req: {},
  //   };
  //   const result = renderFormLayout(form);
  //   expect(result).toContain('<input type="hidden" name="hidden_field" value="hidden_value">');
  // });
});
