const js = async () => {
    const Table = require("../models/table");
    const File = require("../models/file");
    const db = require("../db");
    const tables = await Table.find({});

    // rename all files, move to tenant dir
    const db_files = await File.find({ inDB: true })
    console.log(db_files[0]);
}
module.exports = { js };
