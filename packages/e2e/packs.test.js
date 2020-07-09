const puppeteer = require("puppeteer");
const { Browser } = require("./utils");

let browser;
jest.setTimeout(60 * 1000);

beforeAll(async () => {
  browser = await Browser.init();
});

describe("Packs", () => {
  it("Installs blog pack", async () => {
    await browser.delete_tenant("sub2");
    await browser.create_tenant("sub2");
    await browser.install_pack("Blog");
    await browser.goto("/");
    expect(await browser.content()).toContain("Add Post");
    await browser.goto("/view/EditPost");
    await browser.page.type("#inputtitle", "My First Post");
    await browser.page.type("#inputexcerpt", "A wonderful post");
    await browser.page.type("#inputbody", "Lorem ipsum");
    await browser.clickNav("button[type=submit]");
    await browser.goto("/");
    expect(await browser.content()).toContain("Add Post");
    await browser.goto("/auth/logout");
    await browser.goto("/");
    expect(await browser.content()).not.toContain("Add Post");
    expect(await browser.content()).toContain("A wonderful post");
    expect(await browser.content()).toContain(
      '<a href="/view/Full%20Post?title=My%20First%20Post">Full Post</a>'
    );
    await browser.goto("/view/Full%20Post?title=My%20First%20Post");
    expect(await browser.content()).not.toContain("A wonderful post");
    expect(await browser.content()).toContain("Lorem ipsum");
    expect(await browser.content()).toContain("Add Comment");
    await browser.goto("/view/EditComment?post=1");
    await browser.page.type("#inputname", "Donald Trump");
    await browser.page.type("#inputcomment", "I'm a fraud");
    await browser.clickNav("button[type=submit]");
    await browser.goto("/");
    expect(await browser.content()).toContain(
      '<span class="small">1</span><span class="small"> comment'
    );
    await browser.goto("/view/Full%20Post?title=My%20First%20Post");
    expect(await browser.content()).toContain("Donald Trump");
    expect(await browser.content()).toContain("I'm a fraud");
  });

  it("Installs PM pack", async () => {
    await browser.delete_tenant("sub3");
    await browser.create_tenant("sub3");
    await browser.install_pack("Project management");
    await browser.clickNav(".col-sm-6 > a");
    await browser.page.type("#inputname", "Homework");
    await browser.clickNav("button[type=submit]");
    await browser.clickNav("#todos > a");
    await browser.page.type("#inputdescription", "Maths");
    await browser.clickNav("button[type=submit]");
    await browser.goto("/view/todokanban");
    const page = await browser.page.content();
    expect(page).toContain("Maths");
    expect(page).toContain("todokanban");
  });

  it("Installs issue tracker pack", async () => {
    await browser.delete_tenant("sub1");
    await browser.create_tenant("sub1");
    await browser.install_pack("Issue  tracker");
    await browser.clickNav(".card-body > div > a");
    await browser.page.type("#inputdescription", "my new task");
    await browser.page.type("#inputdetails", "some stuff");
    await browser.clickNav("button[type=submit]");
    await browser.clickNav("td > a");
  });
});

afterAll(async () => {
  await browser.delete_tenant("sub2");
  await browser.delete_tenant("sub3");
  await browser.delete_tenant("sub1");
  await browser.close();
});
