/**
 * Menu Editor
 * @category server
 * @module routes/menu
 * @subcategory routes
 */

const Router = require("express-promise-router");

//const Field = require("@saltcorn/data/models/field");
const Form = require("@saltcorn/data/models/form");
const {
  isAdmin,
  error_catcher,
  isAdminOrHasConfigMinRole,
} = require("./utils.js");
const { getState } = require("@saltcorn/data/db/state");
//const File = require("@saltcorn/data/models/file");
const User = require("@saltcorn/data/models/user");
const View = require("@saltcorn/data/models/view");
const Page = require("@saltcorn/data/models/page");
const PageGroup = require("@saltcorn/data/models/page_group");
const { save_menu_items } = require("@saltcorn/data/models/config");
const db = require("@saltcorn/data/db");

const { renderForm } = require("@saltcorn/markup");
const {
  script,
  domReady,
  div,
  ul,
  i,
  style,
} = require("@saltcorn/markup/tags");
const { send_infoarch_page } = require("../markup/admin.js");
const Table = require("@saltcorn/data/models/table");
const Trigger = require("@saltcorn/data/models/trigger");
const { run_action_column } = require("@saltcorn/data/plugin-helper");
const path = require("path");

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
  const pageGroups = await PageGroup.find(
    {},
    { orderBy: "name", nocase: true }
  );
  const roles = await User.get_roles();
  const tables = await Table.find_with_external({});
  const dynTableOptions = tables.map((t) => t.name);
  const dynOrderFieldOptions = {},
    dynSectionFieldOptions = {};
  for (const table of tables) {
    dynOrderFieldOptions[table.name] = [""];
    dynSectionFieldOptions[table.name] = [""];
    const fields = table.getFields();
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
  const triggers = Trigger.find({
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
      { label: req.__("Update"), id: "btnUpdate", class: "btn btn-primary" },
      { label: req.__("Add"), id: "btnAdd", class: "btn btn-primary" },
      {
        label: req.__("Recalculate dynamic"),
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
          "Page Group",
          "Admin Page",
          "User Page",
          "Link",
          "Header",
          "Dynamic",
          "Search",
          "Separator",
          "Action",
        ],
      },
      {
        name: "url",
        label: req.__("URL"),
        class: "item-menu validate-expression validate-expression-conditional",
        input_type: "text",
        showIf: { type: "Link" },
      },
      {
        name: "url_formula",
        label: req.__("URL is a formula?"),
        type: "Bool",
        class: "item-menu",
        required: false,
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
        name: "admin_page",
        label: req.__("Admin Page"),
        input_type: "select",
        class: "item-menu",
        options: [
          "Tables",
          "Views",
          "Pages",
          "Entities",
          "About application",
          "Modules",
          "Users and security",
          "Site structure",
          "Files",
          "Events",
          "Settings",
        ],
        showIf: { type: "Admin Page" },
      },
      {
        name: "user_page",
        label: req.__("User Page"),
        input_type: "select",
        class: "item-menu",
        options: [
          "Notifications",
          "User settings",
          "Login",
          "Logout",
          "Signup",
        ],
        showIf: { type: "User Page" },
      },
      {
        name: "viewname",
        label: req.__("View"),
        type: "String",
        class: "item-menu",
        required: true,
        attributes: { options: views.map((r) => r.select_option) },
        showIf: { type: "View" },
      },
      {
        name: "page_group",
        label: req.__("Page group"),
        input_type: "select",
        class: "item-menu",
        options: pageGroups.map((r) => r.name),
        showIf: { type: "Page Group" },
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
        name: "dyn_tooltip_fml",
        label: req.__("Tooltip formula"),
        class: "item-menu",
        type: "String",
        required: false,
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
        name: "user_menu_header",
        label: req.__("User menu header"),
        sublabel: req.__("Some themes display this header differently"),
        type: "Bool",
        class: "item-menu",
        required: false,
        default: false,
        showIf: { type: "Header" },
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
            "Page Group",
            "Link",
            "Header",
            "Dynamic",
            "Search",
            "Action",
            "Admin Page",
            "User Page",
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
        showIf: {
          type: [
            "View",
            "Page",
            "Page Group",
            "Link",
            "Header",
            "Action",
            "Admin Page",
            "User Page",
          ],
        },
      },
      {
        name: "icon",
        class: "item-menu",
        input_type: "hidden",
        showIf: {
          type: [
            "View",
            "Page",
            "Page Group",
            "Link",
            "Header",
            "Action",
            "Admin Page",
            "User Page",
          ],
        },
      },
      {
        name: "tooltip",
        label: req.__("Tooltip"),
        class: "item-menu",
        input_type: "text",
        required: false,
        showIf: {
          type: [
            "View",
            "Page",
            "Page Group",
            "Link",
            "Header",
            "Dynamic",
            "Search",
            "Action",
            "Admin Page",
            "User Page",
          ],
        },
      },
      {
        name: "min_role",
        label: req.__("Minimum role"),
        class: "item-menu",
        input_type: "select",
        options: roles.map((r) => ({ label: r.role, value: r.id })),
      },
      {
        name: "max_role",
        label: req.__("Maximum role"),
        class: "item-menu",
        input_type: "select",
        options: roles.map((r) => ({ label: r.role, value: r.id })),
      },
      {
        name: "showif",
        label: req.__("Show if"),
        class: "item-menu validate-expression",
        type: "String",
        sublabel: req.__(
          "Optional expression. Show only if true. In scope: <code>user</code>, <code>url</code>, <code>query</code>"
        ),
      },
      {
        name: "disable_on_mobile",
        label: req.__("Disable on mobile"),
        type: "Bool",
        class: "item-menu",
        required: false,
        default: false,
      },
      {
        name: "mobile_item_html",
        label: req.__("Mobile HTML"),
        sublabel: req.__(
          "HTML for the item in the bottom navigation bar. Currently, only supported by the metronic theme."
        ),
        type: "String",
        class: "item-menu",
        input_type: "textarea",
        showIf: { disable_on_mobile: false, location: "Mobile Bottom" },
      },
      {
        name: "target_blank",
        label: req.__("Open in new tab"),
        type: "Bool",
        required: false,
        class: "item-menu",
        showIf: {
          type: [
            "View",
            "Page",
            "Page Group",
            "Link",
            "Admin Page",
            "User Page",
          ],
        },
      },
      {
        name: "in_modal",
        label: req.__("Open in popup modal?"),
        type: "Bool",
        required: false,
        class: "item-menu",
        showIf: {
          type: [
            "View",
            "Page",
            "Page Group",
            "Link",
            "Admin Page",
            "User Page",
          ],
        },
      },
      {
        name: "style",
        label: req.__("Style"),
        sublabel: req.__("Not all themes support menu buttons"),
        class: "item-menu",
        type: "String",
        required: true,
        showIf: {
          type: [
            "View",
            "Page",
            "Page Group",
            "Link",
            "Header",
            "Dynamic",
            "Action",
            "Admin Page",
            "User Page",
          ],
        },
        attributes: {
          options: [
            { name: "", label: req.__("Link") },
            { name: "btn btn-primary", label: req.__("Primary button") },
            { name: "btn btn-secondary", label: req.__("Secondary button") },
            { name: "btn btn-success", label: req.__("Success button") },
            { name: "btn btn-danger", label: req.__("Danger button") },
            {
              name: "btn btn-outline-primary",
              label: req.__("Primary outline button"),
            },
            {
              name: "btn btn-outline-secondary",
              label: req.__("Secondary outline button"),
            },
          ],
        },
      },
      {
        name: "shortcut",
        label: req.__("Keyboard shortcut"),
        sublabel: req.__(
          "e.g. Alt+k or Ctrl+Alt+k. Modifier keys: Alt, Ctrl, Shift, Meta"
        ),
        class: "item-menu",
        input_type: "text",
        required: false,
        showIf: {
          type: [
            "View",
            "Page",
            "Page Group",
            "Link",
            "Action",
            "Admin Page",
            "User Page",
            "Search",
          ],
        },
      },
      {
        name: "location",
        label: req.__("Location"),
        showIf: {
          type: [
            "View",
            "Page",
            "Page Group",
            "Link",
            "Header",
            "Dynamic",
            "Search",
            "Separator",
            "Action",
            "Admin Page",
            "User Page",
          ],
        },
        sublabel: req.__("Not all themes support all locations"),
        class: "item-menu",
        type: "String",
        //fieldview: "radio_group",
        required: true,
        //default: "Standard",
        attributes: {
          inline: true,
          options: ["Standard", "Mobile Bottom", "Secondary Menu"],
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
              maxLevel: 2 // (Optional) Default is -1 (no level limit)
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

  // Keyboard shortcut validation
  var modifierKeys = ["Alt", "Ctrl", "Shift", "Meta"];
  var validKeys = [
    "a","b","c","d","e","f","g","h","i","j","k","l","m",
    "n","o","p","q","r","s","t","u","v","w","x","y","z",
    "0","1","2","3","4","5","6","7","8","9",
    "F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12",
    "Enter","Tab","Escape","Backspace","Delete","Insert",
    "Home","End","PageUp","PageDown",
    "ArrowUp","ArrowDown","ArrowLeft","ArrowRight",
    " ","-","=","[","]","\\\\",";","'",",",".","/","\`"
  ];
  var reservedShortcuts = [
    "Ctrl+c", "Ctrl+v", "Ctrl+x", "Ctrl+z", "Ctrl+y", "Ctrl+a",
    "Ctrl+s", "Ctrl+p", "Ctrl+t", "Ctrl+w", "Ctrl+n", "Ctrl+f",
    "Ctrl+h", "Ctrl+l", "Ctrl+d", "Ctrl+r", "Ctrl+o", "Ctrl+g",
    "Ctrl+j", "Ctrl+k", "Ctrl+u", "Ctrl+e", "Ctrl+Shift+p",
    "Ctrl+Shift+i", "Ctrl+Shift+j", "Ctrl+Shift+c", "Ctrl+Shift+t",
    "Ctrl+Shift+n", "Ctrl+Shift+Delete",
    "F1", "F3", "F5", "F7", "F11", "F12"
  ];
  var normalizeShortcut = function(s) {
    return s.split("+").map(function(p) { return p.trim().toLowerCase(); }).join("+");
  };
  var reservedSet = reservedShortcuts.map(normalizeShortcut);

  function validateShortcut(val) {
    if (!val) return null;
    var parts = val.split("+").map(function(p) { return p.trim(); });
    if (parts.length === 0 || parts.some(function(p) { return p === ""; })) {
      return "Invalid format. Use Modifier+Key, e.g. Alt+k";
    }
    var mods = [];
    var key = null;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (modifierKeys.indexOf(p) >= 0) {
        if (mods.indexOf(p) >= 0) return "Duplicate modifier: " + p;
        mods.push(p);
      } else if (key !== null) {
        return "Only one non-modifier key allowed, got: " + key + " and " + p;
      } else {
        key = p;
      }
    }
    if (key === null) return "A non-modifier key is required";
    if (mods.length === 0) {
      if (validKeys.indexOf(key) >= 0 && key.length === 1)
        return "Single character keys require at least one modifier (Alt, Ctrl, Shift, or Meta)";
    }
    if (validKeys.indexOf(key) < 0)
      return "Unknown key: " + key + ". Use a letter (a-z), digit (0-9), F1-F12, or a named key like Enter, Escape, etc.";
    return null;
  }

  var $shortcutInput = $('input[name="shortcut"]');
  var $shortcutMsg = $('<div class="small mt-1" style="display:none"></div>');
  $shortcutInput.after($shortcutMsg);
  $shortcutInput.on('input', function() {
    var val = $(this).val().trim();
    if (!val) { $shortcutMsg.hide(); return; }
    var error = validateShortcut(val);
    if (error) {
      $shortcutMsg.removeClass('text-warning').addClass('text-danger').text(error).show();
      return;
    }
    var norm = normalizeShortcut(val);
    if (reservedSet.indexOf(norm) >= 0) {
      $shortcutMsg.removeClass('text-danger').addClass('text-warning').text('Warning: this shortcut conflicts with a common browser shortcut and may not work.').show();
    } else {
      $shortcutMsg.hide();
    }
  });
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
  isAdminOrHasConfigMinRole("min_role_edit_menu"),
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
          script: "/menu/icon-options?format=bootstrap-iconpicker",
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
                div(
                  ul({ id: "myEditor", class: "sortableLists list-group" }),
                  div(
                    i(
                      req.__(
                        "Some themes support only one level of menu nesting."
                      )
                    )
                  )
                ),
                div(
                  renderForm(form, req.csrfToken()),
                  script(domReady(menuEditorScript(menu_items))),
                  style(setIconStyle())
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
  isAdminOrHasConfigMinRole("min_role_edit_menu"),
  error_catcher(async (req, res) => {
    const new_menu = req.body || {};
    const menu_items = jQMEtoMenu(new_menu);
    await save_menu_items(menu_items);
    Trigger.emitEvent("AppChange", `Menu`, req.user, {});

    res.json({ success: true });
  })
);

router.post(
  "/runaction/:name",
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const role = (req.user || {}).role_id || 100;
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
    if (menu_item) {
      try {
        const result = await db.withTransaction(async () => {
          return await run_action_column({
            col: menu_item,
            referrer: req.get("Referrer"),
            req,
            res,
          });
        });
        res.json({ success: "ok", ...(result || {}) });
      } catch (e) {
        console.error(e);
        res.status(400).json({ error: e.message || e });
      }
    } else res.status(404).json({ error: "Action not found" });
  })
);

router.post(
  "/action/:rndid",
  error_catcher(async (req, res, next) => {
    const state = getState();
    const maintenanceModeEnabled = state.getConfig(
      "maintenance_mode_enabled",
      false
    );

    if (maintenanceModeEnabled && (!req.user || req.user.role_id > 1)) {
      res.status(503).json({ error: "in maintenance mode" });
      return;
    }
    next();
  })
);

const getIcons = () => {
  return getState().icons;
};

const setIconStyle = () => {
  const icons = getIcons();
  return icons
    .filter((icon) => icon.startsWith("unicode-"))
    .map(
      (icon) =>
        `i.${icon}:after {content: '${String.fromCharCode(
          parseInt(icon.substring(8, 12), 16)
        )}'}`
    )
    .join("\n");
};

router.get(
  "/icon-options",
  isAdmin,
  error_catcher(async (req, res) => {
    const { format } = req.query;
    const icons = getIcons();
    switch (format) {
      case "bootstrap-iconpicker":
        res.type("text/javascript");
        res.send(
          `jQuery.iconset_fontawesome_5={iconClass:"",iconClassFix:"",version:"5.3.1",icons:${JSON.stringify(
            icons
          )}}`
        );
        break;
      case "json":
        res.json(icons);
        break;
      default:
        res.send("");
        break;
    }
  })
);
