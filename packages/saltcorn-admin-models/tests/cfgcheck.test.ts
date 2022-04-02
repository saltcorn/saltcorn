import db from "@saltcorn/data/db/index";

const { getState } = require("@saltcorn/data/db/state");

import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
const { runConfigurationCheck } = require("../models/config-check");
import mocks from "@saltcorn/data/tests/mocks";

const { mockReqRes } = mocks;

getState().registerPlugin("base", require("@saltcorn/data/base-plugin"));

beforeAll(async () => {
  await require("@saltcorn/data/db/reset_schema")();
  await require("@saltcorn/data/db/fixtures")();
});

afterAll(async () => {
  await db.close();
});
jest.setTimeout(30000);

describe("config check", () => {
  it("runs", async () => {
    const { errors, passes, pass } = await runConfigurationCheck(
      mockReqRes.req
    );
    expect(errors).toStrictEqual([]);
    expect(passes).toBeGreaterThan(2000);
    expect(pass).toBe(true);
  });
});
