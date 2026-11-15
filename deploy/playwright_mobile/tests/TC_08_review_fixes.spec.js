const { test, expect } = require("@playwright/test");

const { dumpHTML } = require("./helpers");

const contentFrame = async (page) =>
  (await page.locator("#content-iframe").elementHandle()).contentFrame();

// Regression tests for mobile-only bugs found in the app review:
// - tablesUptodate never read updated_at, so the schema update ran on every start
// - apiCall sent FormData as "{}"
// - calculated fields in edit forms: query inside the route path never matched
// - a failed POST wiped the form
// - clear_state dropped the fields it should keep
// - the button onclick rewrite (history.back -> goBack) never happened
test.describe("Mobile review fixes", () => {
  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      ignoreHTTPSErrors: true,
    });
    page = await context.newPage();
    page.on("console", (msg) => console.log("BROWSER:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGEERROR:", err.message));
    await page.setViewportSize({ width: 1350, height: 720 });
    await page.goto("http://localhost:3010/mobile_test_build/index.html");
    // log in here, so a worker restarted after a failure is logged in too
    const iframe = page.frameLocator("iframe");
    await iframe.locator('input[type="email"]').fill("admin@foo.com");
    await iframe.locator('input[type="password"]').fill("AhGGr6rhu45");
    await iframe.locator('button[type="submit"]').click();
    await expect(iframe.locator(".toast .toast-body")).toHaveText(
      /Welcome, admin@foo.com!/i
    );
  });

  test.afterAll(async () => {
    await page.close();
    await context.close();
  });

  test("schema update is skipped when the history file is up to date", async () => {
    // init wrote the history file, so an older build needs no update
    const result = await page.evaluate(async () => {
      const { dbSchema } = window.saltcorn.mobileApp;
      return {
        upToDate: await dbSchema.tablesUptodate(0, "update_history"),
        updateNeeded: await dbSchema.dbUpdateNeeded(0),
        newerBuild: await dbSchema.tablesUptodate(
          Date.now() + 1e9,
          "update_history"
        ),
      };
    });
    expect(result.upToDate).toBe(true);
    expect(result.updateNeeded).toBe(false);
    expect(result.newerBuild).toBe(false);
  });

  test("apiCall sends FormData from the iframe as multipart", async () => {
    const name = `formdata_${Date.now()}`;
    await page.evaluate(async (name) => {
      // built with the iframe's FormData, like ajaxSubmitForm does
      const iframeWin = document.getElementById("content-iframe").contentWindow;
      const fd = new iframeWin.FormData();
      fd.append("name", name);
      await window.saltcorn.mobileApp.api.apiCall({
        method: "POST",
        path: "/api/process_type",
        body: fd,
      });
    }, name);
    const rows = await page.request
      .get("http://localhost:3010/api/process_type")
      .then((res) => res.json());
    expect(rows.success.some((r) => r.name === name)).toBe(true);
  });

  test("calculated field in an edit form updates on change", async () => {
    try {
      await page.evaluate(async () => {
        await window.saltcorn.mobileApp.navigation.handleRoute(
          "get/view/calc_test_edit"
        );
      });
      const iframe = page.frameLocator("iframe");
      const nameInput = iframe.locator("#inputname");
      await expect(nameInput).toBeVisible();
      await nameInput.fill("calc test");
      await nameInput.dispatchEvent("change");
      await expect(iframe.locator("[data-source-url]")).toHaveText(
        "CALC TEST",
        { timeout: 5000 }
      );
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("a failed submit keeps the form and the typed values", async () => {
    try {
      await page.evaluate(async () => {
        await window.saltcorn.mobileApp.navigation.handleRoute(
          "get/view/calc_test_edit"
        );
      });
      const iframe = page.frameLocator("iframe");
      const nameInput = iframe.locator("#inputname");
      await expect(nameInput).toBeVisible();
      await nameInput.fill("should survive");

      // simulate a lost connection for the submit
      const abortPosts = (route) =>
        route.request().method() === "POST" ? route.abort() : route.continue();
      await page.route("http://localhost:3010/**", abortPosts);
      try {
        await iframe.locator('button:has-text("Save")').click();
        await expect(iframe.locator(".toast .toast-body").last()).toBeVisible();
      } finally {
        await page.unroute("http://localhost:3010/**", abortPosts);
      }
      await expect(nameInput).toBeVisible();
      await expect(nameInput).toHaveValue("should survive");
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("clear_state keeps the omitted fields", async () => {
    try {
      await page.evaluate(async () => {
        await window.saltcorn.mobileApp.navigation.handleRoute(
          "get/view/guitar_list",
          "name=foo&status=1"
        );
      });
      const iframe = page.frameLocator("iframe");
      await expect(iframe.locator("#page-inner-content")).toBeVisible();

      const pjaxRequest = page.waitForRequest((req) =>
        req.url().includes("/view/guitar_list?")
      );
      const frame = await contentFrame(page);
      await frame.evaluate(() => clear_state("status"));
      const url = new URL((await pjaxRequest).url());
      expect(url.searchParams.get("status")).toBe("1");
      expect(url.searchParams.has("name")).toBe(false);
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("history.back() in a button onclick is rewritten for mobile", async () => {
    const frame = await contentFrame(page);
    const onclick = await frame.evaluate(() => {
      const btn = document.createElement("button");
      btn.id = "tc08-back-btn";
      btn.setAttribute("onclick", "history.back()");
      document.body.appendChild(btn);
      doMobileTransforms();
      const result = btn.getAttribute("onclick");
      btn.remove();
      return result;
    });
    expect(onclick).toBe("parent.saltcorn.mobileApp.navigation.goBack()");
  });

  test("a goto with a query string navigates to the view", async () => {
    try {
      const frame = await contentFrame(page);
      await frame.evaluate(() =>
        common_done({ goto: "/view/guitar_list?name=goto_test" }, "", false)
      );
      const loc = await page.evaluate(() => ({
        route: window.saltcorn.mobileApp.navigation.currentLocation(),
        query: window.saltcorn.mobileApp.navigation.currentQuery(),
      }));
      expect(loc.route).toContain("get/view/guitar_list");
      expect(loc.query).toBe("name=goto_test");
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("a dynamic update goto stays inside the app", async () => {
    try {
      const frame = await contentFrame(page);
      // call the socket listener directly, as if the server pushed this
      const hasListener = await frame.evaluate(async () => {
        const [listener] = get_shared_socket().listeners("dynamic_update");
        if (!listener) return false;
        await listener({ goto: "/view/guitar_list?name=dyn_test" });
        return true;
      });
      expect(hasListener).toBe(true);
      const query = await page.evaluate(() =>
        window.saltcorn.mobileApp.navigation.currentQuery()
      );
      expect(query).toBe("name=dyn_test");
      // the iframe must still show the app, not a server page
      await expect(
        page.frameLocator("iframe").locator("#page-inner-content")
      ).toBeVisible();
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("a stale CSRF token is refreshed and the request retried", async () => {
    const result = await page.evaluate(async () => {
      const cfg = window.saltcorn.data.state.getState().mobileConfig;
      cfg.csrfToken = "stale-token";
      const res = await window.saltcorn.mobileApp.api.apiCall({
        method: "POST",
        path: "/field/show-calculated/calc_test/name_upper/as_text",
        body: { name: "retry" },
        responseType: "text",
      });
      return { data: res.data, tokenChanged: cfg.csrfToken !== "stale-token" };
    });
    expect(result.data).toBe("RETRY");
    expect(result.tokenChanged).toBe(true);
  });

  test("a 401 for a still valid session doesn't log out", async () => {
    // a permission denial, the session itself is fine
    await page.route("http://localhost:3010/api/tc08_denied", (route) =>
      route.fulfill({ status: 401, body: "Not authorized" })
    );
    try {
      const result = await page.evaluate(async () => {
        let error;
        try {
          await window.saltcorn.mobileApp.api.apiCall({
            method: "GET",
            path: "/api/tc08_denied",
          });
        } catch (e) {
          error = e.message;
        }
        return {
          error,
          hasSession:
            window.saltcorn.data.state.getState().mobileConfig.hasSession,
          rows: (await window.saltcorn.data.db.select("session_table")).length,
        };
      });
      expect(result.error).toContain("401");
      expect(result.hasSession).toBe(true);
      expect(result.rows).toBe(1);
    } finally {
      await page.unroute("http://localhost:3010/api/tc08_denied");
    }
  });

  // keep this last, it ends the session
  test("an expired session shows the login page", async () => {
    try {
      await context.clearCookies();
      const result = await page.evaluate(async () => {
        try {
          await window.saltcorn.mobileApp.api.apiCall({
            method: "GET",
            path: "/notifications/count-unread",
          });
          return "no error";
        } catch (e) {
          return e.sessionExpired ? "expired" : e.message;
        }
      });
      expect(result).toBe("expired");
      const iframe = page.frameLocator("iframe");
      await expect(iframe.locator('input[type="email"]')).toBeVisible();
      await expect(iframe.locator(".alert, .toast").first()).toContainText(
        /session has expired/i
      );
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });
});
