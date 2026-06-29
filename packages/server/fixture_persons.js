/**
 * @category server
 * @module fixture_persons
 */
import db from "@saltcorn/data/db";
import { getState } from "@saltcorn/data/db/state";
import Table from "@saltcorn/data/models/table";
import Field from "@saltcorn/data/models/field";
import View from "@saltcorn/data/models/view";
import User from "@saltcorn/data/models/user";
import basePlugin from "@saltcorn/base-plugin";

getState().registerPlugin("base", basePlugin);

/**
 * @param {object[]} vs
 * @returns {object}
 */
const rndElem = (vs) => vs[Math.floor(Math.random() * vs.length)];

/**
 * @returns {object}
 */
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

/**
 * @returns {Promise<void>}
 */
const fixturePersons = async () => {
  await db.query(`drop table if exists persons`);
  const table = await Table.create("persons");
  await Field.create({
    table,
    name: "first_name",
    label: "First name",
    type: "String",
    required: true,
  });
  await Field.create({
    table,
    name: "last_name",
    label: "Last name",
    type: "String",
    required: true,
  });
  await Field.create({
    table,
    name: "age",
    label: "Age",
    type: "Integer",
    required: true,
  });
  await Field.create({
    table,
    name: "gender",
    label: "Gender",
    type: "String",
    required: true,
    attributes: { options: "Male,Female" },
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
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
