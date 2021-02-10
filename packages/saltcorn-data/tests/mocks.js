const File = require("../models/file");
const fs = require("fs").promises;
const Workflow = require("../models/workflow");
const { input } = require("@saltcorn/markup/tags");

const rick_file = async () => {
  await File.ensure_file_store();

  const mv = async (fnm) => {
    await fs.writeFile(fnm, "nevergonnagiveyouup");
  };
  return await File.from_req_files(
    { mimetype: "image/png", name: "rick.png", mv, size: 245752 },
    1,
    10
  );
};
const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "step1",
        form: (context) =>
          new Form({
            fields: [
              {
                name: "first_name",
                label: "First name",
                type: "String",
                required: true,
              },
            ],
          }),
      },
      {
        name: "step2",
        form: (context) =>
          new Form({
            fields: [
              {
                name: "last_name",
                label: "Last name",
                type: "String",
                required: true,
              },
            ],
          }),
      },
    ],
  });
let actionCounter = 1;
const getActionCounter = () => actionCounter;
const resetActionCounter = () => {
  actionCounter = 0;
};
const plugin_with_routes = {
  sc_plugin_api_version: 1,
  types: [
    {
      name: "UUID",
      sql_name: "uuid",
      primaryKey: { default_sql: "uuid_generate_v4()" },
      fieldviews: {
        show: { isEdit: false, run: (v) => v || "" },
        editHTML: {
          isEdit: true,
          run: (nm, v, attrs, cls, required, field) =>
            input({
              type: "text",
              disabled: attrs.disabled,
              class: ["form-control", cls],
              "data-fieldname": field.name,
              name: nm,
              id: `input${nm}`,
              value: v || "",
            }),
        },
      },
      read: (v) => {
        switch (typeof v) {
          case "string":
            return v;
          default:
            return undefined;
        }
      },
    },
  ],
  actions: {
    incrementCounter: {
      run: () => {
        actionCounter += 1;
      },
    },
    setCounter: {
      configFields: [{ name: "number", type: "Int" }],
      run: ({ configuration: { number } }) => {
        actionCounter = number;
      },
    },
  },
  functions: {
    add3: { run: (x) => x + 3 },
    add5: (x) => x + 5,
    asyncAdd2: {
      run: async (x) => {
        return x + 2;
      },
      isAsync: true,
    },
  },
  viewtemplates: [
    {
      name: "ViewWithRoutes",
      display_state_form: false,
      get_state_fields() {
        return [];
      },
      configuration_workflow,
      run: async () => {},
      routes: {
        the_json_route: async () => {
          return { json: { success: "ok" } };
        },
        the_html_route: async () => {
          return { html: "<div>Hello</div>" };
        },
        the_null_route: () => null,
      },
    },
    {
      name: "TablelessView",
      display_state_form: false,
      tableless: true,
      get_state_fields() {
        return [];
      },
      configuration_workflow,
      run: async () => {},
    },
  ],
};
const mockReqRes = {
  req: {
    csrfToken: () => "",
    getLocale: () => "en",
    __: (s) => s,
    user: { id: 1, role_id: 1 },
  },
  res: { redirect() {}, json() {}, send() {}, __: (s) => s },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
module.exports = {
  rick_file,
  plugin_with_routes,
  configuration_workflow,
  mockReqRes,
  getActionCounter,
  resetActionCounter,
  sleep,
};
