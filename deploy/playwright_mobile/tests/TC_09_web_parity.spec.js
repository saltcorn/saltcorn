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

  // answers view_post routes and records the posted URLs
  const fakeViewRoute = async (pattern, fn) => {
    const urls = [];
    const handler = (r) => {
      urls.push(r.request().url());
      return r.fulfill({ contentType: "application/json", body: "{}" });
    };
    await page.route(pattern, handler);
    try {
      await fn();
    } finally {
      await page.unroute(pattern, handler);
    }
    return urls.map((u) => new URL(u));
  };

  test("view_post sends the page state with sendState in the options", async () => {
    await gotoView("get/view/guitar_list", "name=state_test");
    const frame = await contentFrame(page);
    const urls = await fakeViewRoute(
      "http://localhost:3010/view/guitar_list/tc09_state**",
      () =>
        frame.evaluate(() =>
          view_post("guitar_list", "tc09_state", {}, { sendState: true })
        )
    );
    expect(urls.length).toBe(1);
    expect(urls[0].searchParams.get("name")).toBe("state_test");
  });

  test("view_post finds the view of an enclosing edit form", async () => {
    await gotoView("get/view/guitar_list");
    const frame = await contentFrame(page);
    const urls = await fakeViewRoute(
      "http://localhost:3010/view/**/tc09_form",
      () =>
        frame.evaluate(async () => {
          // a form outside any data-sc-embed-viewname wrapper
          const form = $(
            '<form data-viewname="calc_test_edit"><button type="button"></button></form>'
          ).appendTo("body");
          try {
            await view_post(form.find("button")[0], "tc09_form", {});
          } finally {
            form.remove();
          }
        })
    );
    expect(urls.length).toBe(1);
    expect(urls[0].pathname).toBe("/view/calc_test_edit/tc09_form");
  });

  // tc09_actions runs a toast action with the text "Guitar {{name}}"
  const runToastAction = (frame, useFormData) =>
    frame.evaluate(
      (useFormData) =>
        new Promise((resolve) => {
          let data = { rndid: "tc09ac", id: 1 };
          if (useFormData) {
            // built in the iframe, like get_form_data does
            data = new FormData();
            data.append("rndid", "tc09ac");
            data.append("id", "1");
          }
          view_post("tc09_actions", "run_action", data, {
            onDone: (res) => resolve(res),
          }).then(() => setTimeout(() => resolve("no result"), 500));
        }),
      useFormData
    );

  test("view_post offline runs the route locally", async () => {
    await gotoView("get/view/guitar_list");
    const frame = await contentFrame(page);
    // offline the route must answer from the local db, never the server
    const requests = [];
    const block = (route) => {
      requests.push(route.request().url());
      return route.abort();
    };
    await page.route("http://localhost:3010/**", block);
    await page.evaluate(() => {
      window.saltcorn.data.state.getState().mobileConfig.isOfflineMode = true;
    });
    try {
      const res = await runToastAction(frame, false);
      expect(res?.notify).toBe("Guitar Martin D-28");
      expect(requests).toEqual([]);
    } finally {
      await page.evaluate(() => {
        window.saltcorn.data.state.getState().mobileConfig.isOfflineMode = false;
      });
      await page.unroute("http://localhost:3010/**", block);
    }
  });

  test("view_post online sends a FormData body", async () => {
    await gotoView("get/view/guitar_list");
    const frame = await contentFrame(page);
    const res = await runToastAction(frame, true);
    // the server only finds the action and the row if both fields arrived
    expect(res?.notify).toBe("Guitar Martin D-28");
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

  test("saveAndContinueAsync rejects when the save fails", async () => {
    try {
      await gotoView("get/view/calc_test_edit");
      const iframe = page.frameLocator("iframe");
      await iframe.locator("#inputname").fill("failing save");
      // simulate a lost connection for the save
      const abortPosts = (route) =>
        route.request().method() === "POST" ? route.abort() : route.continue();
      await page.route("http://localhost:3010/**", abortPosts);
      try {
        const frame = await contentFrame(page);
        const result = await frame.evaluate(() =>
          Promise.race([
            saveAndContinueAsync($("#inputname")).then(() => "resolved"),
            new Promise((resolve) => setTimeout(() => resolve("hung"), 5000)),
          ]).catch(() => "rejected")
        );
        expect(result).toBe("rejected");
      } finally {
        await page.unroute("http://localhost:3010/**", abortPosts);
      }
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

  test("a blocking progress popup opens, updates and closes", async () => {
    try {
      await gotoView("get/view/guitar_list");
      const frame = await contentFrame(page);
      const iframe = page.frameLocator("iframe");
      // what an action returns to show a blocking progress popup
      const progress = (upd) =>
        frame.evaluate(
          (upd) => common_done({ progress_bar_update: upd }, "", false),
          upd
        );
      const modal = iframe.locator("#scmodal");

      await progress({
        blocking: true,
        title: "Working",
        message: "step 1",
        percent: 10,
      });
      await expect(modal).toBeVisible();
      await expect(modal.locator(".modal-title")).toHaveText("Working");
      await expect(modal.locator(".progress-message")).toHaveText("step 1");

      // a second update must change the open popup, not close it
      await progress({ blocking: true, message: "step 2", percent: 60 });
      await expect(modal).toBeVisible();
      await expect(modal.locator(".progress-message")).toHaveText("step 2");
      await expect(modal.locator("progress")).toHaveJSProperty("value", 60);

      await progress({ blocking: true, close: true });
      await expect(modal).toBeHidden();
    } catch (error) {
      await dumpHTML(page);
      throw error;
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

  test("unsetting a filter keeps the others intact", async () => {
    // name is "a&b c", encoded
    await gotoView("get/view/guitar_list", "name=a%26b%20c&status=1");
    const frame = await contentFrame(page);
    const queries = await pjaxQueries("guitar_list", () =>
      frame.evaluate(async () => {
        await unset_state_field("status");
      })
    );
    expect(queries.length).toBe(1);
    expect(queries[0].has("status")).toBe(false);
    expect(queries[0].get("name")).toBe("a&b c");
    expect(queries[0].has("b c")).toBe(false);
  });

  test("ticking the same checkbox twice adds its value once", async () => {
    await gotoView("get/view/guitar_list");
    const frame = await contentFrame(page);
    const queries = await pjaxQueries("guitar_list", () =>
      frame.evaluate(async () => {
        const box = { name: "status", value: "1", checked: true };
        await check_state_field(box);
        await check_state_field(box);
      })
    );
    expect(queries.length).toBe(2);
    expect(queries[1].getAll("status")).toEqual(["1"]);
  });

  test("setting a filter to an empty value removes it", async () => {
    await gotoView("get/view/guitar_list", "name=foo&status=1");
    const frame = await contentFrame(page);
    const queries = await pjaxQueries("guitar_list", () =>
      frame.evaluate(async () => {
        await set_state_field("name", "");
      })
    );
    expect(queries.length).toBe(1);
    expect(queries[0].has("name")).toBe(false);
    expect(queries[0].get("status")).toBe("1");
  });
});
