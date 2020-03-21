const db = require(".");
const Table = require("../models/table");
const Field = require("../models/field");
const View = require("../models/view");
const User = require("../auth/user");

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
  await db.insert("books", { author: "Herman Melville", pages: 967 });
  await db.insert("books", { author: "Leo Tolstoy", pages: 728 });
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
