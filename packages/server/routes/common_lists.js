const User = require("@saltcorn/data/models/user");
const Table = require("@saltcorn/data/models/table");
const Tag = require("@saltcorn/data/models/tag");
const TagEntry = require("@saltcorn/data/models/tag_entry");
const { editRoleForm } = require("../markup/forms.js");
const {
  mkTable,
  link,
  post_delete_btn,
  settingsDropdown,
  post_dropdown_item,
  badge,
} = require("@saltcorn/markup");
const { get_base_url } = require("./utils.js");
const { h4, p, div, a, i, text, span, nbsp } = require("@saltcorn/markup/tags");

/**
 * @param {string} col
 * @param {string} lbl
 * @returns {string}
 */

/**
 * Table badges to show in System Table list views
 * Currently supports:
 * - Owned - if ownership_field_id? What is it?
 * - History - if table has versioning
 * - External - if this is external table
 * @param {object} t table object
 * @param {object} req http request
 * @returns {string} html string with list of badges
 */
const tableBadges = (t, req) => {
  let s = "";
  if (t.ownership_field_id) s += badge("primary", req.__("Owned"));
  if (t.versioned) s += badge("success", req.__("History"));
  if (t.external) s += badge("info", req.__("External"));
  if (t.provider_name) s += badge("success", t.provider_name);
  return s;
};

const valIfSet = (check, value) => (check ? value : "");

const listClass = (tagId, showList) =>
  valIfSet(tagId, `collapse ${valIfSet(showList, "show")}`);

const tablesList = async (tables, req, { tagId, domId, showList } = {}) => {
  const roles = await User.get_roles();
  const getRole = (rid) => roles.find((r) => r.id === rid)?.role || "?";
  const tags = await Tag.find();
  const tag_entries = await TagEntry.find({
    not: { table_id: null },
  });
  const tagsById = {};
  tags.forEach((t) => (tagsById[t.id] = t));

  const tagBadges = (table) => {
    const myTags = tag_entries.filter((te) => te.table_id === table.id);
    return myTags
      .map((te) => tagBadge(tagsById[te.tag_id]), "tables")
      .join(nbsp);
  };

  return tables.length > 0
    ? mkTable(
        [
          {
            label: req.__("Name"),
            key: (r) => link(`/table/${r.id || r.name}`, text(r.name)),
          },
          {
            label: "",
            key: (r) => tableBadges(r, req),
          },
          ...(tagId
            ? []
            : [
                {
                  label: tagsDropdown(tags),
                  key: (r) => tagBadges(r),
                },
              ]),
          {
            label: req.__("Access Read/Write"),
            key: (t) =>
              t.external
                ? `${getRole(t.min_role_read)} (read only)`
                : `${getRole(t.min_role_read)}/${getRole(t.min_role_write)}`,
          },
          !tagId
            ? {
                label: req.__("Delete"),
                key: (r) =>
                  r.name === "users" || r.external
                    ? ""
                    : post_delete_btn(`/table/delete/${r.id}`, req, r.name),
              }
            : {
                label: req.__("Remove From Tag"),
                key: (r) =>
                  post_delete_btn(
                    `/tag-entries/remove/tables/${r.id}/${tagId}`,
                    req,
                    `${r.name} from this tag`
                  ),
              },
        ],
        tables,
        {
          hover: true,
          tableClass: listClass(tagId, showList),
          tableId: domId,
        }
      )
    : div(
        { class: listClass(tagId, showList), id: domId },
        h4(req.__("No tables defined")),
        p(req.__("Tables hold collections of similar data"))
      );
};

/**
 * @param {object} view
 * @param {object[]} roles
 * @param {object} req
 * @returns {Form}
 */
const editViewRoleForm = (view, roles, req, on_done_redirect_str) =>
  editRoleForm({
    url: `/viewedit/setrole/${view.id}${on_done_redirect_str || ""}`,
    current_role: view.min_role,
    roles,
    req,
  });

/**
 * @param {object} view
 * @param {object} req
 * @returns {div}
 */
