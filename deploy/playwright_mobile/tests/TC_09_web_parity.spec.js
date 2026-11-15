const { test, expect } = require("@playwright/test");

const { dumpHTML } = require("./helpers");

const contentFrame = async (page) =>
  (await page.locator("#content-iframe").elementHandle()).contentFrame();

// Regression tests for helpers that differed between saltcorn.js (web) and
// iframe_view_utils.js (mobile), or were missing on mobile
test.describe("Mobile parity with the web helpers", () => {
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

  const gotoView = async (route, query) => {
    await page.evaluate(
      async ([route, query]) =>
        await window.saltcorn.mobileApp.navigation.handleRoute(route, query),
      [route, query]
    );
    await expect(
      page.frameLocator("iframe").locator("#page-inner-content")
    ).toBeVisible();
  };

  // collects the pjax GETs for a view while fn runs
  const pjaxQueries = async (viewname, fn) => {
    const queries = [];
    const listener = (req) => {
      const url = new URL(req.url());
      if (req.method() === "GET" && url.pathname === `/view/${viewname}`)
        queries.push(url.searchParams);
    };
    page.on("request", listener);
    try {
      await fn();
    } finally {
      page.off("request", listener);
    }
    return queries;
  };

  test("web helpers and globals exist on mobile", async () => {
    await gotoView("get/view/guitar_list");
    const frame = await contentFrame(page);
    const types = await frame.evaluate(() => ({
      ensure_modal_exists_and_closed: typeof ensure_modal_exists_and_closed,
      checkNetworkError: typeof checkNetworkError,
      fill_formula_btn_click: typeof fill_formula_btn_click,
      ensure_script_loaded: typeof ensure_script_loaded,
      ensure_css_loaded: typeof ensure_css_loaded,
      delprevwfroomrun: typeof delprevwfroomrun,
      _sc_pageloadtag: typeof _sc_pageloadtag,
      _sc_lightmode: typeof _sc_lightmode,
      _sc_globalCsrf: typeof _sc_globalCsrf,
    }));
    expect(types).toEqual({
      ensure_modal_exists_and_closed: "function",
      checkNetworkError: "function",
      fill_formula_btn_click: "function",
      ensure_script_loaded: "function",
      ensure_css_loaded: "function",
      delprevwfroomrun: "function",
      _sc_pageloadtag: "string",
      _sc_lightmode: "string",
      _sc_globalCsrf: "string",
    });
  });

  test("ensure_script_loaded loads a server asset from the app bundle", async () => {
    const frame = await contentFrame(page);
    const loaded = await frame.evaluate(
      () =>
        new Promise((resolve) => {
          // the path the date range header filter uses
          ensure_script_loaded(
            `/static_assets/${_sc_version_tag}/flatpickr.min.js`,
            () => resolve(typeof flatpickr)
          );
          setTimeout(() => resolve("timeout"), 5000);
        })
    );
    expect(loaded).toBe("function");
  });

  test("view_post accepts the options object as 4th argument", async () => {
    await page.route("http://localhost:3010/view/guitar_list/tc09_route", (r) =>
      r.fulfill({ contentType: "application/json", body: '{"ok":true}' })
    );
    try {
      const frame = await contentFrame(page);
      const result = await frame.evaluate(
        () =>
          new Promise((resolve) => {
            view_post(
              "guitar_list",
              "tc09_route",
              {},
              { onDone: (res) => resolve(res), runAsync: true }
            ).then(() => setTimeout(() => resolve("not called"), 500));
          })
      );
      expect(result).toEqual({ ok: true });
    } finally {
      await page.unroute("http://localhost:3010/view/guitar_list/tc09_route");
    }
  });

  test("saveAndContinueDelayed runs the callback after saving", async () => {
    try {
      await gotoView("get/view/calc_test_edit");
      const iframe = page.frameLocator("iframe");
      await iframe.locator("#inputname").fill("save and go back");
      const frame = await contentFrame(page);
      const called = await frame.evaluate(
        () =>
          new Promise((resolve) => {
            // what the GoBack button with "save first" generates on mobile
            saveAndContinueDelayed(
              document.querySelector("#inputname"),
              "/view/calc_test_edit",
              () => resolve(true)
            );
            setTimeout(() => resolve(false), 5000);
          })
      );
      expect(called).toBe(true);
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("saveAndContinueAsync with only the element resolves", async () => {
    try {
      await gotoView("get/view/calc_test_edit");
      const iframe = page.frameLocator("iframe");
      await iframe.locator("#inputname").fill("async save");
      const frame = await contentFrame(page);
      const result = await frame.evaluate(() =>
        Promise.race([
          // the eval_js the Save form action returns
          saveAndContinueAsync($("#inputname")).then(() => "resolved"),
          new Promise((resolve) => setTimeout(() => resolve("hung"), 5000)),
        ]).catch((e) => "rejected: " + e.message)
      );
      expect(result).toBe("resolved");
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("ajax_post calls the success option", async () => {
    try {
      const id = await page.evaluate(async () => {
        const res = await window.saltcorn.mobileApp.api.apiCall({
          method: "POST",
          path: "/api/calc_test",
          body: { name: "to delete" },
        });
        return res.data.success;
      });
      expect(typeof id).toBe("number");
      await gotoView("get/view/guitar_list");
      const frame = await contentFrame(page);
      const called = await frame.evaluate(
        (id) =>
          new Promise((resolve) => {
            // what a Delete column with "Reload page" generates
            ajax_post(`/delete/calc_test/${id}`, {
              success: () => resolve(true),
            }).then(() => setTimeout(() => resolve(false), 500));
          }),
        id
      );
      expect(called).toBe(true);
    } catch (error) {
      await dumpHTML(page);
      throw error;
    }
  });

  test("ajax_modal initializes the modal content", async () => {
    await gotoView("get/view/guitar_list");
    const frame = await contentFrame(page);
    const result = await frame.evaluate(async () => {
      let initialized = false;
      const orig = window.initialize_page;
      window.initialize_page = (...args) => {
        initialized = true;
        return orig(...args);
      };
      try {
        await mobile_modal("/view/guitar_list");
      } finally {
        window.initialize_page = orig;
      }
      return {
        initialized,
        modalState: $("#scmodal").prop("data-modal-state"),
      };
    });
    expect(result.initialized).toBe(true);
    expect(result.modalState).toBe("/view/guitar_list");
  });

  test("a filter inside a modal reads the modal state", async () => {
    try {
      const frame = await contentFrame(page);
      const queries = await pjaxQueries("guitar_list", () =>
        frame.evaluate(async () => {
          await set_state_field(
            "name",
            "in_modal",
            $("#scmodal .modal-body")[0]
          );
        })
      );
      expect(queries.length).toBe(1);
      expect(queries[0].get("name")).toBe("in_modal");
      const modalState = await frame.evaluate(() =>
        $("#scmodal").prop("data-modal-state")
      );
      expect(modalState).toContain("name=in_modal");
    } finally {
      const frame = await contentFrame(page);
      await frame.evaluate(() => $("#scmodal").modal("hide"));
    }
  });

  test("a second filter keeps the first one", async () => {
    await gotoView("get/view/guitar_list");
    const frame = await contentFrame(page);
    const queries = await pjaxQueries("guitar_list", () =>
      frame.evaluate(async () => {
        await set_state_field("name", "first");
        await set_state_field("status", "1");
      })
    );
    expect(queries.length).toBe(2);
    expect(queries[1].get("name")).toBe("first");
    expect(queries[1].get("status")).toBe("1");
  });

  test("filter values are URL-encoded", async () => {
    await gotoView("get/view/guitar_list");
    const frame = await contentFrame(page);
    const queries = await pjaxQueries("guitar_list", () =>
      frame.evaluate(async () => {
        await set_state_field("name", "a&b c+d#e");
      })
    );
    expect(queries.length).toBe(1);
    expect(queries[0].get("name")).toBe("a&b c+d#e");
    expect(queries[0].has("b c")).toBe(false);
  });

  test("checkbox group filters combine", async () => {
    await gotoView("get/view/guitar_list");
    const frame = await contentFrame(page);
    const queries = await pjaxQueries("guitar_list", () =>
      frame.evaluate(async () => {
        const box = (value, checked) => ({ name: "status", value, checked });
        await check_state_field(box("1", true));
        await check_state_field(box("2", true));
        await check_state_field(box("1", false));
      })
    );
    expect(queries.length).toBe(3);
    expect(queries[1].getAll("status")).toEqual(["1", "2"]);
    expect(queries[2].getAll("status")).toEqual(["2"]);
  });
});
