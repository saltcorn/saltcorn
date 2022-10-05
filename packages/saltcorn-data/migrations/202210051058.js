const js = async () => {
    const Table = require("../models/table");
    const File = require("../models/file");
    const db = require("../db");
    const tables = await Table.find({});
    const fsp = require("fs").promises
    const path = require("path")
    await File.ensure_file_store(db.getTenantSchema())

    //TODO bail out if S3

    // rename all files, move to tenant dir
    const db_files = await File.find({ inDB: true })
    console.log(db_files[0]);
    const newLocations = {}
    for (const file of db_files) {
        for (let i = 0; i < 5000; i++) {
            let newbase = file.filename
            if (i) {
                const ext = path.extname(file.filename)
                const filenoext = path.basename(file.filename, ext)
                newbase = `${filenoext}_${i}${ext}`
            }
            const newLoc = File.get_new_path(newbase)
            const exists = await fps.exists(newLoc)
            if (!exists) {
                await fsp.rename(file.location, newLoc)
                newLocations[file.id] = newLoc
                break
            }
        }
    }
    //
}
module.exports = { js };