const view_dropdown = (view, req, on_done_redirect_str = "") =>
  settingsDropdown(`dropdownMenuButton${view.id}`, [
    a(
      {
        class: "dropdown-item",
        href: `/view/${encodeURIComponent(view.name)}`,
      },
      '<i class="fas fa-running"></i>&nbsp;' + req.__("Run")
    ),
    view.id &&
      a(
        {
          class: "dropdown-item",
          href: `/viewedit/edit/${encodeURIComponent(
            view.name
          )}${on_done_redirect_str}`,
        },
        '<i class="fas fa-edit"></i>&nbsp;' + req.__("Edit")
      ),
    post_dropdown_item(
      `/viewedit/add-to-menu/${encodeURIComponent(
        view.name
      )}${on_done_redirect_str}`,
      '<i class="fas fa-bars"></i>&nbsp;' + req.__("Add to menu"),
      req
    ),
    view.id &&
      post_dropdown_item(
        `/viewedit/clone/${view.id}${on_done_redirect_str}`,
        '<i class="far fa-copy"></i>&nbsp;' + req.__("Duplicate"),
        req
      ),
    view.id &&
      a(
        {
          class: "dropdown-item",
          href: `javascript:ajax_modal('/admin/snapshot-restore/view/${view.name}')`,
        },
        '<i class="fas fa-undo-alt"></i>&nbsp;' + req.__("Restore")
      ),
    view.id && div({ class: "dropdown-divider" }),
    view.id &&
      post_dropdown_item(
        `/viewedit/delete/${view.id}${on_done_redirect_str}`,
        '<i class="far fa-trash-alt"></i>&nbsp;' + req.__("Delete"),
        req,
        true,
        view.name
      ),
  ]);

const setTableRefs = async (views) => {
  const tables = await Table.find();
  const getTable = (tid) => tables.find((t) => t.id === tid).name;

  views.forEach((v) => {
    if (v.table_id) v.table = getTable(v.table_id);
    else if (v.exttable_name) v.table = v.exttable_name;
    else v.table = "";
  });
  return views;
};

const tagBadge = (tag, type) =>
  a(
    {
      href: `/tag/${tag.id}?show_list=${type}`,
      class: "badge badge-secondary",
    },
    tag.name
  );

const tagsDropdown = (tags) =>
  div(
    { class: "dropdown" },
    div(
      {
        class: "link-style",
        "data-boundary": "viewport",
        type: "button",
        id: "tagsselector",
        "data-bs-toggle": "dropdown",
        "aria-haspopup": "true",
        "aria-expanded": "false",
      },
      "Tags"
    ),
    div(
      {
        class: "dropdown-menu",
        "aria-labelledby": "tagsselector",
      },
      a(
        {
          class: "dropdown-item",
          // TODO check url why view for page, what do we need for page group
          href: `javascript:unset_state_field('_tag', this)`,
        },
        "All tags"
      ),
      tags.map((tag) =>
        a(
          {
            class: "dropdown-item",
            // TODO check url why view for page, what do we need for page group
            href: `javascript:set_state_field('_tag', ${tag.id}, this)`,
          },
          tag.name
        )
      ),
      a(
        {
          class: "dropdown-item",
          // TODO check url why view for page, what do we need for page group
          href: `tag`,
        },
        "Manage tags..."
      )
    )
  );

const viewsList = async (
  views,
  req,
  { tagId, domId, showList, on_done_redirect, notable } = {}
) => {
  const roles = await User.get_roles();
  const on_done_redirect_str = on_done_redirect
    ? `?on_done_redirect=${on_done_redirect}`
    : "";
  const tags = await Tag.find();
  const tag_entries = await TagEntry.find({
    not: { view_id: null },
  });
  const tagsById = {};
  tags.forEach((t) => (tagsById[t.id] = t));

  const tagBadges = (view) => {
    const myTags = tag_entries.filter((te) => te.view_id === view.id);
    return myTags
      .map((te) => tagBadge(tagsById[te.tag_id], "views"))
      .join(nbsp);
  };

  return views.length > 0
    ? mkTable(
        [
          {
            label: req.__("Name"),
            key: (r) => link(`/view/${encodeURIComponent(r.name)}`, r.name),
            sortlink: !tagId
              ? `set_state_field('_sortby', 'name', this)`
              : undefined,
          },
          ...(tagId
            ? []
            : [
                {
                  label: tagsDropdown(tags),
                  key: (r) => tagBadges(r),
                },
              ]),
          {
            label: req.__("Pattern"),
            key: "viewtemplate",
            sortlink: !tagId
              ? `set_state_field('_sortby', 'viewtemplate', this)`
              : undefined,
          },
          ...(notable
            ? []
            : [
                {
                  label: req.__("Table"),
                  key: (r) => link(`/table/${r.table}`, r.table),
                  sortlink: !tagId
                    ? `set_state_field('_sortby', 'table', this)`
                    : undefined,
                },
              ]),
          {
            label: req.__("Role to access"),
            key: (row) =>
              row.id
                ? editViewRoleForm(row, roles, req, on_done_redirect_str)
                : "admin",
          },
          {
            label: "",
            key: (r) =>
              r.id && r.viewtemplateObj?.configuration_workflow
                ? link(
                    `/viewedit/config/${encodeURIComponent(
                      r.name
                    )}${on_done_redirect_str}`,
                    req.__("Configure")
                  )
                : "",
          },
          !tagId
            ? {
                label: "",
                key: (r) => view_dropdown(r, req, on_done_redirect_str),
              }
            : {
                label: req.__("Remove From Tag"),
                key: (r) =>
                  post_delete_btn(
                    `/tag-entries/remove/views/${r.id}/${tagId}`,
                    req,
                    `${r.name} from this tag`
                  ),
              },
        ],
        views,
        {
          hover: true,
          tableClass: listClass(tagId, showList),
          tableId: domId,
        }
      )
    : div(
        { class: listClass(tagId, showList), id: domId },
        h4(req.__("No views defined")),
        p(req.__("Views define how table rows are displayed to the user"))
      );
};

