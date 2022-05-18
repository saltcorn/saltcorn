import db from "../db";
const state = require("../db/state");
const { getState } = state;
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

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
