const Router = require("express-promise-router");

const Field = require("@saltcorn/data/models/field");
const Form = require("@saltcorn/data/models/form");
const { isAdmin, setTenant, error_catcher } = require("./utils.js");
const { getState } = require("@saltcorn/data/db/state");
const FieldRepeat = require("@saltcorn/data/models/fieldrepeat");
const File = require("@saltcorn/data/models/file");
const User = require("@saltcorn/data/models/user");
const View = require("@saltcorn/data/models/view");
const Page = require("@saltcorn/data/models/page");

const { mkTable, renderForm, link, post_btn } = require("@saltcorn/markup");
const { script, domReady, div, ul } = require("@saltcorn/markup/tags");
const { send_infoarch_page } = require("../markup/admin.js");

const router = new Router();
module.exports = router;

const menuForm = async (req) => {
  const views = await View.find({});
  const pages = await Page.find({});
  const roles = await User.get_roles();

  return new Form({
    action: "/menu/",
    submitLabel: req.__("Save"),
    id: "menuForm",
    labelCols:3,
    noSubmitButton: true,
    additionalButtons: [
      { label: "Update", id: "btnUpdate", class: "btn btn-primary" },
      { label: "Add", id: "btnAdd", class: "btn btn-primary" },
    ],
    fields: [
      {
        name: "type",
        label: req.__("Type"),
        input_type: "select",
        class: "menutype item-menu",
        required: true,
        options: ["View", "Page", "Link", "Header"],
      },
      {
        name: "text",
        label: req.__("Text label"),
        class: "item-menu",
        input_type: "text",
        required: true,
      },
      {
        name: "icon_btn",
        label: req.__("Icon"),
        input_type: "custom_html",
        attributes: {
          html: `<button type="button" id="myEditor_icon" class="btn btn-outline-secondary"></button>`,
        },
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
        input_type: "select",
        class: "item-menu",
        options: views.map((r) => r.name),
        showIf: { type: "View" },
      },
    ],
  });
};

//create -- new

const menuEditorScript = (menu_items) => `
  var iconPickerOptions = {searchText: "Search icon...", labelHeader: "{0}/{1}"};
  let lastState;
  let editor;  
  function ajax_save_menu() {
    const s = editor.getString()    
    if(s===lastState) return;
    lastState=s;
    ajax_post('/menu', {data: s, 
      success: ()=>{}, dataType : 'json', contentType: 'application/json;charset=UTF-8'})
  }
  var sortableListOptions = {
      placeholderCss: {'background-color': "#cccccc"},
      onChange: ajax_save_menu,
  };
  editor = new MenuEditor('myEditor', 
              { 
              listOptions: sortableListOptions, 
              iconPicker: iconPickerOptions,
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
  // Calling the add method
  $('#btnAdd').click(function(){
      editor.add();
      ajax_save_menu();
  });
  lastState=editor.getString()
  setInterval(ajax_save_menu, 500)
  `;
const menuTojQME = (menu_items) =>
  (menu_items || []).map((mi) => ({
    ...mi,
    text: mi.label,
    subitems: undefined,
    ...(mi.subitems ? { children: menuTojQME(mi.subitems) } : {}),
  }));
const jQMEtoMenu = (menu_items) =>
  menu_items.map((mi) => ({
    ...mi,
    label: mi.text,
    children: undefined,
    ...(mi.children ? { subitems: jQMEtoMenu(mi.children) } : {}),
  }));
router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await menuForm(req);
    const state = getState();
    const menu_items = menuTojQME(state.getConfig("menu_items"));
    
    send_infoarch_page({
      res,
      req,
      active_sub: "Menu",
      headers: [
        {
          script: "/jquery-menu-editor.min.js",
        },
        {
          script: "/iconset-fontawesome5-3-1.min.js",
        },
        {
          script: "/bootstrap-iconpicker.min.js",
        },
        {
          css: "/bootstrap-iconpicker.min.css",
        },
      ],
      contents: {
        type: "card",
        title: req.__(`Menu editor`),
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

router.post(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    if(req.xhr) {
      const new_menu = req.body
      await getState().setConfig("menu_items", jQMEtoMenu(new_menu));
      res.json({success: true})
    } else {
    const new_menu = JSON.parse(req.body.menu);
    await getState().setConfig("menu_items", jQMEtoMenu(new_menu));
    req.flash("success", req.__(`Menu updated`));

    res.redirect(`/menu`);
    }
  })
);
