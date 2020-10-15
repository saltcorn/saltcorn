const Router = require("express-promise-router");

const Page = require("@saltcorn/data/models/page");
const { div, a, i } = require("@saltcorn/markup/tags");
const { renderForm } = require("@saltcorn/markup");
const { getState } = require("@saltcorn/data/db/state");
const { setTenant, error_catcher } = require("../routes/utils.js");

const router = new Router();
module.exports = router;
const add_edit_bar = (role, page, contents) => {
  if (role > 1) return contents;
  const bar = div(
    { class: "alert alert-light" },
    page.name,
    a(
      {
        class: "ml-4",
        href: `/pageedit/edit/${encodeURIComponent(page.name)}`,
      },
      "Edit&nbsp;",
      i({ class: "fas fa-edit" })
    )
  );

  if (contents.above) {
    contents.above.unshift(bar);
    return contents;
  } else return { above: [bar, contents] };
};
router.get(
  "/:pagename",
  setTenant,
  error_catcher(async (req, res) => {
    const { pagename } = req.params;
    const page = getState().pages[pagename];
    if (page) {
      const contents = await page.getPage();
      res.sendWrap(
        { title: page.title, description: page.description } ||
          `${pagename} page`,
        contents
      );
    } else {
      const role = req.isAuthenticated() ? req.user.role_id : 10;
      const db_page = await Page.findOne({ name: pagename });
      if (db_page && role <= db_page.min_role) {
        const contents = await db_page.run(req.query, { res, req });

        res.sendWrap(
          { title: db_page.title, description: db_page.description } ||
            `${pagename} page`,
          add_edit_bar(role, db_page, contents)
        );
      } else
        res
          .status(404)
          .sendWrap(`${pagename} page`, req.__("Page %s not found", pagename));
    }
  })
);
