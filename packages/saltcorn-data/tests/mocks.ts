import Field from "../models/field";
import File from "../models/file";
import Form from "../models/form";
import { writeFile } from "fs/promises";
import Workflow from "../models/workflow";
import db from "../db";
import tags from "@saltcorn/markup/tags";
const { input } = tags;
const { json_list_to_external_table } = require("../plugin-helper");
const { sleep } = require("../utils");
const rick_file = async () => {
  await File.ensure_file_store();

  const mv = async (fnm: string) => {
    await writeFile(fnm, "nevergonnagiveyouup");
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
        form: (context: any) =>
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
        form: (context: any) =>
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
  onLoad: async () => {
    if (!db.isSQLite)
      await db.query('create extension if not exists "uuid-ossp";');
  },
  external_tables: {
    exttab: json_list_to_external_table(
      () => [{ name: "Sam", age: 56 }],
      [
        { name: "name", type: "String" },
        { name: "age", type: "Integer" },
      ]
    ),
  },
  types: [
    {
      name: "UUID",
      sql_name: "uuid",
      primaryKey: { default_sql: "uuid_generate_v4()" },
      fieldviews: {
        show: { isEdit: false, run: (v: any) => v || "" },
        editHTML: {
          isEdit: true,
          run: (
            nm: string,
            v: any,
            attrs: any,
            cls: string,
            required: boolean,
            field: Field
          ) =>
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
      read: (v: any) => {
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
      run: ({
        configuration: { number },
      }: {
        configuration: { number: number };
      }) => {
        actionCounter = number;
      },
    },
  },
  functions: {
    add3: { run: (x: number) => x + 3 },
    add5: (x: number) => x + 5,
    asyncAdd2: {
      run: async (x: number) => {
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
    __: (s: any) => s,
    user: { id: 1, role_id: 1 },
    isAuthenticated: () => true,
  },
  res: { redirect() {}, json() {}, send() {}, __: (s: any) => s },
};

export = {
  rick_file,
  plugin_with_routes,
  configuration_workflow,
  mockReqRes,
  getActionCounter,
  resetActionCounter,
  sleep,
};
