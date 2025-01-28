/**
 * @category server
 * @module routes/search
 * @subcategory routes
 */

const Router = require("express-promise-router");
const { span, h5, h4, nbsp, p, a, div } = require("@saltcorn/markup/tags");

const { getState } = require("@saltcorn/data/db/state");
const db = require("@saltcorn/data/db");

const { isAdmin, error_catcher } = require("./utils.js");
const Form = require("@saltcorn/data/models/form");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
const { renderForm } = require("@saltcorn/markup");
const { pagination } = require("@saltcorn/markup/helpers");
const { send_infoarch_page } = require("../markup/admin.js");
const { InvalidConfiguration } = require("@saltcorn/data/utils");

/**
 * @type {object}
 * @const
 * @namespace searchRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

/**
 * Search Configuration form
 * @param {object[]} tables
 * @param {object[]} views
 * @param {object} req
 * @returns {Forms}
 */
const searchConfigForm = (tables, views, req) => {
  let fields = [];
  let tbls_noviews = [];
  for (const t of tables) {
    const ok_views = views.filter(
      (v) =>
        v.table_id === t.id && v.viewtemplateObj && v.viewtemplateObj.runMany
    );
    if (ok_views.length === 0) tbls_noviews.push(t.name);
    else
      fields.push({
        name: t.name,
        label: req.__("Result preview for ") + t.name,
        required: false,
        type: "String",
        attributes: { options: ok_views.map((v) => v.name).join() },
      });
  }
  fields.push({
    name: "search_table_description",
    label: req.__("Description header"),
    sublabel: req.__("Use table description instead of name as header"),
    type: "Bool",
  });
  fields.push({
    name: "search_results_decoration",
    label: req.__("Show results in"),
    sublabel: req.__("Show results from each table in this type of element"),
    input_type: "select",
    options: ["Cards", "Tabs"],
  });
  const blurb1 = req.__(
    `Choose views for <a href="/search">search results</a> for each table.<br/>Set to blank to omit table from global search.`
  );
  return new Form({
    action: "/search/config",
    noSubmitButton: true,
    onChange: `saveAndContinue(this)`,
    blurb:
      blurb1 +
      (tbls_noviews.length > 0
        ? `<br/><br/>${req.__(
            "These tables lack suitable views: "
          )}${tbls_noviews.join(", ")}.`
        : ""),
    fields,
  });
};

/**
 * Show config on GET
 * @name get/config
 * @function
 * @memberof module:routes/search~searchRouter
 * @function
 */
router.get(
  "/config",
  isAdmin,
  error_catcher(async (req, res) => {
    const views = await View.find({}, { orderBy: "name" });
    const tables = await Table.find();
    const form = searchConfigForm(tables, views, req);
    form.values = getState().getConfig("globalSearch", {});
    form.values.search_table_description = getState().getConfig(
      "search_table_description",
      false
    );
    form.values.search_results_decoration = getState().getConfig(
      "search_results_decoration",
      "Cards"
    );
    send_infoarch_page({
      res,
      req,
      active_sub: "Search",
      contents: {
        type: "card",
        title: req.__(`Search configuration`),
        titleAjaxIndicator: true,
        contents: renderForm(form, req.csrfToken()),
      },
    });
  })
);

/**
 * Execute config update
 * @name post/config
 * @function
 * @memberof module:routes/search~searchRouter
 * @function
 */
router.post(
  "/config",
  isAdmin,
  error_catcher(async (req, res) => {
    const views = await View.find({}, { orderBy: "name" });
    const tables = await Table.find();
    const form = searchConfigForm(tables, views, req);
    const result = form.validate(req.body);

    if (result.success) {
      const dbversion = await db.getVersion(true);
      const search_table_description =
        !!result.success.search_table_description;
      await getState().setConfig(
        "search_table_description",
        search_table_description
      );
      await getState().setConfig(
        "search_results_decoration",
        result.success.search_results_decoration || "Cards"
      );
      await getState().setConfig("search_use_websearch", +dbversion >= 11.0);
      delete result.success.search_table_description;
      delete result.success.search_results_decoration;
      await getState().setConfig("globalSearch", result.success);
      if (!req.xhr) res.redirect("/search/config");
      else res.json({ success: "ok" });
    } else {
      send_infoarch_page({
        res,
        req,
        active_sub: "Search",
        contents: {
          type: "card",
          title: req.__(`Search configuration`),
          contents: renderForm(form, req.csrfToken()),
        },
      });
    }
  })
);

/**
 * Search form
 * @returns {Form}
 */
const searchForm = () =>
  new Form({
    action: "/search",
    noSubmitButton: true,
    labelCols: 0,
    methodGET: true,
    fields: [
      {
        name: "q",
        label: " ",
        input_type: "search",
      },
    ],
  });

/**
 * Run search
 * @param {object} opts
 * @param {*} opts.q
 * @param {*} opts._page
 * @param {*} opts.table
 * @param {object} opts
 * @param {object} req
 * @param {object} res
 * @returns {Promise<void>}
 */
