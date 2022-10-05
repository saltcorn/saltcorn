
const js = async () => {
    const Table = require("../models/table");
    const Field = require("../models/field");
    const File = require("../models/file");
    const db = require("../db");
    const tables = await Table.find({});
    const fsp = require("fs").promises
    const fs = require("fs")
    const path = require("path")
    const { getState } = require("../db/state");

    await File.ensure_file_store(db.getTenantSchema())

    await getState().refresh(false)
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
                newLocations[file.id] = path.basename(newLoc)
                file.id = undefined
                file.location = newLoc
                await file.set_role(file.min_role_read)
                break
            }
        }
    }
    // migrate file fields to text fields
    const fileFields = await Field.find({ type: "File" })
    const schema = db.getTenantSchemaPrefix()
    for (const field of fileFields) {
        const table = Table.findOne({ id: field.table_id })

        await db.query(`alter table ${schema}"${table.name}" drop constraint "${table.name}_${field.name}_fkey"`)
        await db.query(`alter table ${schema}"${table.name}" alter column "${field.name}" type text;`)
        if (table.versioned)
            await db.query(`alter table ${schema}"${table.name}__history" alter column "${field.name}" type text;`)

        const rows = await table.getRows({})
        for (const row of rows) {
            if (row[field.name]) {
                await table.updateRow({ [field.name]: newLocations[row[field.name]] }, row[table.pk_name])
            }
        }

    }
    //system cfg
    await getState().setConfig("site_logo_id", newLocations[getState().getConfig("site_logo_id")])
    await getState().setConfig("favicon_id", newLocations[getState().getConfig("favicon_id")])

    // pages etc, other layout items

}
module.exports = { js };
