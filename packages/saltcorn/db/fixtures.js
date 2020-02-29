const db = require(".");
const Table = require("./table");
const Field = require("./field");

const fixtures = async () => {
  const table = await Table.create("books");
  await Field.create({
    table,
    fname: "author",
    flabel: "Author",
    ftype: "String"
  });
  await Field.create({
    table,
    fname: "pages",
    flabel: "Pages",
    ftype: "String",
    attributes: { min: 0 }
  });
  await db.insert("books", { author: "Herman Melville", pages: 967 });
  await db.insert("books", { author: "Leo Tolstoy", pages: 728 });
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
