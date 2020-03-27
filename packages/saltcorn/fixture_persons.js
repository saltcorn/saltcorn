const db = require("saltcorn-data/db");
const State = require("saltcorn-data/db/state");
const Table = require("saltcorn-data/models/table");
const Field = require("saltcorn-data/models/field");
const View = require("saltcorn-data/models/view");
const User = require("saltcorn-data/models/user");
const basePlugin = require("saltcorn-base-plugin");
const { registerPlugin } = require("./load_plugins");

registerPlugin(basePlugin);

const rndElem = vs => vs[Math.floor(Math.random() * vs.length)];

const randomPerson = () => {
  const gender = Math.random() > 0.5 ? "Female" : "Male";
  const last_name = rndElem(
    "Smith Potter Weasley Granger Filch Harris Tufte".split(" ")
  );
  const first_name =
    gender === "Male"
      ? rndElem(
          "Harry John Ron Tim Tom Alistair David Ralf Angus Edward".split(" ")
        )
      : rndElem(
          "Hermione Rose Harriet Ada Alice Antonia Beatrix Jennifer".split(" ")
        );
  const age = Math.round(16 + 60 * Math.random());
  return { gender, last_name, first_name, age };
};

const fixturePersons = async () => {
  await db.query(`drop table if exists persons`);
  const table = await Table.create("persons");
  await Field.create({
    table,
    name: "first_name",
    label: "First name",
    type: "String",
    required: true
  });
  await Field.create({
    table,
    name: "last_name",
    label: "Last name",
    type: "String",
    required: true
  });
  await Field.create({
    table,
    name: "age",
    label: "Age",
    type: "Integer",
    required: true
  });
  await Field.create({
    table,
    name: "gender",
    label: "Gender",
    type: "String",
    required: true,
    attributes: { options: "Male,Female" }
  });
  for (let index = 0; index < 100; index++) {
    await db.insert("persons", randomPerson());
  }
};

fixturePersons().then(
  () => {
    console.log("Fixtures loaded successful");
    process.exit(0);
  },
  err => {
    console.error(err);
    process.exit(1);
  }
);
