import { createRequire } from "module";
const require = createRequire(import.meta.url);
const _sc_db_reset_schema = () => (require("../db/reset_schema.js") as any).default;
const _sc_db_fixtures = () => (require("../db/fixtures.js") as any).default;
import db from "../db/index.js";
import { assertIsSet } from "./assertions.js";
import { afterAll, describe, it, expect, beforeAll, jest } from "@saltcorn/db-common/test_expect";
import PageGroup, { ScreenInfoParams } from "../models/page_group.js";
import User from "../models/user.js";

afterAll(db.close);
beforeAll(async () => {
  await _sc_db_reset_schema()();
  await _sc_db_fixtures()();
});

describe("eligible_formula", () => {
  const tester = async (
    pageGroup: PageGroup,
    params: ScreenInfoParams,
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
