import db from "../db";
const state = require("../db/state");
const {getState } = state
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

afterAll(db.close);

describe("State constants", () => {
  it("should have fonts", async () => {
    expect(getState().fonts.Arial).toBe(
      "Arial, Helvetica Neue, Helvetica, sans-serif"
    );
  });
});
