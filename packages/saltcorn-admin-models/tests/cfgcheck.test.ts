import db from "@saltcorn/data/db/index";

import { getState } from "@saltcorn/data/db/state";

import {
  afterAll,
  describe,
  it,
  expect,
  beforeAll,
  jest,
} from "@saltcorn/db-common/test_expect";
import { runConfigurationCheck } from "../models/config-check.js";
import * as mocks from "@saltcorn/data/tests/mocks";
import basePlugin from "@saltcorn/data/base-plugin";
import sbadmin2 from "@saltcorn/sbadmin2";
import reset from "@saltcorn/data/db/reset_schema";
import fixtures from "@saltcorn/data/db/fixtures";

const { mockReqRes } = mocks;

getState()!.registerPlugin("base", basePlugin);
getState()!.registerPlugin("sbadmin2", sbadmin2 as any);

beforeAll(async () => {
  await reset();
  await fixtures();
});

afterAll(async () => {
  await db.close();
});
jest.setTimeout(30000);
// todo tests for broken view
// todo tests for broken trigger / action
// todo tests for broken page
describe("config check", () => {
  it("runs", async () => {
    const { errors, passes, pass } = await runConfigurationCheck(
      mockReqRes.req
    );
    expect(errors).toStrictEqual([]);
    expect(passes.length).toBeGreaterThan(10);
    expect(pass).toBe(true);
  });
});
