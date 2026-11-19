import { describe, it, expect } from "@saltcorn/db-common/test_expect";
import { diff_packs } from "../models/pack_diff.js";

const basePack = (): any => ({
  tables: [
    {
      name: "products",
      min_role_read: 100,
      min_role_write: 1,
      fields: [
        { name: "id", type: "Integer", primary_key: true, required: true },
        { name: "name", type: "String", required: true },
        { name: "price", type: "Float", required: false },
      ],
      constraints: [{ type: "Unique", configuration: { fields: ["name"] } }],
    },
  ],
  views: [
    {
      name: "ProductList",
      viewtemplate: "List",
      table: "products",
      min_role: 100,
      configuration: { columns: [{ type: "Field", field_name: "name" }] },
    },
    {
      name: "ProductEdit",
      viewtemplate: "Edit",
      table: "products",
      min_role: 1,
      configuration: {},
    },
  ],
  pages: [],
  page_groups: [],
  plugins: [
    { name: "base", source: "npm", version: "1.0.0", configuration: {} },
  ],
  roles: [
    { id: 1, role: "admin" },
    { id: 80, role: "staff" },
    { id: 100, role: "public" },
  ],
  library: [],
  triggers: [
    {
      name: "notify",
      action: "Workflow",
      when_trigger: "Insert",
      table_name: "products",
      configuration: {},
      steps: [
        { name: "step1", action_name: "toast", configuration: { a: 1 } },
        { name: "step2", action_name: "toast", configuration: { a: 2 } },
      ],
    },
  ],
  tags: [],
  models: [],
  model_instances: [],
  config: { site_name: "Dev", smtp_password: "secret1" },
});

