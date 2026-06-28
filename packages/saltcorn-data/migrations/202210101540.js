const js = async () => {
  const Table = require("@saltcorn/data/models/table");
  const Field = require("@saltcorn/data/models/field");
  const File = require("@saltcorn/data/models/file");
  const Page = require("@saltcorn/data/models/page");
  const View = require("@saltcorn/data/models/view");
  const Plugin = require("@saltcorn/data/models/plugin");
  const { traverseSync } = require("@saltcorn/data/models/layout");

  const db = require("@saltcorn/data/db");
  const tables = await Table.find({});
  const fsp = require("fs").promises;
  const fs = require("fs");
  const path = require("path");
  const { getState } = require("@saltcorn/data/db/state");

  const state = getState();
  await state?.refresh_tables(false);
  await state?.refresh_views(false);
  await state?.refresh_triggers(false);
  await state?.refresh_pages(false);
  await state?.refresh_config(false);
  await state?.refresh_npmpkgs(false);

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
