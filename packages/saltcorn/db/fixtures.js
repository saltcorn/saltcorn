const db = require(".");
const Table = require("./table");
const Field = require("./field");
const View = require("./view");
const User = require("../auth/user");

const fixtures = async () => {
  const table = await Table.create("books");
  await Field.create({
    table,
    fname: "author",
    flabel: "Author",
    ftype: "String",
    required: true
  });
  await Field.create({
    table,
    fname: "pages",
    flabel: "Pages",
    ftype: "String",
    required: true,
    attributes: { min: 0 }
  });
  await View.create({
    table_id: table.id,
    name: "authorlist",
    viewtemplate: "list",
    configuration: { field_list: ["author"] }
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