const runSearch = async ({ q, _page, table }, req, res) => {
  const role = (req.user || {}).role_id || 100;
  // globalSearch contains list of pairs: table, view
  const cfg = getState().getConfig("globalSearch");
  const page_size = getState().getConfig("search_page_size");

  if (!cfg) {
    req.flash("warning", req.__("Search not configured"));
    res.redirect("/");
    return;
  }
  const search_table_description = getState().getConfig(
    "search_table_description",
    false
  );
  const search_results_decoration = getState().getConfig(
    "search_results_decoration",
    "Cards"
  );
  const current_page = parseInt(_page) || 1;
  const offset = (current_page - 1) * page_size;
  let tablesWithResults = [];
  let tablesConfigured = 0;
  for (const [tableName, viewName] of Object.entries(cfg)) {
    if (
      !viewName ||
      viewName === "" ||
      viewName === "search_table_description" ||
      tableName === "search_table_description" ||
      viewName === "search_results_decoration" ||
      tableName === "search_results_decoration"
    )
      continue;
    tablesConfigured += 1;
    if (table && tableName !== table) continue;
    let sectionHeader = tableName;
    if (search_table_description) {
      sectionHeader =
        Table.findOne({ name: tableName })?.description || tableName;
    }
    const view = await View.findOne({ name: viewName });
    if (!view)
      throw new InvalidConfiguration(
        `View ${viewName} selected as search results for ${tableName}: view not found`
      );
    // search table using view
    const vresps = await view.runMany(
      { _fts: q },
      { res, req, limit: page_size, offset }
    );
    let paginate = "";
    if (vresps.length === page_size || current_page > 1) {
      paginate = pagination({
        current_page,
        pages: current_page + (vresps.length === page_size ? 1 : 0),
        trailing_ellipsis: vresps.length === page_size,
        get_page_link: (n) =>
          `gopage(${n}, ${page_size}, undefined, {table:'${tableName}'}, this)`,
      });
    }

    if (vresps.length > 0) {
      tablesWithResults.push({
        tableName,
        label: sectionHeader,
        contents: vresps.map((vr) => vr.html).join("<hr>") + paginate,
      });
    }
  }

  // Prepare search form
  const form = searchForm();
  form.validate({ q });
  console.log({ search_results_decoration });

  const mkResultDisplay = () => {
    switch (search_results_decoration) {
      case "Tabs":
        const tabContents = {};
        tablesWithResults.forEach((tblRes) => {
          tabContents[tblRes.label] = tblRes.contents;
        });
        return [{ type: "card", tabContents }];

      default:
        return tablesWithResults.map((tblRes) => ({
          type: "card",
          title: span({ id: tblRes.tableName }, tblRes.label),
          contents: tblRes.contents,
        }));
    }
  };

  // Prepare search result visualization
  const searchResult =
    tablesWithResults.length === 0
      ? [{ type: "card", contents: req.__("Not found") }]
      : mkResultDisplay();
  res.sendWrap(req.__("Search all tables"), {
    above: [
      {
        type: "card",
        contents: div(
          renderForm(form, false),
          syntax_help_link(req),
          typeof table !== "undefined" &&
            tablesConfigured > 1 &&
            div(
              req.__("Showing matches in table %s.", table),
              "&nbsp;",
              a(
                {
                  href: `javascript:set_state_fields({table:{unset:true},_page:{unset:true}})`,
                },
                req.__("Search all tables")
              )
            ),
          tablesWithResults.length > 1 &&
            div(
              req.__("Show only matches in table:"),
              "&nbsp;",
              tablesWithResults
                .map(({ tableName, label }) =>
                  a(
                    {
                      href: `javascript:set_state_field('table', '${tableName}')`,
                    },
                    label
                  )
                )
                .join(" | ")
            )
        ),
      },
      ...searchResult,
    ],
  });
};

const syntax_help_link = (req) => {
  const use_websearch = getState().getConfig("search_use_websearch", false);
  if (use_websearch)
    return a(
      {
        href: "javascript:void(0);",
        onclick: "ajax_modal('/search/syntax-help')",
      },
      req.__("Search syntax")
    );
  else return "";
};

/**
 * Execute search or only show search form
 * @name get
 * @function
 * @memberof module:routes/search~searchRouter
 * @function
 */
router.get(
  "/",
  error_catcher(async (req, res) => {
    const min_role = getState().getConfig("min_role_search");
    const role = (req.user || {}).role_id || 100;
    if (role > min_role) {
      res.redirect("/"); // silent redirect to home page
      return;
    }

    if (req.query && req.query.q) {
      await runSearch(req.query, req, res);
    } else {
      const cfg = getState().getConfig("globalSearch");

      if (!cfg) {
        const role = (req.user || {}).role_id || 100;

        req.flash("warning", req.__("Search not configured"));
        res.redirect(role === 1 ? "/search/config" : "/");
        return;
      }

      const form = searchForm();
      res.sendWrap(req.__("Search all tables"), {
        type: "card",
        contents: renderForm(form, false) + syntax_help_link(req),
      });
    }
  })
);

router.get(
  "/syntax-help",
  error_catcher(async (req, res) => {
    res.sendWrap(
      req.__("Search syntax help"),
      div(
        p(
          `Individual words matched independently. Example <code>large cat</code>`
        ),
        p(
          `Double quotes to match phrase as a single unit. Example <code>"large cat"</code> matches "the large cat sat..." but not "the large brown cat".`
        ),
        p(
          `"or" to match either of two phrases. Example <code>cat or mouse</code>`
        ),
        p(
          `"-" to exclude a word or phrase. Example <code>cat -mouse</code> does not match "cat and mouse"`
        )
      )
    );
  })
);
