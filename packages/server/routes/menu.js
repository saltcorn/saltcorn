/**
 * Menu Editor
 * @category server
 * @module routes/menu
 * @subcategory routes
 */

const Router = require("express-promise-router");

//const Field = require("@saltcorn/data/models/field");
const Form = require("@saltcorn/data/models/form");
const { isAdmin, error_catcher } = require("./utils.js");
const { getState } = require("@saltcorn/data/db/state");
//const File = require("@saltcorn/data/models/file");
const User = require("@saltcorn/data/models/user");
const View = require("@saltcorn/data/models/view");
const Page = require("@saltcorn/data/models/page");
const { save_menu_items } = require("@saltcorn/data/models/config");
const db = require("@saltcorn/data/db");

const { renderForm } = require("@saltcorn/markup");
const { script, domReady, div, ul } = require("@saltcorn/markup/tags");
const { send_infoarch_page } = require("../markup/admin.js");
const Table = require("@saltcorn/data/models/table");
const Trigger = require("@saltcorn/data/models/trigger");
const { run_action_column } = require("@saltcorn/data/plugin-helper");

/**
 * @type {object}
 * @const
 * @namespace menuRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

/**
 * Menu Form
 * @param {object} req
 * @returns {Promise<Form>}
 */
const menuForm = async (req) => {
  const views = await View.find({}, { orderBy: "name", nocase: true });
  const pages = await Page.find({}, { orderBy: "name", nocase: true });
  const roles = await User.get_roles();
  const tables = await Table.find({});
  const dynTableOptions = tables.map((t) => t.name);
  const dynOrderFieldOptions = {},
    dynSectionFieldOptions = {};
  for (const table of tables) {
    dynOrderFieldOptions[table.name] = [""];
    dynSectionFieldOptions[table.name] = [""];
    const fields = await table.getFields();
    for (const field of fields) {
      dynOrderFieldOptions[table.name].push(field.name);
      if (
        field.type &&
        field.type.name === "String" &&
        field.attributes &&
        field.attributes.options
      )
        dynSectionFieldOptions[table.name].push(field.name);
    }
  }
  const stateActions = getState().actions;
  const actions = [
    ...Object.entries(stateActions)
      .filter(([k, v]) => !v.requireRow && !v.disableInBuilder)
      .map(([k, v]) => k),
  ];
  const triggers = await Trigger.find({
    when_trigger: { or: ["API call", "Never"] },
  });
  triggers.forEach((tr) => {
    actions.push(tr.name);
  });

  return new Form({
    action: "/menu/",
    submitLabel: req.__("Save"),
    id: "menuForm",
    labelCols: 3,
    noSubmitButton: true,
    additionalButtons: [
      { label: "Update", id: "btnUpdate", class: "btn btn-primary" },
      { label: "Add", id: "btnAdd", class: "btn btn-primary" },
      {
        label: "Recalculate dynamic",
        id: "btnRecalc",
        class: "btn btn-primary",
      },
    ],
    fields: [
      {
        name: "type",
        label: req.__("Type"),
        input_type: "select",
        class: "menutype item-menu",
        required: true,
        options: [
          "View",
          "Page",
          "Link",
          "Header",
          "Dynamic",
          "Search",
          "Separator",
          "Action",
        ],
      },
      {
        name: "text",
        label: req.__("Text label"),
        class: "item-menu",
        input_type: "text",
        required: true,
        showIf: {
          type: [
            "View",
            "Page",
            "Link",
            "Header",
            "Dynamic",
            "Search",
            "Action",
          ],
        },
      },
      {
        name: "icon_btn",
        label: req.__("Icon"),
        input_type: "custom_html",
        attributes: {
          html: `<button type="button" id="myEditor_icon" class="btn btn-outline-secondary"></button>`,
        },
        showIf: { type: ["View", "Page", "Link", "Header", "Action"] },
      },
      {
        name: "icon",
        class: "item-menu",
        input_type: "hidden",
      },
      {
        name: "min_role",
        label: req.__("Minimum role"),
        class: "item-menu",
        input_type: "select",
        options: roles.map((r) => ({ label: r.role, value: r.id })),
      },
      {
        name: "url",
        label: req.__("URL"),
        class: "item-menu",
        input_type: "text",
        showIf: { type: "Link" },
      },
      {
        name: "pagename",
        label: req.__("Page"),
        input_type: "select",
        class: "item-menu",
        options: pages.map((r) => r.name),
        showIf: { type: "Page" },
      },
      {
        name: "viewname",
        label: req.__("Views"),
        type: "String",
        class: "item-menu",
        required: true,
        attributes: { options: views.map((r) => r.select_option) },
        showIf: { type: "View" },
      },
      {
        name: "action_name",
        label: req.__("Action"),
        type: "String",
        class: "item-menu",
        required: true,
        attributes: {
          options: actions,
        },
        showIf: { type: "Action" },
      },
      {
        name: "dyn_table",
        label: req.__("Table"),
        class: "item-menu",
        type: "String",
        attributes: {
          options: dynTableOptions,
        },
        required: true,
        showIf: { type: "Dynamic" },
      },
      {
        name: "dyn_order",
        label: req.__("Order field"),
        class: "item-menu",
        type: "String",
        attributes: {
          calcOptions: ["dyn_table", dynOrderFieldOptions],
        },
        showIf: { type: "Dynamic" },
      },
      {
        name: "dyn_section_field",
        label: req.__("Section field"),
        class: "item-menu",
        type: "String",
        attributes: {
          calcOptions: ["dyn_table", dynSectionFieldOptions],
        },
        sublabel: req.__(
          "Optional. String type with options, each of which will become a menu section"
        ),
        showIf: { type: "Dynamic" },
      },
      {
        name: "dyn_label_fml",
        label: req.__("Label formula"),
        class: "item-menu",
        type: "String",
        required: true,
        showIf: { type: "Dynamic" },
      },
      {
        name: "dyn_url_fml",
        label: req.__("URL formula"),
        class: "item-menu",
        type: "String",
        required: true,
        showIf: { type: "Dynamic" },
      },
      {
        name: "dyn_include_fml",
        label: req.__("Include formula"),
        sublabel: req.__(
          "If specified, only include in menu rows that evaluate to true"
        ),
        class: "item-menu",
        type: "String",
        required: true,
        showIf: { type: "Dynamic" },
      },
      {
        name: "style",
        label: req.__("Style"),
        sublabel: req.__("Not all themes support menu buttons"),
        class: "item-menu",
        type: "String",
        required: true,
        showIf: {
          type: ["View", "Page", "Link", "Header", "Dynamic", "Action"],
        },
        attributes: {
          options: [
            { name: "", label: "Link" },
            { name: "btn btn-primary", label: "Primary button" },
            { name: "btn btn-secondary", label: "Secondary button" },
            { name: "btn btn-success", label: "Success button" },
            { name: "btn btn-danger", label: "Danger button" },
            {
              name: "btn btn-outline-primary",
              label: "Primary outline button",
            },
            {
              name: "btn btn-outline-secondary",
              label: "Secondary outline button",
            },
          ],
        },
      },
      {
        name: "location",
        label: req.__("Location"),
        showIf: {
          type: ["View", "Page", "Link", "Header", "Dynamic", "Action"],
        },
        sublabel: req.__("Not all themes support all locations"),
        class: "item-menu",
        type: "String",
        //fieldview: "radio_group",
        required: true,
        //default: "Standard",
        attributes: {
          inline: true,
          options: "Standard, Mobile Bottom",
        },
      },
    ],
  });
};

