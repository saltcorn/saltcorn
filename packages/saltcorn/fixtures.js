const db = require("saltcorn-data/db");
const State = require("saltcorn-data/db/state");
const Table = require("saltcorn-data/models/table");
const Field = require("saltcorn-data/models/field");
const View = require("saltcorn-data/models/view");
const User = require("saltcorn-data/models/user");
const basePlugin = require("saltcorn-base")

basePlugin.register()

const fixtures = async () => {
  const table = await Table.create("books");
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
    type: "String",
    required: true,
    attributes: { min: 0 }
  });
  const patients = await Table.create("patients");
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
    type: "Key to books",
    required: false
  });
  await Field.create({
    table: patients,
    name: "parent",
    label: "Parent",
    type: "Key to patients",
    required: false
  });
  await View.create({
    table_id: table.id,
    name: "authorlist",
    viewtemplate: "list",
    configuration: { field_list: ["author", "Link to authorshow", "Delete"] },
    is_public: true,
    on_root_page: true,
    on_menu: true
  });
  await View.create({
    table_id: table.id,
    name: "authorshow",
    viewtemplate: "show",
    configuration: { "patients.favbook": true },
    is_public: true,
    on_root_page: true,
    on_menu: true
  });
  await View.create({
    table_id: patients.id,
    name: "patientlist",
    viewtemplate: "list",
    configuration: { field_list: ["name", "favbook", "parent"] },
    is_public: false,
    on_root_page: true,
    on_menu: true
  });
  await db.insert("books", { author: "Herman Melville", pages: 967 });
  await db.insert("books", { author: "Leo Tolstoy", pages: 728 });
  const kirk_id = await db.insert("patients", {
    name: "Kirk Douglas",
    favbook: 1
  });
  await db.insert("patients", {
    name: "Michael Douglas",
    favbook: 2,
    parent: kirk_id
  });
  await User.create({ email: "admin@foo.com", password: "secret", role_id: 1 });
  await User.create({
    email: "staff@foo.com",
    password: "secret",
    role_id: 2
  });
};

fixtures().then(
  () => {
    console.log("Fixtures loaded successful");
    process.exit(0);
  },
  err => {
    console.error(err);
    process.exit(1);
  }
);