const page_group_dropdown = (page_group, req) =>
  settingsDropdown(`groupDropdownMenuButton${page_group.id}`, [
    post_dropdown_item(
      `/page_groupedit/add-to-menu/${page_group.id}`,
      '<i class="fas fa-bars"></i>&nbsp;' + req.__("Add to menu"),
      req
    ),
    post_dropdown_item(
      `/page_groupedit/clone/${page_group.id}`,
      '<i class="far fa-copy"></i>&nbsp;' + req.__("Duplicate"),
      req
    ),
    a(
      {
        class: "dropdown-item",
        // TODO check url why view for page, what do we need for page group
        href: `javascript:ajax_modal('/admin/snapshot-restore/pagegroup/${page_group.name}')`,
      },
      '<i class="fas fa-undo-alt"></i>&nbsp;' + req.__("Restore")
    ),
    div({ class: "dropdown-divider" }),
    post_dropdown_item(
      `/page_groupedit/delete/${page_group.id}`,
      '<i class="far fa-trash-alt"></i>&nbsp;' + req.__("Delete"),
      req,
      true,
      page_group.name
    ),
  ]);

/**
 * @param {object} page
 * @param {object} req
 * @returns {string}
 */
const page_dropdown = (page, req) =>
  settingsDropdown(`dropdownMenuButton${page.id}`, [
    a(
      {
        class: "dropdown-item",
        href: `/page/${encodeURIComponent(page.name)}`,
      },
      '<i class="fas fa-running"></i>&nbsp;' + req.__("Run")
    ),
    a(
      {
        class: "dropdown-item",
        href: `/pageedit/edit-properties/${encodeURIComponent(page.name)}`,
      },
      '<i class="fas fa-edit"></i>&nbsp;' + req.__("Edit properties")
    ),
    post_dropdown_item(
      `/pageedit/add-to-menu/${page.id}`,
      '<i class="fas fa-bars"></i>&nbsp;' + req.__("Add to menu"),
      req
    ),
    post_dropdown_item(
      `/pageedit/clone/${page.id}`,
      '<i class="far fa-copy"></i>&nbsp;' + req.__("Duplicate"),
      req
    ),
    a(
      {
        class: "dropdown-item",
        href: `javascript:ajax_modal('/admin/snapshot-restore/page/${page.name}')`,
      },
      '<i class="fas fa-undo-alt"></i>&nbsp;' + req.__("Restore")
    ),
    div({ class: "dropdown-divider" }),
    post_dropdown_item(
      `/pageedit/delete/${page.id}`,
      '<i class="far fa-trash-alt"></i>&nbsp;' + req.__("Delete"),
      req,
      true,
      page.name
    ),
  ]);

/**
 * @param {object} page
 * @param {*} roles
 * @param {object} req
 * @returns {Form}
 */
const editPageRoleForm = (page, roles, req, isGroup) =>
  editRoleForm({
    url: `/${!isGroup ? "page" : "page_group"}edit/setrole/${page.id}`,
    current_role: page.min_role,
    roles,
    req,
  });

/**
 * @param {*} rows
 * @param {*} roles
 * @param {object} req
 * @returns {div}
 */
