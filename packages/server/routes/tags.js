const { a, text, i } = require("@saltcorn/markup/tags");

const Tag = require("@saltcorn/data/models/tag");
const Router = require("express-promise-router");
const Form = require("@saltcorn/data/models/form");
const User = require("@saltcorn/data/models/user");
const stream = require("stream");

const { isAdmin, error_catcher, csrfField } = require("./utils");
const { send_infoarch_page } = require("../markup/admin");

const {
  mkTable,
  post_delete_btn,
  link,
  renderForm,
} = require("@saltcorn/markup");

const {
  tablesList,
  setTableRefs,
  viewsList,
  getPageList,
  getTriggerList,
} = require("./common_lists");

const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");
const { create_pack_from_tag } = require("@saltcorn/admin-models/models/pack");

const router = new Router();
module.exports = router;

router.get(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    const rows = await Tag.find();
    send_infoarch_page({
      res,
      req,
      active_sub: "Tags",
      contents: {
        type: "card",
        title: req.__("Tags"),
        contents: [
          mkTable(
            [
              {
                label: req.__("Tag name"),
                key: (r) =>
                  link(`/tag/${r.id || r.name}?show_list=tables`, text(r.name)),
              },
              {
                label: req.__("Delete"),
                key: (r) => post_delete_btn(`/tag/delete/${r.id}`, req, r.name),
              },
            ],
            rows,
            {}
          ),
          a(
            {
              href: `/tag/new`,
              class: "btn btn-primary mt-3",
            },
            req.__("Create tag")
          ),
        ],
      },
    });
  })
);

router.get(
  "/new",
  isAdmin,
  error_catcher(async (req, res) => {
    res.sendWrap(req.__(`New tag`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__(`Tags`), href: "/tag" },
            { text: req.__(`New`) },
          ],
        },
        {
          type: "card",
          title: req.__(`New tag`),
          contents: renderForm(
            new Form({
              action: "/tag",
              submitLabel: req.__("Create"),
              fields: [
                {
                  label: req.__("Tag name"),
                  name: "name",
                  input_type: "text",
                  required: true,
                },
              ],
            }),
            req.csrfToken()
          ),
        },
      ],
    });
  })
);

router.get(
  "/download-pack/:idorname",
  isAdmin,
  error_catcher(async (req, res) => {
    const { idorname } = req.params;
    const id = parseInt(idorname);
    const tag = await Tag.findOne(id ? { id } : { name: idorname });
    if (!tag) {
      req.flash("error", req.__("Tag not found"));
      return res.redirect(`/tag`);
    }
    const pack = await create_pack_from_tag(tag);
    const readStream = new stream.PassThrough();
    readStream.end(JSON.stringify(pack));
    res.type("application/json");
    res.attachment(`${tag.name}-pack.json`);
    readStream.pipe(res);
  })
);
const headerWithCollapser = (title, cardId, showList, count) =>
  a(
    {
      class: `card-header-left-collapse ${!showList ? "collapsed" : ""} ps-3`,
      "data-bs-toggle": "collapse",
      href: `#${cardId}`,
      "aria-expanded": "false",
      "aria-controls": cardId,
      role: "button",
    },
    title,
    ` (${count})`
  );

const isShowList = (showList, listType) => showList === listType;

router.get(
  "/:idorname",
  isAdmin,
  error_catcher(async (req, res) => {
    const { idorname } = req.params;
    const { show_list } = req.query;
    const id = parseInt(idorname);
    const tag = await Tag.findOne(id ? { id } : { name: idorname });
    if (!tag) {
      req.flash("error", req.__("Tag not found"));
      return res.redirect(`/tag`);
    }
    const tables = await tag.getTables();
    const views = await tag.getViews();
    await setTableRefs(views);
    const pages = await tag.getPages();
    const triggers = await tag.getTriggers();
    const roles = await User.get_roles();

    const tablesDomId = "tablesListId";
    const viewsDomId = "viewsListId";
    const pagesDomId = "pagesDomId";
    const triggersDomId = "triggerDomId";
    res.sendWrap(req.__("%s Tag", tag.name), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [{ text: req.__(`Tags`), href: "/tag" }, { text: tag.name }],
        },
        {
          type: "card",
          title: headerWithCollapser(
            req.__("Tables"),
            tablesDomId,
            isShowList(show_list, "tables"),
            tables.length
          ),
          contents: [
            await tablesList(tables, req, {
              tagId: tag.id,
              domId: tablesDomId,
              showList: isShowList(show_list, "tables"),
            }),
            a(
              {
                href: `/tag-entries/add/tables/${tag.id}`,
                class: "btn btn-primary",
              },
              req.__("Add tables")
            ),
          ],
        },
        {
          type: "card",
          title: headerWithCollapser(
            req.__("Views"),
            viewsDomId,
            isShowList(show_list, "views"),
            views.length
          ),
          contents: [
            await viewsList(views, req, {
              tagId: tag.id,
              domId: viewsDomId,
              showList: isShowList(show_list, "views"),
            }),
            a(
              {
                href: `/tag-entries/add/views/${tag.id}`,
                class: "btn btn-primary",
              },
              req.__("Add views")
            ),
          ],
        },
        {
          type: "card",
          title: headerWithCollapser(
            req.__("Pages"),
            pagesDomId,
            isShowList(show_list, "pages"),
            pages.length
          ),
          contents: [
            await getPageList(pages, roles, req, {
              tagId: tag.id,
              domId: pagesDomId,
              showList: isShowList(show_list, "pages"),
            }),
            a(
              {
                href: `/tag-entries/add/pages/${tag.id}`,
                class: "btn btn-primary",
              },
              req.__("Add pages")
            ),
          ],
        },
        {
          type: "card",
          bodyId: "collapseTriggerCard",
          title: headerWithCollapser(
            req.__("Triggers"),
            triggersDomId,
            isShowList(show_list, "triggers"),
            triggers.length
          ),
          contents: [
            await getTriggerList(triggers, req, {
              tagId: tag.id,
              domId: triggersDomId,
              showList: isShowList(show_list, "triggers"),
            }),
            a(
              {
                href: `/tag-entries/add/triggers/${tag.id}`,
                class: "btn btn-primary",
              },
              req.__("Add triggers")
            ),
          ],
        },
        {
          type: "card",
          contents: [
            a(
              {
                class: "btn btn-outline-primary",
                href: `/tag/download-pack/${tag.id}`,
              },
              i({ class: "fas fa-download me-2" }),
              "Download pack"
            ),
          ],
        },
      ],
    });
  })
);

// create
router.post(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.body;
    const tag = await Tag.create({ name });
    req.flash("success", req.__(`Tag %s created`, name));
    res.redirect(`/tag/${tag.id}?show_list=tables`);
  })
);

// delete
router.post(
  "/delete/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const tag = await Tag.findOne({ id });
    if (!tag) {
      req.flash("error", req.__("Tag not found"));
      return res.redirect("/tag");
    }
    try {
      await tag.delete();
      req.flash("success", req.__("Tag %s deleted", tag.name));
      res.redirect(`/tag`);
    } catch (error) {
      req.flash("error", error.message);
      res.redirect(`/tag`);
    }
  })
);
