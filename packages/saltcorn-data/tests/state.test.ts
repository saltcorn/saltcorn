import { createRequire } from "module";
const require = createRequire(import.meta.url);
const _sc_db_state = () => (require("../db/state.js") as any).default;
const _sc_base_plugin = () => (require("../base-plugin/index.js") as any).default;
const _sc_db_reset_schema = () => (require("../db/reset_schema.js") as any).default;
const _sc_db_fixtures = () => (require("../db/fixtures.js") as any).default;
import db from "../db/index.js";
const state = _sc_db_state();
import User from "../models/user.js";

const { getState } = state;
import { afterAll, beforeAll, describe, it, expect } from "@saltcorn/db-common/test_expect";

getState().registerPlugin("base", _sc_base_plugin());
beforeAll(async () => {
  await _sc_db_reset_schema()();
  await _sc_db_fixtures()();
});

afterAll(db.close);

describe("State constants", () => {
  it("should have fonts", async () => {
    expect(getState().fonts.Arial).toBe(
      "Arial, Helvetica Neue, Helvetica, sans-serif"
    );
    Object.values(getState().fonts).forEach((v) => {
      expect(typeof v).toBe("string");
      expect(!!v).toBe(true);
    });
  });
  it("should have fonts", async () => {
    expect(state.features.fieldrepeats_in_field_attributes).toBe(true);
    Object.values(state.features).forEach((v) => {
      expect(["number", "boolean"]).toContain(typeof v);
      expect(!!v).toBe(true);
    });
  });
  it("should have process_init_time", async () => {
    expect(state.get_process_init_time() instanceof Date).toBe(true);
  });
});

describe("State queries", () => {
  it("should query layout and 2fa policy", async () => {
    const user = await User.findOne({ role_id: 1 });
    const layout = getState().getLayout(user);
    expect(typeof layout.wrap).toBe("function");
    const twofapol = getState().get2FApolicy(user);
    expect(twofapol).toBe("Optional");
  });
  it("should query i18n strings", async () => {
    const strs = getState().getStringsForI18n();
    expect(strs).toContain("Page Group link");
    expect(strs).toContain("Hello world");
    expect(strs).toContain("<h1> foo</h1>");
    expect(strs).toContain("Click here");
    expect(strs).toContain("header");
    expect(strs).toContain("Bye bye");
    expect(strs).toContain("Hello I am iPhone SE");
    expect(strs).toContain("Saltcorn");
    expect(strs).toContain("Publisher");
    expect(strs).toContain("Normalised");
  });
  it("should query type names", async () => {
    expect(getState().type_names).toStrictEqual([
      "String",
      "Integer",
      "Bool",
      "Date",
      "Float",
      "Color",
    ]);
  });
});
describe("State room emission", () => {
  it("should survive emit when not set", async () => {
    getState().emitRoom("hello", 5);
  });
  it("should use roomEmitter", async () => {
    let msg;
    const myEmit = (...args: any[]) => {
      msg = args;
    };
    getState().setRoomEmitter(myEmit);
    getState().emitRoom("hello", 5);
    expect(msg).toStrictEqual(["hello", 5]);
  });
});
