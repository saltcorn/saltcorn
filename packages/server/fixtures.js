const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");
const Table = require("@saltcorn/data/models/table");
const Field = require("@saltcorn/data/models/field");
const View = require("@saltcorn/data/models/view");
const User = require("@saltcorn/data/models/user");
const Page = require("@saltcorn/data/models/page");
const basePlugin = require("@saltcorn/base-plugin");

module.exports = async () => {
  getState().registerPlugin("base", basePlugin);
  const table = await Table.create("books", {
    expose_api_read: true,
    min_role_read: 10
  });
  await Field.create({
    table,
    name: "author",
    label: "Author",
    type: "String",
    required: true
  });
  await Field.create({
    table,
    name: "pages",
    label: "Pages",
    type: "Integer",
    required: true,
    attributes: { min: 0 }
  });
  const patients = await Table.create("patients", {
    expose_api_read: true,
    min_role_read: 4
  });
  await Field.create({
    table: patients,
    name: "name",
    label: "Name",
    type: "String",
    required: true
  });
  await Field.create({
    table: patients,
    name: "favbook",
    label: "Favourite book",
    type: "Key",
    reftable: table,
    required: false,
    attributes: { summary_field: "author" }
  });
  await Field.create({
    table: patients,
    name: "parent",
    label: "Parent",
    type: "Key",
    reftable: patients,
    required: false
  });
  await View.create({
    table_id: table.id,
    name: "authorlist",
    viewtemplate: "List",
    configuration: {
      columns: [
        { type: "Field", field_name: "author", state_field: "on" },
        { type: "ViewLink", view: "Own:authorshow" },
        { type: "Action", action_name: "Delete" },
        {
          type: "Aggregation",
          agg_relation: "patients.favbook",
          agg_field: "name",
          stat: "Count"
        }
      ]
    },
    is_public: true,
    on_root_page: true
  });
  await View.create({
    table_id: table.id,
    name: "authorshow",
    viewtemplate: "Show",
    configuration: {
      columns: [
        { type: "Field", field_name: "author", state_field: "on" },
        { type: "ViewLink", view: "Own:authorshow" },
        { type: "Action", action_name: "Delete" },
        {
          type: "Aggregation",
          agg_relation: "patients.favbook",
          agg_field: "name",
          stat: "Count"
        }
      ],
      layout: {
        above: [{ type: "field", fieldview: "show", field_name: "author" }]
      }
    },
    is_public: true,
    on_root_page: true
  });
  await View.create({
    table_id: table.id,
    name: "authoredit",
    viewtemplate: "Edit",
    configuration: {
      columns: [{ type: "Field", field_name: "author" }],
      layout: {
        above: [{ type: "field", fieldview: "edit", field_name: "author" }]
      },
      fixed: {
        pages: 678
      }
    },
    is_public: true,
    on_root_page: true
  });
  await View.create({
    table_id: patients.id,
    name: "patientlist",
    viewtemplate: "List",
    configuration: {
      columns: [
        { type: "Field", field_name: "name" },
        { type: "Field", field_name: "favbook" },
        { type: "Field", field_name: "parent" },
        { type: "Field", field_name: "favbook" },
        { type: "JoinField", join_field: "favbook.author" },
        { type: "JoinField", join_field: "favbook.pages" }
      ]
    },
    is_public: false,
    on_root_page: true
  });
  const readings = await Table.create("readings");
  await Field.create({
    table: readings,
    name: "temperature",
    label: "Temperature",
    type: "Integer",
    required: true
  });
  await Field.create({
    table: readings,
    name: "patient_id",
    label: "Patient",
    type: "Key",
    reftable: patients,
    required: true
  });
  await db.insert("books", { author: "Herman Melville", pages: 967 });
  await db.insert("books", { author: "Leo Tolstoy", pages: 728 });
  const kirk_id = await db.insert("patients", {
    name: "Kirk Douglas",
    favbook: 1
  });
  const michael_id = await db.insert("patients", {
    name: "Michael Douglas",
    favbook: 2,
    parent: kirk_id
  });
  await db.insert("readings", { temperature: 37, patient_id: kirk_id });
  await db.insert("readings", { temperature: 39, patient_id: kirk_id });
  await db.insert("readings", { temperature: 37, patient_id: michael_id });
  await User.create({ email: "admin@foo.com", password: "secret", role_id: 1 });
  await User.create({
    email: "staff@foo.com",
    password: "secret",
    role_id: 4
  });
  await User.create({
    email: "user@foo.com",
    password: "secret",
    role_id: 8
  });
  await Page.create({
    name: "a_page",
    title: "grgw",
    description: "rgerg",
    min_role: 10,
    layout: {
      above: [
        {
          type: "blank",
          block: false,
          contents: "Hello world",
          textStyle: ""
        },
        { type: "line_break" },
        { type: "blank", isHTML: true, contents: "<h1> foo</h1>" },
        {
          url: "https://saltcorn.com/",
          text: "Click here",
          type: "link",
          block: false,
          textStyle: ""
        },
        {
          type: "card",
          title: "header",
          contents: {
            above: [
              null,
              {
                aligns: ["left", "left"],
                widths: [6, 6],
                besides: [
                  {
                    above: [
                      null,
                      {
                        type: "blank",
                        block: false,
                        contents: "Hello world",
                        textStyle: ""
                      }
                    ]
                  },
                  {
                    above: [
                      null,
                      {
                        type: "blank",
                        block: false,
                        contents: "Bye bye",
                        textStyle: ""
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      ]
    },
    fixed_states: {}
  });
};
