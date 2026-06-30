import Field from "../models/field.js";
import File from "../models/file.js";
import View from "../models/view.js";
import Table from "../models/table.js";
import Form from "../models/form.js";
import { writeFile } from "fs/promises";
import Workflow from "../models/workflow.js";
import db from "../db/index.js";
import tags from "@saltcorn/markup/tags";
import { ViewCfg } from "@saltcorn/types/model-abstracts/abstract_view";
import * as exprMod from "../models/expression.js";
import { ReqRes } from "@saltcorn/types/common_types";
import type { Plugin, Req, Res } from "@saltcorn/types/base_types";
const { eval_expression } = exprMod;
import { getState } from "../db/state.js";
const { input } = tags;
import { json_list_to_external_table } from "../plugin-helper.js";
import { sleep } from "../utils.js";
const rick_file = async () => {
  await File.ensure_file_store();

  const mv = async (fnm: string) => {
    await writeFile(fnm, "nevergonnagiveyouup");
  };
  return await File.from_req_files(
    { mimetype: "image/png", name: "rick.png", mv, size: 245752 },
    1,
    100
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
const plugin_with_routes = (): Plugin =>
  ({
    sc_plugin_api_version: 1,
    onLoad: async () => {
      if (!db.isSQLite)
        await db.query('create extension if not exists "uuid-ossp";');
    },
    external_tables: {
      exttab: json_list_to_external_table(
        () => [
          { name: "Sam", age: 56 },
          { name: "Alex", age: 49 },
          { name: "Homer", age: 51 },
        ],
        [
          { name: "name", label: "Name", type: "String" },
          { name: "age", label: "Age", type: "Integer" },
        ]
      ),
    },
    table_providers: {
      provtab: {
        configuration_workflow: () =>
          new Workflow({
            steps: [
              {
                name: "step1",
                form: (context: any) =>
                  new Form({
                    fields: [
                      {
                        name: "middle_name",
                        label: "Middle name",
                        type: "String",
                        required: true,
                      },
                    ],
                  }),
              },
            ],
          }),
        fields: async (cfg: any) => [
          { name: "name", label: "Name", type: "String", primary_key: true },
          { name: "age", label: "Age", type: "Integer" },
        ],
        get_table(cfg: any) {
          return {
            getRows: async () => [{ name: cfg.middle_name, age: 36 }],
          };
        },
      },
      provtab_state: {
        configuration_workflow: () =>
          new Workflow({
            steps: [
              {
                name: "step1",
                form: (_context: any) =>
                  new Form({
                    fields: [{ name: "label", label: "Label", type: "String" }],
                  }),
              },
            ],
          }),
        fields: async (_cfg: any) => [
          { name: "key", label: "Key", type: "String", primary_key: true },
          { name: "val", label: "Val", type: "String" },
        ],
        get_table(_cfg: any) {
          return {
            getRows: async (_where: any, selopts: any) => [
              { key: "state_key", val: JSON.stringify(selopts?.state || null) },
            ],
          };
        },
      },
    },
    types: [
      {
        name: "JSON",
        sql_name: "jsonb",
        fieldviews: {
          show: {
            isEdit: false,
            run: (v: any) =>
              tags.pre({ class: "wsprewrap" }, tags.code(JSON.stringify(v))),
          },
          edit: {
            isEdit: true,
            run: (nm: string, v: any, attrs: any, cls: string) =>
              tags.textarea(
                {
                  class: ["form-control", cls],
                  name: encodeURIComponent(nm),
                  id: `input${encodeURIComponent(nm)}`,
                  rows: 10,
                },
                typeof v === "undefined"
                  ? ""
                  : tags.text(JSON.stringify(v)) || ""
              ),
          },
        },
        attributes: [],
        read: (v: any) => {
          switch (typeof v) {
            case "string":
              try {
                return JSON.parse(v);
              } catch {
                return v;
              }
            default:
              return v;
          }
        },
      },
      {
        name: "Varchar",
        sql_name: ({ dimensions }: any) => {
          if (typeof dimensions !== "number")
            throw new Error("dim must be num");
          return `varchar(${dimensions})`;
        },
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
        attributes: [
          {
            label: "Dimensions",
            name: "dimensions",
            type: "Integer",
            required: true,
            attributes: {
              max: 1024,
              min: 0,
            },
          },
        ],
        validate_attributes: ({ dimensions }: any) =>
          dimensions > 0 && dimensions < 1024,
        read: (s: any) => s,
      },
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
              return v || null;
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
      evalCounter: {
        configFields: [{ name: "number_expr", type: "String" }],
        run: ({
          configuration: { number_expr },
          row,
          user,
        }: {
          configuration: { number_expr: string };
          row: any;
          user: any;
        }) => {
          actionCounter = eval_expression(number_expr, row, user);
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
        tableless: true,
        get_state_fields() {
          return [];
        },
        configuration_workflow,
        run: async () => {},
      },
    ],
  }) as unknown as Plugin;

let mockResReqStored: any = {};

const mockReqRes = {
  req: {
    csrfToken: () => "",
    getLocale: () => getState()!.getConfig("default_locale", "en"),
    __: (s: any) => s,
    user: { id: 1, role_id: 1, attributes: {} },
    isAuthenticated: () => true,
    headers: {},
    query: {},
    xhr: false,
    flash: (...fs: any) => {
      mockResReqStored.flash = fs;
    },
    body: "",
    get: (s: string) => "",
  },
  res: {
    redirect(url: string) {
      mockResReqStored.url = url;
    },
    json(o: any) {
      mockResReqStored.json = o;
    },
    send(s: any) {
      mockResReqStored.send = s;
    },
    status(st: any) {
      mockResReqStored.status = st;
      return mockReqRes.res;
    },
    sendWrap: (...sw: any[]) => {
      mockResReqStored.sendWrap = sw;
    },
    __: (s: any) => s,
  },
  getStored: () => mockResReqStored,
  reset: () => {
    mockResReqStored = {};
    mockReqRes.req.xhr = false;
  },
};

const createDefaultView = async (
  table: Table,
  viewtemplate: string,
  min_role: number
): Promise<View> => {
  const vt = getState()!.viewtemplates[viewtemplate];
  const v: ViewCfg = {
    name: `${viewtemplate}${table.name}${Math.round(Math.random() * 10000)}`,
    min_role,
    configuration: await vt.initial_config!(
      (table.id ? { table_id: table.id } : { exttable_name: table.name }) as any
    ),
    viewtemplate,
  };
  if (table.id) v.table_id = table.id;
  else v.exttable_name = table.name;
  return await View.create(v);
};

export {
  rick_file,
  plugin_with_routes,
  configuration_workflow,
  mockReqRes,
  getActionCounter,
  resetActionCounter,
  sleep,
  createDefaultView,
};