//create -- new

/**
 * Menu Editor Script
 * @param {object[]} menu_items
 * @returns {string}
 */
// todo move to file the content of menuEditorScript
const menuEditorScript = (menu_items) => `
  var iconPickerOptions = {searchText: "Search icon...", labelHeader: "{0}/{1}"};
  let lastState;
  let editor;  
  function ajax_save_menu(skip_check) {
    const s = editor.getString()    
    if(s===lastState && !skip_check) return;
    lastState=s;
    ajax_indicator(true);
    ajax_post('/menu', {
      data: s, 
      success: ()=>{ ajax_indicator(false)}, 
      dataType : 'json', 
      contentType: 'application/json;charset=UTF-8',
      error: (r) => {ajax_indicate_error(undefined, r); }
    })
  }
  var sortableListOptions = {
      placeholderCss: {'background-color': "#cccccc"},
      onChange: ajax_save_menu
  };
  editor = new MenuEditor('myEditor', 
              { 
              listOptions: sortableListOptions, 
              iconPicker: iconPickerOptions,
              getLabelText: (item) => item?.text || item?.type,
              labelEdit: 'Edit&nbsp;<i class="fas fa-edit clickable"></i>',
              maxLevel: 1 // (Optional) Default is -1 (no level limit)
              // Valid levels are from [0, 1, 2, 3,...N]
              });
  editor.setForm($('#menuForm'));
  editor.setUpdateButton($('#btnUpdate'));
  editor.setData(${JSON.stringify(menu_items)});
  //Calling the update method

  $("#btnUpdate").click(function(){
      editor.update();
      ajax_save_menu();
  });
  $("#btnRecalc").click(function(){
    editor.update();
    ajax_save_menu(true);
    location.reload();
  });
  // Calling the add method
  $('#btnAdd').click(function(){
      editor.add();
      ajax_save_menu();
  });
  lastState=editor.getString()
  setInterval(ajax_save_menu, 500)
  `;

