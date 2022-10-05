const js = async () => {
    const Table = require("../models/table");
    const db = require("../db");
    const tables = await Table.find({});

    // rename all files, move to tenant dir

}
module.exports = { js };
