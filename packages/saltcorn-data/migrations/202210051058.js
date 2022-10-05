const js = async () => {
    const Table = require("../models/table");
    const Field = require("../models/field");
    const File = require("../models/file");
    const db = require("../db");
    const tables = await Table.find({});
    const fsp = require("fs").promises
    const fs = require("fs")
    const path = require("path")
    await File.ensure_file_store(db.getTenantSchema())

    //TODO bail out if S3

    // rename all files, move to tenant dir with new name
    const db_files = await File.find({ inDB: true })
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
            const exists = fs.existsSync(newLoc)
            if (!exists) {
                await fsp.rename(file.location, newLoc)
                newLocations[file.id] = newLoc
                break
            }
        }
    }
    // migrate file fields to text fields
    const fileFields = await Field.find({ type: "File" })
    const schema = db.getTenantSchemaPrefix()
    for (const field of fileFields) {
        const table = Table.findOne(field.table_id)
        await db.query(`alter table ${schama}"${table.name}" alter column "${field.name}" type text;`)

    }
    //console.log(fileFields[0]);


}
module.exports = { js };