/**
 * @param {object[]} menu_items
 * @returns {object[]}
 */
const menuTojQME = (menu_items) =>
  (menu_items || []).map((mi) => ({
    ...mi,
    text: mi.label,
    subitems: undefined,
    ...(mi.subitems ? { children: menuTojQME(mi.subitems) } : {}),
  }));

/**
 * @name get
 * @function
 * @memberof module:routes/menu~menuRouter
 * @function
 */
router.get(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await menuForm(req);
    const state = getState();
    const menu_items = menuTojQME(state.getConfig("menu_items"));
    const static_pre = `/static_assets/${db.connectObj.version_tag}`;
    send_infoarch_page({
      res,
      req,
      active_sub: "Menu",
      headers: [
        {
          script: static_pre + "/jquery-menu-editor.min.js",
        },
        {
          script: static_pre + "/iconset-fontawesome5-3-1.min.js",
        },
        {
          script: static_pre + "/bootstrap-iconpicker.js",
        },
        {
          css: static_pre + "/bootstrap-iconpicker.min.css",
        },
      ],
      contents: {
        type: "card",
        title: req.__(`Menu editor`),
        titleAjaxIndicator: true,
        contents: {
          above: [
            {
              besides: [
                div(ul({ id: "myEditor", class: "sortableLists list-group" })),
                div(
                  renderForm(form, req.csrfToken()),
                  script(domReady(menuEditorScript(menu_items)))
                ),
              ],
            },
          ],
        },
      },
    });
  })
);
/**
 * jQME to Menu
 * @param {object[]} menu_items
 * @returns {object[]}
 */
const jQMEtoMenu = (menu_items) =>
  menu_items.map((mi) => ({
    ...mi,
    label: mi.text,
    children: undefined,
    ...(mi.children ? { subitems: jQMEtoMenu(mi.children) } : {}),
  }));

/**
 * @name post
 * @function
 * @memberof module:routes/menu~menuRouter
 * @function
 */
router.post(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    const new_menu = req.body;
    const menu_items = jQMEtoMenu(new_menu);
    await save_menu_items(menu_items);

    res.json({ success: true });
  })
);

router.post(
  "/runaction/:name",
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const role = (req.user || {}).role_id || 10;
    const state = getState();
    const menu_items = state.getConfig("menu_items");
    let menu_item;
    const search = (items) =>
      items
        .filter((item) => role <= +item.min_role)
        .forEach((item) => {
          if (item.type === "Action" && item.action_name === name)
            menu_item = item;
          else if (item.subitems) search(item.subitems);
        });
    search(menu_items);
    if (menu_item)
      try {
        const result = await run_action_column({
          col: menu_item,
          referrer: req.get("Referrer"),
          req,
          res,
        });
        res.json({ success: "ok", ...(result || {}) });
      } catch (e) {
        res.status(400).json({ error: e.message || e });
      }
    else res.status(404).json({ error: "Action not found" });
  })
);
