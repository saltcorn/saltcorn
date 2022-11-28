const js = async () => {
  const Table = require("../models/table");
  const Field = require("../models/field");
  const File = require("../models/file");
  const Page = require("../models/page");
  const View = require("../models/view");
  const Plugin = require("../models/plugin");
  const { traverseSync } = require("../models/layout");

  const db = require("../db");
  const tables = await Table.find({});
  const fsp = require("fs").promises;
  const fs = require("fs");
  const path = require("path");
  const { getState } = require("../db/state");

  const state = getState();

  await state?.refresh(false);
  //TODO bail out if S3

  const useS3 = state?.getConfig("storage_s3_enabled");
  if (useS3) {
    return;
  }

  //system cfg
  if (state) {
    const newLocations = await state.getConfig("legacy_file_id_locations");
    if (!newLocations || Object.keys(newLocations).length === 0) return;
    // migrate html fields to text fields
    const htmlFields = await Field.find({ type: "HTML" });
    const schema = db.getTenantSchemaPrefix();
    for (const field of htmlFields) {
      const table = Table.findOne({ id: field.table_id });
      for (const [fid, newLoc] of Object.entries(newLocations)) {
        const sql = `UPDATE ${schema}"${db.sqlsanitize(table.name)}" 
                 set "${field.name}" = REPLACE(
                    "${field.name}",
                    ' src="/files/serve/${fid}"',
                    ' src="/files/serve/${encodeURIComponent(newLoc)}"')`;
        //console.log(sql);
        if (!newLoc.includes("'")) await db.query(sql);
      }
    }
  }
};
module.exports = { js };
