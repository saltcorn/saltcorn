const Router = require("express-promise-router");
const { span, h5, h4, nbsp, p, a, div } = require("@saltcorn/markup/tags");

const { getState } = require("@saltcorn/data/db/state");
const { setTenant, isAdmin, error_catcher } = require("./utils.js");
const Form = require("@saltcorn/data/models/form");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
const { renderForm } = require("@saltcorn/markup");

const router = new Router();
module.exports = router;

const searchConfigForm = (tables, views, req) => {
  var fields = [];
  var tbls_noviews = [];
  for (const t of tables) {
    var ok_views = views.filter(
      (v) => v.table_id === t.id && v.viewtemplateObj.runMany
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
  const blurb1 = req.__(
    `Choose views for <a href="/search">search results</a> for each table.<br/>Set to blank to omit table from global search.`
  );
  return new Form({
    action: "/search/config",
    submitLabel: req.__("Save"),
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
const wrap = (response, req) => ({
  above: [
    {
      type: "breadcrumbs",
      crumbs: [{ text: req.__("Settings") }, { text: req.__("Search") }],
    },
    {
      type: "card",
      title: req.__("Search configuration"),
      contents: response,
    },
  ],
});
router.get(
  "/config",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    var views = await View.find({}, { orderBy: "name" });
    const tables = await Table.find();
    const form = searchConfigForm(tables, views, req);
    form.values = getState().getConfig("globalSearch");
    res.sendWrap(
      req.__(`Search configuration`),
      wrap(renderForm(form, req.csrfToken()), req)
    );
  })
);

router.post(
  "/config",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    var views = await View.find({}, { orderBy: "name" });
    const tables = await Table.find();
    const form = searchConfigForm(tables, views, req);
    const result = form.validate(req.body);

    if (result.success) {
      await getState().setConfig("globalSearch", result.success);
      res.redirect("/search/config");
    } else {
      res.sendWrap(
        req.__(`Search configuration`),
        wrap(renderForm(form, req.csrfToken()), req)
      );
    }
  })
);

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

const runSearch = async (q, req, res) => {
  const role = (req.user || {}).role_id || 10;
  const cfg = getState().getConfig("globalSearch");

  if (!cfg) {
    req.flash("warning", req.__("Search not configured"));
    res.redirect("/");
    return;
  }

  var resp = [];
  for (const [tableName, viewName] of Object.entries(cfg)) {
    if (!viewName || viewName === "") continue;
    const view = await View.findOne({ name: viewName });
    const vresps = await view.runMany({ _fts: q }, { res, req });
    if (vresps.length > 0)
      resp.push({
        type: "card",
        title: tableName,
        contents: vresps.map((vr) => vr.html).join("<hr>"),
      });
  }

  const form = searchForm();
  form.validate({ q });

  const searchResult =
    resp.length === 0
      ? [{ type: "card", contents: req.__("Not found") }]
      : resp;
  res.sendWrap(req.__("Search all tables"), {
    above: [
      {
        type: "card",
        contents: renderForm(form, false),
      },
      ...searchResult,
    ],
  });
};

router.get(
  "/",
  setTenant,
  error_catcher(async (req, res) => {
    if (req.query && req.query.q) {
      await runSearch(req.query.q, req, res);
    } else {
      const cfg = getState().getConfig("globalSearch");

      if (!cfg) {
        const role = (req.user || {}).role_id || 10;

        req.flash("warning", req.__("Search not configured"));
        res.redirect(role === 1 ? "/search/config" : "/");
        return;
      }

      const form = searchForm();
      form.noSubmitButton = false;
      form.submitLabel = req.__("Search");
      res.sendWrap(req.__("Search all tables"), renderForm(form, false));
    }
  })
);
