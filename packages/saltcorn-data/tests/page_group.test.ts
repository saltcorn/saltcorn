import db from "../db";
import { assertIsSet } from "./assertions";

import PageGroup, { EligiblePageParams } from "../models/page_group";

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

describe("eligible_formula", () => {
  it("width and height", async () => {
    const pageGroup = PageGroup.findOne({ name: "page_group" });
    assertIsSet(pageGroup);
    const tester = async (
      params: EligiblePageParams,
      expectedPage?: string
    ) => {
      const page = await pageGroup.getEligiblePage(params);
      expect(page).not.toBeNull();
      expect(page?.name).toBe(expectedPage);
    };
    await tester(
      { width: 912, height: 1368, innerWidth: 912, innerHeight: 1368 },
      "Surface Pro 7"
    );
    await tester(
      { width: 414, height: 896, innerWidth: 912, innerHeight: 1368 },
      "iPhone XR"
    );
    await tester(
      { width: 375, height: 667, innerWidth: 912, innerHeight: 1368 },
      "iPhone SE"
    );
    await tester(
      { width: 1800, height: 900, innerWidth: 912, innerHeight: 1368 },
      "Laptop"
    );
  });
});
