const puppeteer = require("puppeteer");
const { Browser } = require("./utils");

let browser;
jest.setTimeout(60 * 1000);

beforeAll(async () => {
  browser = await Browser.init();
});

describe("blog pack", () => {
  it("Installs blog pack", async () => {
    await browser.delete_tenant("sub2");
    await browser.create_tenant("sub2");
    await browser.install_pack("Blog");
    await browser.goto("/");
    expect(await browser.content()).toContain("Add Post");
    await browser.goto("/view/EditPost");
    await browser.page.type("#inputtitle", "My First Post");
    await browser.page.type(
      "#inputexcerpt+div div.note-editable",
      "A wonderful post"
    );
    await browser.page.type("#inputbody+div div.note-editable", "Lorem ipsum");
    await browser.clickNav("button[type=submit]");
    await browser.goto("/");
    expect(await browser.content()).toContain("Add Post");
    await browser.goto("/auth/logout");
    await browser.goto("/");
    expect(await browser.content()).not.toContain("Add Post");
    expect(await browser.content()).toContain("A wonderful post");
    expect(await browser.content()).toContain(
      '<a href="/view/Full%20Post?title=My%20First%20Post">Read full post...</a>'
    );
    await browser.goto("/view/Full%20Post?title=My%20First%20Post");
    expect(await browser.content()).not.toContain("A wonderful post");
    expect(await browser.content()).toContain("Lorem ipsum");
    expect(await browser.content()).toContain("Add Comment");
    await browser.goto("/view/EditComment?post=1");
    await browser.page.type("#inputname", "Donald Trump");
    await browser.page.type(
      "#inputcomment+div div.note-editable",
      "I'm a fraud"
    );
    await browser.clickNav("button[type=submit]");
    await browser.goto("/");
    expect(await browser.content()).toContain(
      '<span class="small">1</span><span class="small"> comment'
    );
    await browser.goto("/view/Full%20Post?title=My%20First%20Post");
    expect(await browser.content()).toContain("Donald Trump");
    expect(await browser.content()).toContain("I'm a fraud");
  });
});
describe("PM packs", () => {
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

describe("todo packs", () => {
  it("Installs todo pack", async () => {
    await browser.delete_tenant("sub4");
    await browser.create_tenant("sub4");
    await browser.install_pack("Todo list");
    expect(await browser.content()).toContain("Description");
    expect(await browser.content()).toContain('id="inputdescription"');

    await browser.page.type(
      'form[action="/view/EditTodo"] input[type="text"]',
      "Take out trash"
    );
    await browser.clickNav('form[action="/view/EditTodo"] button');

    expect(await browser.content()).toContain("Description");
    await browser.page.type(
      'form[action="/view/EditTodo"] input[type="text"]',
      "Clean bathroom"
    );
    await browser.clickNav('form[action="/view/EditTodo"] button');
    expect(await browser.content()).toContain("Take out trash");
    expect(await browser.content()).toContain("Clean bathroom");
    await browser.clickNav(
      'form[action^="/edit/toggle/TodoItems/1/done"] button'
    );
    expect(await browser.content()).not.toContain("Take out trash");
    expect(await browser.content()).toContain("Clean bathroom");

    await browser.page.click("button#dropdownMenuButton");
    await browser.page.waitFor(250);
    expect(await browser.getInnerText("button#tribdone")).toBe("F");
    await browser.page.click("button#tribdone");
    expect(await browser.getInnerText("button#tribdone")).toBe("?");

    await browser.clickNav(
      'form[action="/view/List%20Todos"] button[type="submit"]'
    );
    expect(await browser.content()).toContain("Take out trash");
    expect(await browser.content()).toContain("Clean bathroom");

    await browser.page.click("button#dropdownMenuButton");
    await browser.page.waitFor(250);
    expect(await browser.getInnerText("button#tribdone")).toBe("?");
    await browser.page.click("button#tribdone");
    expect(await browser.getInnerText("button#tribdone")).toBe("T");
    await browser.clickNav(
      'form[action="/view/List%20Todos"] button[type="submit"]'
    );

    expect(await browser.content()).toContain("Take out trash");
    expect(await browser.content()).not.toContain("Clean bathroom");
    await browser.page.click("button#dropdownMenuButton");
    await browser.page.waitFor(250);
    expect(await browser.getInnerText("button#tribdone")).toBe("T");
    await browser.page.click("button#tribdone");
    await browser.page.click("button#tribdone");
    expect(await browser.getInnerText("button#tribdone")).toBe("?");
    await browser.page.type("#input_fts", "trash");
    await browser.clickNav(
      'form[action="/view/List%20Todos"] button[type="submit"]'
    );
    expect(await browser.content()).toContain("Take out trash");
    expect(await browser.content()).not.toContain("Clean bathroom");
  });
});

afterAll(async () => {
  await browser.delete_tenant("sub2");
  await browser.delete_tenant("sub3");
  await browser.delete_tenant("sub1");
  await browser.delete_tenant("sub4");
  await browser.close();
});
