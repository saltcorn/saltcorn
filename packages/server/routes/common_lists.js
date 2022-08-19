const User = require("@saltcorn/data/models/user");
const Table = require("@saltcorn/data/models/table");
const { editRoleForm } = require("../markup/forms.js");
const {
  mkTable,
  link,
  post_delete_btn,
  settingsDropdown,
  post_dropdown_item,
} = require("@saltcorn/markup");

const { h4, p, div, a, input, text } = require("@saltcorn/markup/tags");

/**
 * @param {string} col
 * @param {string} lbl
 * @returns {string}
 */
const badge = (col, lbl) => `<span class="badge bg-${col}">${lbl}</span>&nbsp;`;

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
  return s;
};

const valIfSet = (check, value) => (check ? value : "");

const listClass = (tagId, showList) =>
  valIfSet(tagId, `collapse ${valIfSet(showList, "show")}`);

const tablesList = async (tables, req, { tagId, domId, showList } = {}) => {
  const roles = await User.get_roles();
  const getRole = (rid) => roles.find((r) => r.id === rid).role;
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
const editViewRoleForm = (view, roles, req) =>
  editRoleForm({
    url: `/viewedit/setrole/${view.id}`,
    current_role: view.min_role,
    roles,
    req,
  });

/**
 * @param {object} view
 * @param {object} req
 * @returns {div}
 */
const view_dropdown = (view, req) =>
  settingsDropdown(`dropdownMenuButton${view.id}`, [
    a(
      {
        class: "dropdown-item",
        href: `/view/${encodeURIComponent(view.name)}`,
      },
      '<i class="fas fa-running"></i>&nbsp;' + req.__("Run")
    ),
    a(
      {
        class: "dropdown-item",
        href: `/viewedit/edit/${encodeURIComponent(view.name)}`,
      },
      '<i class="fas fa-edit"></i>&nbsp;' + req.__("Edit")
    ),
    post_dropdown_item(
      `/viewedit/add-to-menu/${view.id}`,
      '<i class="fas fa-bars"></i>&nbsp;' + req.__("Add to menu"),
      req
    ),
    post_dropdown_item(
      `/viewedit/clone/${view.id}`,
      '<i class="far fa-copy"></i>&nbsp;' + req.__("Duplicate"),
      req
    ),
    a(
      {
        class: "dropdown-item",
        href: `javascript:ajax_modal('/admin/snapshot-restore/view/${view.name}')`,
      },
      '<i class="fas fa-undo-alt"></i>&nbsp;' + req.__("Restore")
    ),
    div({ class: "dropdown-divider" }),
    post_dropdown_item(
      `/viewedit/delete/${view.id}`,
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

const viewsList = async (views, req, { tagId, domId, showList } = {}) => {
  const roles = await User.get_roles();

  return views.length > 0
    ? mkTable(
        [
          {
            label: req.__("Name"),
            key: (r) => link(`/view/${encodeURIComponent(r.name)}`, r.name),
            sortlink: !tagId
              ? `javascript:set_state_field('_sortby', 'name')`
              : undefined,
          },
          // description - currently I dont want to show description in view list
          // because description can be long
          /*
         {
             label: req.__("Description"),
             key: "description",
             // this is sorting by column
             sortlink: `javascript:set_state_field('_sortby', 'description')`,
         },
         */
          // template
          {
            label: req.__("Pattern"),
            key: "viewtemplate",
            sortlink: !tagId
              ? `javascript:set_state_field('_sortby', 'viewtemplate')`
              : undefined,
          },
          {
            label: req.__("Table"),
            key: (r) => link(`/table/${r.table}`, r.table),
            sortlink: !tagId
              ? `javascript:set_state_field('_sortby', 'table')`
              : undefined,
          },
          {
            label: req.__("Role to access"),
            key: (row) => editViewRoleForm(row, roles, req),
          },
          {
            label: "",
            key: (r) =>
              link(
                `/viewedit/config/${encodeURIComponent(r.name)}`,
                req.__("Configure")
              ),
          },
          !tagId
            ? {
                label: "",
                key: (r) => view_dropdown(r, req),
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
const editPageRoleForm = (page, roles, req) =>
  editRoleForm({
    url: `/pageedit/setrole/${page.id}`,
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
const getPageList = (rows, roles, req, { tagId, domId, showList } = {}) => {
  return mkTable(
    [
      {
        label: req.__("Name"),
        key: (r) => link(`/page/${r.name}`, r.name),
      },
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
      ,
    ],
    rows,
    {
      hover: true,
      tableClass: tagId ? `collapse ${showList ? "show" : ""}` : "",
      tableId: domId,
    }
  );
};

const getTriggerList = (triggers, req, { tagId, domId, showList } = {}) => {
  return mkTable(
    [
      { label: req.__("Name"), key: "name" },
      { label: req.__("Action"), key: "action" },
      {
        label: req.__("Table or Channel"),
        key: (r) => r.table_name || r.channel,
      },
      {
        label: req.__("When"),
        key: (a) =>
          a.when_trigger === "API call"
            ? `API: ${base_url}api/action/${a.name}`
            : a.when_trigger,
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
  getTriggerList,
};
