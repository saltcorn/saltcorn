const js = async () => {
  const Table = require("../models/table");
  const tables = await Table.find({});

  const { getState } = require("../db/state");

  const state = getState();
  await state?.refresh_tables(false);

  const Field = require("../models/field");

  const stored_fields = await Field.find({
    calculated: true,
    stored: true,
  });

  for (const field of stored_fields) {
    try {
      await field.set_calc_joinfields();
    } catch (error) {
      console.error(error);
    }
  }
};
module.exports = { js };
