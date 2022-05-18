import db from "../db";
const state = require("../db/state");

afterAll(db.close);

describe("State constants", () => {
  it("should have fonts", async () => {
    expect(state.standard_fonts.Arial).toBe(
      "Arial, Helvetica Neue, Helvetica, sans-serif"
    );
  });
});