describe("diff_packs", () => {
  it("returns no changes for identical packs", () => {
    const d = diff_packs(basePack(), basePack());
    expect(d.sections).toEqual({});
    expect(d.summary).toEqual({ added: 0, removed: 0, changed: 0 });
  });

  it("detects added, removed and changed views", () => {
    const a = basePack();
    const b = basePack();
    b.views = b.views.filter((v: any) => v.name !== "ProductEdit");
    b.views.push({ name: "ProductShow", viewtemplate: "Show" });
    b.views[0].min_role = 80;
    const d = diff_packs(a, b);
    expect(d.sections.views.added).toEqual(["ProductShow"]);
    expect(d.sections.views.removed).toEqual(["ProductEdit"]);
    expect(d.sections.views.changed).toEqual([
      {
        name: "ProductList",
        changes: [{ path: "min_role", kind: "changed", old: 100, new: 80 }],
      },
    ]);
    expect(d.summary).toEqual({ added: 1, removed: 1, changed: 1 });
  });

  it("matches nested changes by name", () => {
    const a = basePack();
    const b = basePack();
    b.views[0].configuration.columns[0].field_name = "price";
    b.tables[0].fields.push({ name: "sku", type: "String" });
    b.tables[0].fields[2].required = true;
    const d = diff_packs(a, b);
    expect(d.sections.views.changed[0].changes).toEqual([
      {
        path: "configuration.columns[0].field_name",
        kind: "changed",
        old: "name",
        new: "price",
      },
    ]);
    expect(d.sections.tables.changed[0].changes).toEqual([
      { path: "fields.price.required", kind: "changed", old: false, new: true },
      {
        path: "fields.sku",
        kind: "added",
        new: { name: "sku", type: "String" },
      },
    ]);
  });

  it("ignores reordering of items, fields, steps and constraints", () => {
    const a = basePack();
    const b = basePack();
    b.views.reverse();
    b.tables[0].fields.reverse();
    b.triggers[0].steps.reverse();
    b.roles.reverse();
    b.tables[0].constraints.push({
      type: "Unique",
      configuration: { fields: ["price"] },
    });
    a.tables[0].constraints.unshift({
      type: "Unique",
      configuration: { fields: ["price"] },
    });
    expect(diff_packs(a, b).sections).toEqual({});
  });

  it("reports a role rename as a single change", () => {
    const a = basePack();
    const b = basePack();
    b.roles[1].role = "employee";
    const d = diff_packs(a, b);
    expect(d.sections.roles).toEqual({
      added: [],
      removed: [],
      changed: [
        {
          name: "employee",
          changes: [
            { path: "role", kind: "changed", old: "staff", new: "employee" },
          ],
        },
      ],
    });
  });

  it("diffs config by key", () => {
    const a = basePack();
    const b = basePack();
    b.config.site_name = "Prod";
    b.config.base_url = "https://example.com";
    const d = diff_packs(a, b);
    expect(d.sections.config).toEqual({
      added: ["base_url"],
      removed: [],
      changed: [
        {
          name: "site_name",
          changes: [{ path: "", kind: "changed", old: "Dev", new: "Prod" }],
        },
      ],
    });
  });

  it("does not reveal secret values", () => {
    const a = basePack();
    const b = basePack();
    b.config.smtp_password = "secret2";
    a.plugins[0].deploy_private_key = "key1";
    b.plugins[0].deploy_private_key = "key2";
    const d = diff_packs(a, b);
    expect(d.sections.config.changed).toEqual([
      { name: "smtp_password", changes: [{ path: "", kind: "changed" }] },
    ]);
    expect(d.sections.plugins.changed).toEqual([
      {
        name: "base",
        changes: [{ path: "deploy_private_key", kind: "changed" }],
      },
    ]);
    expect(JSON.stringify(d)).not.toContain("secret");
    expect(JSON.stringify(d)).not.toContain("key1");
  });

  it("treats null, missing and empty as equal", () => {
    const a = basePack();
    const b = basePack();
    a.views[1].description = null;
    a.views[1].configuration = {};
    delete b.views[1].configuration;
    b.tables[0].description = undefined;
    a.pages = undefined;
    a.tables[0].fields[0].attributes = { summary_field: null };
    // a newly introduced flag defaulting to false, and empty strings
    b.tables[0].system_rows = false;
    b.views[0].description = "";
    a.config.some_new_flag = false;
    expect(diff_packs(a, b).sections).toEqual({});
  });

  it("still reports real boolean flips", () => {
    const a = basePack();
    const b = basePack();
    b.tables[0].fields[0].required = false;
    b.tables[0].versioned = true;
    a.config.maintenance = false;
    b.config.maintenance = true;
    const d = diff_packs(a, b);
    expect(d.sections.tables.changed[0].changes).toEqual([
      { path: "fields.id.required", kind: "changed", old: true, new: false },
      { path: "versioned", kind: "added", new: true },
    ]);
    expect(d.sections.config.changed).toEqual([
      {
        name: "maintenance",
        changes: [{ path: "", kind: "changed", old: false, new: true }],
      },
    ]);
  });

  it("accepts JSON strings and skips event logs", () => {
    const a = basePack();
    const b = basePack();
    b.views[0].min_role = 1;
    b.event_logs = [{ id: 1, event_type: "Insert" }];
    expect(diff_packs(JSON.stringify(a), JSON.stringify(b))).toEqual(
      diff_packs(a, b)
    );
    expect(diff_packs(a, b).sections.event_logs).toBeUndefined();
  });

  it("orders sections and matches table rows by id", () => {
    const a = basePack();
    const b = basePack();
    b.config.site_name = "Prod";
    a.tables[0].rows = [
      { id: 1, name: "Open" },
      { id: 2, name: "Closed" },
    ];
    b.tables[0].rows = [
      { id: 2, name: "Closed" },
      { id: 1, name: "Opened" },
    ];
    const d = diff_packs(a, b);
    expect(Object.keys(d.sections)).toEqual(["tables", "config"]);
    expect(d.sections.tables.changed[0].changes).toEqual([
      { path: "rows.1.name", kind: "changed", old: "Open", new: "Opened" },
    ]);
  });
});
