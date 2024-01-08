import db from "../db";
import { assertIsSet } from "./assertions";

import PageGroup, { EligiblePageParams } from "../models/page_group";
import User from "../models/user";

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

describe("eligible_formula", () => {
  const tester = async (
    pageGroup: PageGroup,
    params: EligiblePageParams,
    user: any,
    expectedPage?: string
  ) => {
    const page = await pageGroup.getEligiblePage(params, user);
    if (expectedPage) {
      expect(page).not.toBeNull();
      expect(page?.name).toBe(expectedPage);
    } else {
      expect(page).toBeNull();
    }
  };

  it("width and height", async () => {
    const pageGroup = PageGroup.findOne({ name: "page_group" });
    assertIsSet(pageGroup);
    const admin = await User.findOne({ email: "admin@foo.com" });
    assertIsSet(admin);

    await tester(
      pageGroup,
      { width: 912, height: 1368, innerWidth: 912, innerHeight: 1368 },
      admin,
      "Surface Pro 7"
    );
    await tester(
      pageGroup,
      { width: 414, height: 896, innerWidth: 912, innerHeight: 1368 },
      admin,
      "iPhone XR"
    );
    await tester(
      pageGroup,
      { width: 375, height: 667, innerWidth: 912, innerHeight: 1368 },
      admin,
      "iPhone SE"
    );
    await tester(
      pageGroup,
      { width: 1800, height: 900, innerWidth: 912, innerHeight: 1368 },
      admin,
      "Laptop"
    );
  });
  it("user does not match", async () => {
    const pageGroup = PageGroup.findOne({ name: "page_group" });
    assertIsSet(pageGroup);
    const staff = await User.findOne({ email: "staff@foo.com" });
    assertIsSet(staff);

    await tester(
      pageGroup,
      { width: 912, height: 1368, innerWidth: 912, innerHeight: 1368 },
      staff
    );
    await tester(
      pageGroup,
      { width: 912, height: 1368, innerWidth: 912, innerHeight: 1368 },
      { role_id: 100 }
    );

    await tester(
      pageGroup,
      { width: 414, height: 896, innerWidth: 912, innerHeight: 1368 },
      staff
    );
    await tester(
      pageGroup,
      { width: 414, height: 896, innerWidth: 912, innerHeight: 1368 },
      { role_id: 100 }
    );

    await tester(
      pageGroup,
      { width: 375, height: 667, innerWidth: 912, innerHeight: 1368 },
      staff
    );
    await tester(
      pageGroup,
      { width: 375, height: 667, innerWidth: 912, innerHeight: 1368 },
      { role_id: 100 }
    );

    await tester(
      pageGroup,
      { width: 1800, height: 900, innerWidth: 912, innerHeight: 1368 },
      staff
    );
    await tester(
      pageGroup,
      { width: 1800, height: 900, innerWidth: 912, innerHeight: 1368 },
      { role_id: 100 }
    );
  });
});
