import { a, text, i, div } from "@saltcorn/markup/tags";

import Tag from "@saltcorn/data/models/tag";
import TagEntry from "@saltcorn/data/models/tag_entry";
import Router from "express-promise-router";
import Form from "@saltcorn/data/models/form";
import User from "@saltcorn/data/models/user";
import stream from "stream";

import { isAdmin, error_catcher, csrfField } from "./utils.js";
import { send_infoarch_page } from "../markup/admin.js";

import { mkTable, post_delete_btn, link, renderForm } from "@saltcorn/markup";

import {
  tablesList,
  setTableRefs,
  viewsList,
  getPageList,
  getTriggerList,
} from "./common_lists.js";

import db from "@saltcorn/data/db";
import { getState } from "@saltcorn/data/db/state";
import _am_pack from "@saltcorn/admin-models/models/pack";
const { create_pack_from_tag } = _am_pack;
import Table from "@saltcorn/data/models/table";
import { Req, Res } from "@saltcorn/types/base_types";

const router = Router();
export default router;

router.get(
  "/",
  isAdmin,
  error_catcher(async (req: Req, res: Res) => {
    const rows = (await Tag.find())!;
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
                key: (r: any) =>
                  link(`/tag/${r.id || r.name}?show_list=tables`, text(r.name)),
              },
              {
                label: req.__("Delete"),
                key: (r: any) =>
                  post_delete_btn(`/tag/delete/${r.id}`, req, r.name),
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
  error_catcher(async (req: Req, res: Res) => {
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
  error_catcher(async (req: Req, res: Res) => {
    const { idorname } = req.params;
    const id = parseInt(idorname);
    const tag = (await Tag.findOne(id ? { id } : { name: idorname }))!;
    if (!tag) {
      req.flash("error", req.__("Tag not found"));
      return res.redirect(`/tag`);
    }
    const pack = await create_pack_from_tag(tag);
    const readStream = new stream.PassThrough();
    readStream.end(JSON.stringify(pack));
    res.type("application/json");
    res.attachment(`${tag.name}-pack.json`);
    readStream.pipe(res as any);
  })
);

const headerWithCollapser = (
  title: string,
  cardId: string,
  showList: boolean,
  count: number
) =>
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

const isShowList = (showList: string | string[], listType: string) =>
  showList === listType;

router.get(
  "/:idorname",
  isAdmin,
  error_catcher(async (req: Req, res: Res) => {
    const { idorname } = req.params;
    const { show_list } = req.query;
    const id = parseInt(idorname);
    const tag = (await Tag.findOne(id ? { id } : { name: idorname }))!;
    if (!tag) {
      req.flash("error", req.__("Tag not found"));
      return res.redirect(`/tag`);
    }
    const tables = await tag.getTables();
    const views = await tag.getViews();
    await setTableRefs(views);
    const pages = await tag.getPages();
    const triggers = await tag.getTriggers();
    triggers.forEach((tr: any) => {
      if (tr.table_id) tr.table_name = Table.findOne(tr.table_id)!?.name;
    });
    const roles = await User.get_roles();

    const tablesDomId = "tablesListId";
    const viewsDomId = "viewsListId";
    const pagesDomId = "pagesDomId";
    const triggersDomId = "triggerDomId";
    const function_code_pages_tags = getState()!.getConfigCopy(
      "function_code_pages_tags",
      {}
    );
    const code_pages = Object.entries(function_code_pages_tags)
      .filter(([nm, tags]: any) => (tags as string[] || []).includes(tag.name))
      .map(([nm, tags]: any) => nm);
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
            isShowList(show_list as string, "tables"),
            tables.length
          ),
          contents: [
            await tablesList(tables, req, {
              tagId: tag.id,
              domId: tablesDomId,
              showList: isShowList(show_list as string, "tables"),
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
            isShowList(show_list as string, "views"),
            views.length
          ),
          contents: [
            await viewsList(views, req, {
              tagId: tag.id,
              domId: viewsDomId,
              showList: isShowList(show_list as string, "views"),
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
            isShowList(show_list as string, "pages"),
            pages.length
          ),
          contents: [
            await getPageList(pages, roles, req, {
              tagId: tag.id,
              domId: pagesDomId,
              showList: isShowList(show_list as string, "pages"),
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
            isShowList(show_list as string, "triggers"),
            triggers.length
          ),
          contents: [
            await getTriggerList(triggers, req, {
              tagId: tag.id,
              domId: triggersDomId,
              showList: isShowList(show_list as string, "triggers"),
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
          title: req.__("Code pages") + ` (${code_pages.length})`,
          contents: code_pages.map((cp: any) =>
            a(
              {
                class: "me-2",
                href: `/admin/edit-codepage/${encodeURIComponent(cp)}`,
              },
              cp
            )
          ),
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
  error_catcher(async (req: Req, res: Res) => {
    const { name } = req.body || {};
    const tag = await Tag.create({ name });
    req.flash("success", req.__(`Tag %s created`, name));
    res.redirect(`/tag/${tag.id}?show_list=tables`);
  })
);

// delete
router.post(
  "/delete/:id",
  isAdmin,
  error_catcher(async (req: Req, res: Res) => {
    const { id } = req.params;
    const tag = (await Tag.findOne({ id }))!;
    if (!tag) {
      req.flash("error", req.__("Tag not found"));
      return res.redirect("/tag");
    }
    try {
      await tag.delete();
      req.flash("success", req.__("Tag %s deleted", tag.name));
      res.redirect(`/tag`);
    } catch (error: any) {
      req.flash("error", error.message);
      res.redirect(`/tag`);
    }
  })
);