const getPageList = async (
  rows,
  roles,
  req,
  { tagId, domId, showList } = {}
) => {
  const tags = await Tag.find();
  const tag_entries = await TagEntry.find({
    not: { page_id: null },
  });
  const tagsById = {};
  tags.forEach((t) => (tagsById[t.id] = t));

  const tagBadges = (page) => {
    const myTags = tag_entries.filter((te) => te.page_id === page.id);
    return myTags
      .map((te) => tagBadge(tagsById[te.tag_id], "pages"))
      .join(nbsp);
  };
  return mkTable(
    [
      {
        label: req.__("Name"),
        key: (r) => link(`/page/${r.name}`, r.name),
      },
      ...(tagId
        ? []
        : [
            {
              label: tagsDropdown(tags),
              key: (r) => tagBadges(r),
            },
          ]),
      {
        label: req.__("Role to access"),
        key: (row) => editPageRoleForm(row, roles, req),
      },
      {
        label: req.__("Edit"),
        key: (r) => link(`/pageedit/edit/${r.name}`, req.__("Edit")),
      },
      !tagId
        ? {
            label: "",
            key: (r) => page_dropdown(r, req),
          }
        : {
            label: req.__("Remove From Tag"),
            key: (r) =>
              post_delete_btn(
                `/tag-entries/remove/pages/${r.id}/${tagId}`,
                req,
                `${r.name} from this tag`
              ),
          },
    ],
    rows,
    {
      hover: true,
      tableClass: tagId ? `collapse ${showList ? "show" : ""}` : "",
      tableId: domId,
    }
  );
};

/**
 * @param {*} rows
 * @param {*} roles
 * @param {*} req
 */
const getPageGroupList = (rows, roles, req) => {
  return mkTable(
    [
      {
        label: req.__("Name"),
        key: (r) => link(`/page/${r.name}`, r.name),
      },
      {
        label: req.__("Role to access"),
        key: (row) => editPageRoleForm(row, roles, req, true),
      },
      {
        label: req.__("Edit"),
        key: (r) => link(`/page_groupedit/${r.name}`, req.__("Edit")),
      },
      {
        label: "",
        key: (r) => page_group_dropdown(r, req),
      },
    ],
    rows,
    {
      hover: true,
    }
  );
};

const getTriggerList = async (
  triggers,
  req,
  { tagId, domId, showList } = {}
) => {
  const base_url = get_base_url(req);
  const tags = await Tag.find();

  const tag_entries = await TagEntry.find({
    not: { trigger_id: null },
  });
  const tagsById = {};
  tags.forEach((t) => (tagsById[t.id] = t));

  const tagBadges = (trigger) => {
    const myTags = tag_entries.filter((te) => te.trigger_id === trigger.id);
    return myTags
      .map((te) => tagBadge(tagsById[te.tag_id], "triggers"))
      .join(nbsp);
  };
  return mkTable(
    [
      { label: req.__("Name"), key: "name" },
      ...(tagId
        ? []
        : [
            {
              label: tagsDropdown(tags),
              key: (r) => tagBadges(r),
            },
          ]),
      { label: req.__("Action"), key: "action" },
      {
        label: req.__("Table or Channel"),
        key: (r) =>
          r.table_name
            ? a({ href: `/table/${r.table_name}` }, r.table_name)
            : r.channel,
      },
      {
        label: req.__("When"),
        key: (act) =>
          act.when_trigger +
          (act.when_trigger === "API call"
            ? a(
                {
                  href: `javascript:ajax_modal('/admin/help/API%20actions?name=${act.name}')`,
                },
                i({ class: "fas fa-question-circle ms-1" })
              )
            : ""),
      },
      {
        label: req.__("Test run"),
        key: (r) =>
          r.table_id
            ? ""
            : link(`/actions/testrun/${r.id}`, req.__("Test run")),
      },
      {
        label: req.__("Edit"),
        key: (r) => link(`/actions/edit/${r.id}`, req.__("Edit")),
      },
      {
        label: req.__("Configure"),
        key: (r) => link(`/actions/configure/${r.id}`, req.__("Configure")),
      },
      !tagId
        ? {
            label: req.__("Delete"),
            key: (r) => post_delete_btn(`/actions/delete/${r.id}`, req),
          }
        : {
            label: req.__("Remove From Tag"),
            key: (r) =>
              post_delete_btn(
                `/tag-entries/remove/trigger/${r.id}/${tagId}`,
                req,
                `${r.name} from this tag`
              ),
          },
    ],
    triggers,
    {
      hover: true,
      tableClass: tagId ? `collapse ${showList ? "show" : ""}` : "",
      tableId: domId,
    }
  );
};

module.exports = {
  tablesList,
  setTableRefs,
  viewsList,
  getPageList,
  getPageGroupList,
  getTriggerList,
};
