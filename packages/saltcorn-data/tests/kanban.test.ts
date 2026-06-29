import Table from "../models/table.js";
import Field from "../models/field.js";
import View from "../models/view.js";
import db from "../db/index.js";
import * as mocks from "./mocks.js";
import { getState } from "../db/state.js";
import basePluginMod from "../base-plugin/index.js";
import resetSchemaMod from "../db/reset_schema.js";
import type { FieldLike } from "@saltcorn/types/base_types";
const { mockReqRes } = mocks;
import {
  afterAll,
  beforeAll,
  describe,
  it,
  expect,
} from "@saltcorn/db-common/test_expect";

getState()!.registerPlugin("base", basePluginMod);

afterAll(db.close);

// Self-contained: create a fresh schema and a minimal Tasks table,
// avoiding the upstream fixture chain that breaks on ESM migration.
beforeAll(async () => {
  await resetSchemaMod();
  // create Tasks table
  const tasks = await Table.create("tasks");
  await Field.create({ table: tasks, name: "title", label: "Title", type: "String", required: true });
  await Field.create({ table: tasks, name: "status", label: "Status", type: "String", required: false });
  await db.insert("tasks", { title: "Write docs", status: "To Do" });
  await db.insert("tasks", { title: "Fix bug", status: "To Do" });
  await db.insert("tasks", { title: "Code review", status: "In Progress" });
  await db.insert("tasks", { title: "Deploy", status: "Done" });
});

// ─── helper ───────────────────────────────────────────────────────────────────

const mkKanbanView = async (cfg: Record<string, any> = {}): Promise<View> =>
  View.create({
    viewtemplate: "Kanban",
    description: "",
    min_role: 1,
    name: `kanban_${Math.round(Math.random() * 1e6)}`,
    table_id: Table.findOne("tasks")!.id,
    default_render_page: "",
    slug: { label: "", steps: [] },
    attributes: {},
    configuration: {
      group_field: "status",
      column_order: "To Do,In Progress,Done",
      card_title_field: "title",
      show_view: "",
      view_to_create: "",
      min_role: "80",
      ...cfg,
    },
  });

// ─── get_state_fields ─────────────────────────────────────────────────────────

describe("Kanban get_state_fields", () => {
  it("returns non-PK fields as optional state filters", async () => {
    const view = await mkKanbanView();
    const stateFields = await view.get_state_fields();
    expect(Array.isArray(stateFields)).toBe(true);
    const names = stateFields.map((f: FieldLike) => f.name);
    // primary key must be excluded
    expect(names).not.toContain("id");
    // data fields must be present
    expect(names).toContain("title");
    expect(names).toContain("status");
    // all state fields must be non-required
    stateFields.forEach((f: FieldLike) => expect(f.required).toBe(false));
    await view.delete();
  });
});

// ─── run ──────────────────────────────────────────────────────────────────────

