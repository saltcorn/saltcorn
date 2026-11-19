import getApp from "../app.js";
import {
  request,
  getAdminLoginCookie,
  getStaffLoginCookie,
  resetToFixtures,
  toInclude,
  toNotInclude,
  toRedirect,
} from "../auth/testhelp.js";
import db from "@saltcorn/data/db";
import { sleep } from "@saltcorn/data/tests/mocks";
import View from "@saltcorn/data/models/view";
import Table from "@saltcorn/data/models/table";
import Snapshot from "@saltcorn/admin-models/models/snapshot";

afterAll(async () => {
  await sleep(200);
  db.close();
});

let snapId;

beforeAll(async () => {
  await resetToFixtures();
  await Snapshot.take_if_changed("cmp_base");
  snapId = (await Snapshot.findOne({ name: "cmp_base" })).id;
  const table = Table.findOne({ name: "books" });
  await View.create({
    table_id: table.id,
    name: "CompareNewView",
    viewtemplate: "List",
    configuration: { columns: [] },
    min_role: 100,
  });
});

describe("snapshot list", () => {
  it("shows the picker and compare links", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/admin/snapshot-list")
      .set("Cookie", loginCookie)
      .expect(200)
      .expect(toInclude('action="/admin/snapshot-compare"'))
      .expect(toInclude("Current application"))
      .expect(toInclude(`/admin/snapshot-compare?from=${snapId}&to=current`))
      .expect(toInclude(`/admin/snapshot-download/${snapId}`));
  });
});

describe("snapshot compare", () => {
  it("lists a view added since the snapshot", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get(`/admin/snapshot-compare?from=${snapId}&to=current`)
      .set("Cookie", loginCookie)
      .expect(200)
      .expect(toInclude("Compare snapshots"))
      .expect(toInclude("cmp_base"))
      .expect(toInclude("+ CompareNewView"))
      .expect(toNotInclude("No differences"));
  });

  it("lists the view as removed when swapped", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get(`/admin/snapshot-compare?from=current&to=${snapId}`)
      .set("Cookie", loginCookie)
      .expect(200)
      .expect(toInclude("&minus; CompareNewView"));
  });

  it("shows field-level changes", async () => {
    const view = View.findOne({ name: "CompareNewView" });
    await View.update({ min_role: 80 }, view.id);
    await Snapshot.take_if_changed("cmp_after");
    const after = await Snapshot.findOne({ name: "cmp_after" });
    await View.update({ min_role: 1 }, view.id);
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get(`/admin/snapshot-compare?from=${after.id}&to=current`)
      .set("Cookie", loginCookie)
      .expect(200)
      .expect(toInclude("<summary>CompareNewView"))
      .expect(toInclude("<code>min_role</code>"))
      .expect(toInclude("<code>80</code>"))
      .expect(toInclude("<code>1</code>"));
  });

  it("marks removed and added values explicitly", async () => {
    const view = View.findOne({ name: "CompareNewView" });
    await View.update(
      { configuration: { columns: [], extra_setting: "x" } },
      view.id
    );
    await Snapshot.take_if_changed("cmp_with_extra");
    const withExtra = await Snapshot.findOne({ name: "cmp_with_extra" });
    await View.update({ configuration: { columns: [] } }, view.id);
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get(`/admin/snapshot-compare?from=${withExtra.id}&to=current`)
      .set("Cookie", loginCookie)
      .expect(200)
      .expect(toInclude("<code>configuration.extra_setting</code>"))
      .expect(toInclude("(removed)"))
      .expect(toInclude("var(--bs-danger)"));
    await request(app)
      .get(`/admin/snapshot-compare?from=current&to=${withExtra.id}`)
      .set("Cookie", loginCookie)
      .expect(200)
      .expect(toInclude("(not set)"))
      .expect(toInclude("var(--bs-success)"));
  });

  it("renders snapshot dates as HTML, not escaped markup", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get(`/admin/snapshot-compare?from=${snapId}&to=current`)
      .set("Cookie", loginCookie)
      .expect(200)
      .expect(toInclude("<time datetime="))
      .expect(toNotInclude("&lt;time"));
    await request(app)
      .get("/admin/snapshot-list")
      .set("Cookie", loginCookie)
      .expect(200)
      .expect(toNotInclude("&lt;time"))
      .expect(toInclude("cmp_base · 20"));
  });

  it("shows no differences for the same snapshot", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get(`/admin/snapshot-compare?from=${snapId}&to=${snapId}`)
      .set("Cookie", loginCookie)
      .expect(200)
      .expect(toInclude("No differences"));
  });

  it("redirects for an unknown or invalid snapshot", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get(`/admin/snapshot-compare?from=999999&to=current`)
      .set("Cookie", loginCookie)
      .expect(toRedirect("/admin/snapshot-list"));
    await request(app)
      .get(`/admin/snapshot-compare?from=abc&to=current`)
      .set("Cookie", loginCookie)
      .expect(toRedirect("/admin/snapshot-list"));
  });

  it("is not available to non-admins", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getStaffLoginCookie();
    await request(app)
      .get(`/admin/snapshot-compare?from=${snapId}&to=current`)
      .set("Cookie", loginCookie)
      .expect(toRedirect("/"));
  });
});
