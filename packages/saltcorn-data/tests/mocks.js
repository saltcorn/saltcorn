const File = require("../models/file");
const fs = require("fs").promises;
const Workflow = require("../models/workflow");

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

const plugin_with_routes = {
  sc_plugin_api_version: 1,
  actions: {
    increment: {
      configFields: [
        {
          name: "field",
          label: "Field",
          type: "Field",
          attributes: { type: ["Int", "Float"] },
        },
      ],
      run: ({ table, configuration: { field }, row, user }) =>
        table.updateRow(
          { [field.name]: row[field.name] + 1 },
          row.id,
          user ? user.id : null
        ),
    },

    // row
    // field
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
  ],
};
const mockReqRes = {
  req: { csrfToken: () => "", getLocale: () => "en", __: (s) => s },
  res: { redirect() {}, json() {}, send() {}, __: (s) => s },
};

module.exports = {
  rick_file,
  plugin_with_routes,
  configuration_workflow,
  mockReqRes,
};
