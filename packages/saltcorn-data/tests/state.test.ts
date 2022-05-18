import db from "../db";
const state = require("../db/state");
import User from "../models/user";

const { getState } = state;
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

getState().registerPlugin("base", require("../base-plugin"));
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
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
      expect(typeof v).toBe("boolean");
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
    expect(getState().getStringsForI18n()).toStrictEqual([
      "Hello world",
      "<h1> foo</h1>",
      "Click here",
      "header",
      "Bye bye",
    ]);
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
