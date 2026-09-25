import Table from "../models/table.js";
import View from "../models/view.js";
import db from "../db/index.js";
import * as mocks from "./mocks.js";
import { getState } from "../db/state.js";
import basePluginMod from "../base-plugin/index.js";
import resetSchemaMod from "../db/reset_schema.js";
import fixturesMod from "../db/fixtures.js";
import {
  afterAll,
  beforeAll,
  describe,
  it,
  expect,
} from "@saltcorn/db-common/test_expect";
import { assertIsSet } from "./assertions.js";
import { GenObj } from "@saltcorn/types/common_types";
const { mockReqRes } = mocks;

getState()!.registerPlugin("base", basePluginMod);

afterAll(db.close);
beforeAll(async () => {
  await resetSchemaMod();
  await fixturesMod();
});

const runRoom = async (viewname: string, state: GenObj) => {
  const view = View.findOne({ name: viewname });
  assertIsSet(view);
  return await view.run(state, mockReqRes);
};

describe("Room view picked by fields other than id", () => {
  beforeAll(async () => {
    const rooms = Table.findOne("rooms");
    assertIsSet(rooms);
    const participants = Table.findOne("participants")!;
    // fixture: user 1 takes part in room 1 ("Room A") only
    await participants.insertRow({ user: 1, room: 2 });
    const room3 = await rooms.insertRow({ name: "Room A" });
    await participants.insertRow({ user: 1, room: room3 });

    const cfg = View.findOne({ name: "rooms_view" })!.configuration;
    const mkRoomView = async (name: string, extra: GenObj) =>
      await View.create({
        table_id: rooms.id,
        name,
        viewtemplate: "Room",
        configuration: { ...cfg, ...extra },
        min_role: 80,
      });
    await mkRoomView("rooms_view_desc", { row_order_desc: true });
    await mkRoomView("rooms_view_error", { multiple_rows: "Error" });
    await mkRoomView("rooms_view_more", {
      multiple_rows: "First with link to more",
      more_rows_view: "list_rooms",
    });
  });
  it("still runs by id", async () => {
    const vres = await runRoom("rooms_view", { id: 1 });
    expect(vres).toContain('init_room("rooms_view", 1)');
  });
  it("needs a filter", async () => {
    expect(await runRoom("rooms_view", {})).toBe("Need room id");
  });
  it("picks the room by another field", async () => {
    const vres = await runRoom("rooms_view", { name: "Room B" });
    expect(vres).toContain('init_room("rooms_view", 2)');
  });
  it("says when nothing matches", async () => {
    const vres = await runRoom("rooms_view", { name: "Nowhere" });
    expect(vres).toBe("No row selected");
  });
  it("takes the first match by primary key", async () => {
    const vres = await runRoom("rooms_view", { name: "Room A" });
    expect(vres).toContain('init_room("rooms_view", 1)');
    expect(vres).toContain("first message content for room A");
    expect(vres).not.toContain("sc-room-more");
  });
  it("takes the first match descending", async () => {
    const vres = await runRoom("rooms_view_desc", { name: "Room A" });
    expect(vres).toContain('init_room("rooms_view_desc", 3)');
    expect(vres).not.toContain("first message content for room A");
  });
  it("errors on several matches if configured", async () => {
    const vres = await runRoom("rooms_view_error", { name: "Room A" });
    expect(vres).toBe("More than one room matches");
    const vres1 = await runRoom("rooms_view_error", { name: "Room B" });
    expect(vres1).toContain('init_room("rooms_view_error", 2)');
  });
  it("links to more matches if configured", async () => {
    const vres = await runRoom("rooms_view_more", { name: "Room A" });
    expect(vres).toContain('init_room("rooms_view_more", 1)');
    expect(vres).toContain('href="/view/list_rooms?name=Room%20A"');
    const vres1 = await runRoom("rooms_view_more", { name: "Room B" });
    expect(vres1).not.toContain("sc-room-more");
  });
});
