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

  await File.ensure_file_store(db.getTenantSchema());

  const state = getState();

  await state?.refresh(false);
  //TODO bail out if S3

  const useS3 = state?.getConfig("storage_s3_enabled");
  if (useS3) {
    const fileFields = await Field.find({ type: "File" });
    const schema = db.getTenantSchemaPrefix();
    for (const field of fileFields) {
      const table = Table.findOne({ id: field.table_id });

      await db.query(
        `alter table ${schema}"${db.sqlsanitize(
          table.name
        )}" drop constraint "${db.sqlsanitize(table.name)}_${field.name}_fkey"`
      );
      await db.query(
        `alter table ${schema}"${db.sqlsanitize(table.name)}" alter column "${
          field.name
        }" type text;`
      );
      if (table.versioned)
        await db.query(
          `alter table ${schema}"${db.sqlsanitize(
            table.name
          )}__history" alter column "${field.name}" type text;`
        );
    }
    return;
  }

  // rename all files, move to tenant dir with new name
  const db_files = await File.find({ inDB: true });
  const newLocations = {};
  for (const file of db_files) {
    for (let i = 0; i < 5000; i++) {
      let newbase = file.filename;
      if (i) {
        const ext = path.extname(file.filename);
        const filenoext = path.basename(file.filename, ext);
        newbase = `${filenoext}_${i}${ext}`;
      }
      const newLoc = File.get_new_path(newbase);
      const exists = fs.existsSync(newLoc);
      if (!exists) {
        try {
          await fsp.rename(file.location, newLoc);
        } catch (e) {
          console.error(e);
        }
        newLocations[file.id] = path.basename(newLoc);
        file.id = undefined;
        file.location = newLoc;
        try {
          await file.set_role(file.min_role_read);
        } catch (e) {
          console.error(e);
        }

        break;
      }
    }
  }
  // migrate file fields to text fields
  const fileFields = await Field.find({ type: "File" });
  const schema = db.getTenantSchemaPrefix();
  for (const field of fileFields) {
    const table = Table.findOne({ id: field.table_id });

    await db.query(
      `alter table ${schema}"${db.sqlsanitize(
        table.name
      )}" drop constraint "${db.sqlsanitize(table.name)}_${field.name}_fkey"`
    );
    await db.query(
      `alter table ${schema}"${db.sqlsanitize(table.name)}" alter column "${
        field.name
      }" type text;`
    );
    if (table.versioned)
      await db.query(
        `alter table ${schema}"${db.sqlsanitize(
          table.name
        )}__history" alter column "${field.name}" type text;`
      );

    const rows = await table.getRows({});
    for (const row of rows) {
      if (row[field.name]) {
        await table.updateRow(
          { [field.name]: newLocations[row[field.name]] },
          row[table.pk_name]
        );
      }
    }
  }
  //system cfg
  if (state) {
    await state.setConfig("legacy_file_id_locations", newLocations);
    await state.setConfig(
      "site_logo_id",
      newLocations[state.getConfig("site_logo_id")]
    );
    await state.setConfig(
      "favicon_id",
      newLocations[state.getConfig("favicon_id")]
    );
  }
  // pages etc, other layout items
  const visitors = {
    image(segment) {
      if (segment.srctype === "File") {
        segment.fileid = newLocations[segment.fileid];
      }
    },
    container(segment) {
      if (segment.bgFileId) {
        segment.bgFileId = newLocations[segment.bgFileId];
      }
    },
  };
  const pages = await Page.find();
  for (const page of pages) {
    const layout = page.layout;
    traverseSync(layout, visitors);
    await Page.update(page.id, { layout });
  }
  const views = await View.find();
  for (const view of views) {
    const layout = view.configuration.layout;
    if (!layout) continue;
    traverseSync(layout, visitors);
    await View.update(
      { configuration: { ...view.configuration, layout } },
      view.id
    );
  }

  //any-bootstrap-theme settings
  const anybsPlugin = await Plugin.findOne({ name: "any-bootstrap-theme" });
  if (anybsPlugin) {
    if (anybsPlugin.configuration.theme === "File") {
      anybsPlugin.configuration.css_file =
        newLocations[anybsPlugin.configuration.css_file];
      await anybsPlugin.upsert();
    }
  }
};
module.exports = { js };