describe("Kanban run", () => {
  it("renders the board wrapper and all configured columns", async () => {
    const view = await mkKanbanView();
    const { req, res } = mockReqRes;
    const html = await view.run({}, { req, res });
    expect(html).toContain("sc-kanban-board");
    expect(html).toContain("To Do");
    expect(html).toContain("In Progress");
    expect(html).toContain("Done");
    await view.delete();
  });

  it("renders card titles using the configured card_title_field", async () => {
    const view = await mkKanbanView();
    const { req, res } = mockReqRes;
    const html = await view.run({}, { req, res });
    expect(html).toContain("Write docs");
    expect(html).toContain("Fix bug");
    expect(html).toContain("Code review");
    expect(html).toContain("Deploy");
    await view.delete();
  });

  it("renders columns in the configured order", async () => {
    const view = await mkKanbanView({
      column_order: "Done,In Progress,To Do",
    });
    const { req, res } = mockReqRes;
    const html = await view.run({}, { req, res });
    const donePos = html.indexOf(">Done<");
    const inProgressPos = html.indexOf(">In Progress<");
    const todoPos = html.indexOf(">To Do<");
    expect(donePos).toBeGreaterThan(-1);
    expect(inProgressPos).toBeGreaterThan(donePos);
    expect(todoPos).toBeGreaterThan(inProgressPos);
    await view.delete();
  });

  it("renders per-column card count badges", async () => {
    const view = await mkKanbanView();
    const { req, res } = mockReqRes;
    const html = await view.run({}, { req, res });
    expect(html).toContain("sc-kanban-count");
    // To Do has 2 cards; badge should contain "2"
    expect(html).toContain(">2<");
    await view.delete();
  });

  it("injects SortableJS drag script when user meets min_role", async () => {
    // min_role "1" = admin only; mockReqRes.req has role_id 1
    const view = await mkKanbanView({ min_role: "1" });
    const { req, res } = mockReqRes;
    const html = await view.run({}, { req, res });
    expect(html).toContain("Sortable");
    expect(html).toContain("move_card");
    await view.delete();
  });

  it("omits drag script when user role exceeds min_role", async () => {
    // min_role "1" = admin; public user has role_id 100
    const view = await mkKanbanView({ min_role: "1" });
    const publicReq = {
      ...mockReqRes.req,
      user: undefined,
      isAuthenticated: () => false,
    };
    const html = await view.run({}, { req: publicReq, res: mockReqRes.res });
    expect(html).not.toContain("Sortable");
    await view.delete();
  });

  it("shows a warning when group_field is not configured", async () => {
    const view = await mkKanbanView({ group_field: "" });
    const { req, res } = mockReqRes;
    const html = await view.run({}, { req, res });
    expect(html).toContain("alert");
    await view.delete();
  });

  it("derives columns dynamically when column_order is empty", async () => {
    const view = await mkKanbanView({ column_order: "" });
    const { req, res } = mockReqRes;
    const html = await view.run({}, { req, res });
    // all distinct status values in the data should appear as columns
    expect(html).toContain("To Do");
    expect(html).toContain("In Progress");
    expect(html).toContain("Done");
    await view.delete();
  });
});

// ─── move_card route ──────────────────────────────────────────────────────────

describe("Kanban move_card route", () => {
  it("updates the group-by field when user has permission", async () => {
    const table = Table.findOne("tasks")!;
    const [row] = await table.getRows({ title: "Write docs" });

    const view = await mkKanbanView({ min_role: "80" }); // User and above

    mockReqRes.reset();
    await view.runRoute(
      "move_card",
      { id: String(row.id), column: "Done" },
      mockReqRes.res,
      { req: mockReqRes.req, res: mockReqRes.res }
    );
    expect(mockReqRes.getStored().json).toEqual({ success: true });

    const updated = await table.getRow({ id: row.id });
    expect(updated!.status).toBe("Done");

    // restore
    await table.updateRow({ status: "To Do" }, row.id);
    await view.delete();
  });

  it("rejects move when user role is insufficient", async () => {
    const table = Table.findOne("tasks")!;
    const [row] = await table.getRows({ title: "Fix bug" });

    const view = await mkKanbanView({ min_role: "1" }); // admin only

    const publicReq = {
      ...mockReqRes.req,
      user: { id: 99, role_id: 100, attributes: {} },
    };

    mockReqRes.reset();
    await view.runRoute(
      "move_card",
      { id: String(row.id), column: "Done" },
      mockReqRes.res,
      { req: publicReq, res: mockReqRes.res }
    );
    expect(mockReqRes.getStored().json).toEqual({ error: "Not authorized" });

    // row must be unchanged
    const unchanged = await table.getRow({ id: row.id });
    expect(unchanged!.status).toBe("To Do");

    await view.delete();
  });

  it("returns an error when id is missing", async () => {
    const view = await mkKanbanView();

    mockReqRes.reset();
    await view.runRoute(
      "move_card",
      { column: "Done" },
      mockReqRes.res,
      { req: mockReqRes.req, res: mockReqRes.res }
    );
    expect(typeof mockReqRes.getStored().json?.error).toBe("string");

    await view.delete();
  });

  it("returns an error when column is missing", async () => {
    const view = await mkKanbanView();

    mockReqRes.reset();
    await view.runRoute(
      "move_card",
      { id: "1" },
      mockReqRes.res,
      { req: mockReqRes.req, res: mockReqRes.res }
    );
    expect(typeof mockReqRes.getStored().json?.error).toBe("string");

    await view.delete();
  });
});
