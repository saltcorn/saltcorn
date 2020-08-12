const db = require(".");
const { getState } = require("./state");
const Table = require("../models/table");
const Field = require("../models/field");
const File = require("../models/file");
const View = require("../models/view");
const User = require("../models/user");
const Page = require("../models/page");
const fs = require("fs").promises;

module.exports = async () => {
  getState().registerPlugin("base", require("../base-plugin"));
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
    min_role: 10,
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
    min_role: 10,
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
    min_role: 10,
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
    min_role: 8,
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
  await Field.create({
    table: readings,
    name: "normalised",
    label: "Normalised",
    type: "Bool"
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
  await db.insert("readings", {
    temperature: 37,
    patient_id: kirk_id,
    normalised: true
  });
  await db.insert("readings", {
    temperature: 39,
    patient_id: kirk_id,
    normalised: false
  });
  await db.insert("readings", {
    temperature: 37,
    patient_id: michael_id,
    normalised: false
  });
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
  await File.ensure_file_store();
  const mv = async fnm => {
    await fs.writeFile(fnm, "cecinestpasunpng");
  };
  await File.from_req_files(
    { mimetype: "image/png", name: "magrite.png", mv, size: 245752 },
    1,
    10
  );
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
