const request = require("supertest");
const getApp = require("../app");
const {
  getAdminLoginCookie,
  toRedirect,
  toInclude,
  respondJsonWith,
  toNotInclude,
  resetToFixtures,
} = require("../auth/testhelp");
const db = require("@saltcorn/data/db");
const Page = require("@saltcorn/data/models/page");
const PageGroup = require("@saltcorn/data/models/page_group");
const PageGroupMember = require("@saltcorn/data/models/page_group_member");

beforeAll(async () => {
  await resetToFixtures();
});
afterAll(db.close);

describe("Edit Page groups", () => {
  it("shows the create new page group form", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/page_groupedit/new")
      .set("Cookie", loginCookie)
      .expect(toInclude("New"))
      .expect(toInclude(`action="/page_groupedit/edit-properties"`))
      .expect(toInclude("Save"));
  });

  let pageGroupName = "new page group";
  let nameAfterUpdate = "updated page group";
  it("creates a new page group", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/page_groupedit/edit-properties")
      .set("Cookie", loginCookie)
      .send({ name: pageGroupName })
      .expect(
        toRedirect(`/page_groupedit/${encodeURIComponent(pageGroupName)}`)
      );
    const fromDb = PageGroup.findOne({ name: pageGroupName });
    expect(fromDb).toBeTruthy();
  });

  it("shows the page group editor", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get(`/page_groupedit/${encodeURIComponent(pageGroupName)}`)
      .set("Cookie", loginCookie)
      .expect(toInclude("Members"))
      .expect(toInclude("Edit group Properties"))
      .expect(toNotInclude("Save"))
      .expect(toInclude(pageGroupName));
  });

  it("updates the page group properties", async () => {
    const oldGroup = PageGroup.findOne({ name: pageGroupName });
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    const resp = await request(app)
      .post("/page_groupedit/edit-properties")
      .set("Cookie", loginCookie)
      .send({ id: oldGroup.id, name: nameAfterUpdate, min_role: 100 });
    expect(resp.statusCode).toEqual(200);
    expect(resp._body.row).toEqual({
      name: nameAfterUpdate,
      description: null,
      min_role: 100,
    });
  });

  it("shows the add-member form", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    const res = await request(app)
      .get(`/page_groupedit/add-member/${nameAfterUpdate}`)
      .set("Cookie", loginCookie)
      .expect(toInclude("Page to be delivered"))
      .expect(toInclude("Eligible Formula"))
      .expect(toInclude("Cancel"))
      .expect(toInclude("Save"));
  });

  it("adds members to the page group", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post(`/page_groupedit/add-member/${nameAfterUpdate}`)
      .set("Cookie", loginCookie)
      .send({ page_name: "a_page", eligible_formula: "true" })
      .expect(
        toRedirect(`/page_groupedit/${encodeURIComponent(nameAfterUpdate)}`)
      );
    await request(app)
      .post(`/page_groupedit/add-member/${nameAfterUpdate}`)
      .set("Cookie", loginCookie)
      .send({ page_name: "page_with_html_file", eligible_formula: "true" })
      .expect(
        toRedirect(`/page_groupedit/${encodeURIComponent(nameAfterUpdate)}`)
      );
  });

  it("shows members in the page group editor", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get(`/page_groupedit/${encodeURIComponent(nameAfterUpdate)}`)
      .set("Cookie", loginCookie)
      .expect(toInclude("Members"))
      .expect(toInclude("a_page"))
      .expect(toInclude("page_with_html_file"))
      .expect(toInclude("Edit group Properties"))
      .expect(toNotInclude("Save"))
      .expect(toInclude(nameAfterUpdate));
  });

  it("updates members of the page group", async () => {
    const page = Page.findOne({ name: "a_page" });
    const group = PageGroup.findOne({ name: nameAfterUpdate });
    const members = await PageGroupMember.find({
      page_group_id: group.id,
      page_id: page.id,
    });
    expect(members.length).toBe(1);
    const member = members[0];
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post(`/page_groupedit/edit-member/${member.id}`)
      .set("Cookie", loginCookie)
      .send({ id: member.id, page_name: "a_page", eligible_formula: "1>0" })
      .expect(
        toRedirect(`/page_groupedit/${encodeURIComponent(nameAfterUpdate)}`)
      );
    await request(app)
      .get(`/page_groupedit/edit-member/${member.id}`)
      .set("Cookie", loginCookie)
      .expect(toInclude("Page to be delivered"))
      .expect(toInclude("Eligible Formula"))
      .expect(toInclude("Cancel"))
      .expect(toInclude("Save"))
      .expect(toInclude("1&gt;0"));
  });

  it("removes members from the page group", async () => {
    const page = Page.findOne({ name: "a_page" });
    const group = PageGroup.findOne({ name: nameAfterUpdate });
    const members = await PageGroupMember.find({
      page_group_id: group.id,
      page_id: page.id,
    });
    expect(members.length).toBe(1);
    const member = members[0];
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post(`/page_groupedit/remove-member/${member.id}`)
      .set("Cookie", loginCookie)
      .expect(toRedirect(`/page_groupedit/${encodeURIComponent(group.name)}`));
    await request(app)
      .get(`/page_groupedit/${encodeURIComponent(nameAfterUpdate)}`)
      .set("Cookie", loginCookie)
      .expect(toInclude("Members"))
      .expect(toNotInclude(page.name));
  });

  it("deletes the page group", async () => {
    const group = PageGroup.findOne({ name: nameAfterUpdate });
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post(`/page_groupedit/delete/${group.id}`)
      .set("Cookie", loginCookie)
      .expect(toRedirect("/pageedit"));
  });
});

describe("run page group", () => {
  it("width and height", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get(
        `/page/page_group?width=912&height=1368&innerWidth=912&innerHeight=1368`
      )
      .set("Cookie", loginCookie)
      .expect(toInclude("Surface Pro 7"))
      .expect(toNotInclude("iPhone XR"))
      .expect(toNotInclude("iPhone SE"));

    await request(app)
      .get(
        `/page/page_group?width=414&height=896&innerWidth=912&innerHeight=1368`
      )
      .set("Cookie", loginCookie)
      .expect(toNotInclude("Surface Pro 7"))
      .expect(toInclude("iPhone XR"))
      .expect(toNotInclude("iPhone SE"));

    await request(app)
      .get(
        `/page/page_group?width=375&height=667&innerWidth=912&innerHeight=1368`
      )
      .set("Cookie", loginCookie)
      .expect(toNotInclude("Surface Pro 7"))
      .expect(toNotInclude("iPhone XR"))
      .expect(toInclude("iPhone SE"));
  });
});
