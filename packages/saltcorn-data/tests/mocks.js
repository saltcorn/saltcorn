const File = require("../models/file");
const fs = require("fs").promises;
const Workflow = require("../models/workflow");

const rick_file = async () => {
  await File.ensure_file_store();

  const mv = async fnm => {
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
    steps: []
  });

const plugin_with_routes = {
  sc_plugin_api_version: 1,
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
        }
      }
    }
  ]
};
const mockReqRes = {
  req: { csrfToken: () => "" },
  res: { redirect() {}, json() {}, send() {} }
};

module.exports = {
  rick_file,
  plugin_with_routes,
  configuration_workflow,
  mockReqRes
};
