/**
 * Action description
 * @category saltcorn-data
 * @module base-plugin/actions
 * @subcategory base-plugin
 */

const fetch = require("node-fetch");
const vm = require("vm");
const Table = require("../models/table");
const View = require("../models/view");
const File = require("../models/file");
const { getState } = require("../db/state");
const User = require("../models/user");
const Trigger = require("../models/trigger");
const { getMailTransport, viewToEmailHtml } = require("../models/email");
const {
  get_async_expression_function,
  recalculate_for_stored,
  eval_expression,
} = require("../models/expression");
const { div, code } = require("@saltcorn/markup/tags");
const { sleep } = require("../utils");
const db = require("../db");
const { isNode } = require("../utils");
const { available_languages } = require("../models/config");

//action use cases: field modify, like/rate (insert join), notify, send row to webhook
// todo add translation

/**
 * @param opts
 * @param opts.row
 * @param opts.table
 * @param opts.channel
 * @param opts.configuration
 * @param opts.user
 * @param opts.rest
 * @returns
 */
const run_code = async ({
  row,
  table,
  channel,
  configuration: { code, run_where },
  user,
  ...rest
}) => {
  if (run_where === "Client page") return { eval_js: code };
  if (!isNode() && run_where === "Server") {
    // stop on the app and run the action server side
    return { server_eval: true };
  }
  const Actions = {};
  Object.entries(getState().actions).forEach(([k, v]) => {
    Actions[k] = (args = {}) => {
      v.run({ row, table, user, configuration: args, ...rest, ...args });
    };
  });
  const trigger_actions = await Trigger.find({
    when_trigger: { or: ["API call", "Never"] },
  });
  for (const trigger of trigger_actions) {
    const state_action = getState().actions[trigger.action];
    Actions[trigger.name] = (args = {}) => {
      state_action.run({
        row,
        table,
        configuration: trigger.configuration,
        user,
        ...rest,
        ...args,
      });
    };
  }
  const emitEvent = (eventType, channel, payload) =>
    Trigger.emitEvent(eventType, channel, user, payload);
  const fetchJSON = async (...args) => await (await fetch(...args)).json();
  const sysState = getState();
  const require = (nm) => sysState.codeNPMmodules[nm];
  const f = vm.runInNewContext(`async () => {${code}\n}`, {
    Table,
    table,
    row,
    user,
    console,
    Actions,
    emitEvent,
    sleep,
    fetchJSON,
    fetch,
    URL,
    File,
    require,
    setConfig: (k, v) => sysState.setConfig(k, v),
    getConfig: (k) => sysState.getConfig(k),
    channel: table ? table.name : channel,
    ...(row || {}),
    ...getState().function_context,
    ...rest,
  });
  return await f();
};

module.exports = {
  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory actions
   */
  blocks: {
    disableInBuilder: true,
    disableInList: true,
    configFields: [
      {
        name: "workspace",
        input_type: "hidden",
      },
      {
        name: "code",
        input_type: "hidden",
      },
    ],
    /**
     * @type {base-plugin/actions~run_code}
     * @see base-plugin/actions~run_code
     */
    run: run_code,
  },

  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory actions
   */
  emit_event: {
    /**
     * @returns {object[]}
     */
    configFields: () => [
      {
        name: "eventType",
        label: "Event type",
        required: true,
        input_type: "select",
        options: Trigger.when_options,
      },
      {
        name: "channel",
        label: "Channel",
        type: "String",
        fieldview: "textarea",
      },
      {
        name: "payload",
        label: "Payload JSON",
        sublabel: "Leave blank to use row from table",
        type: "String",
        fieldview: "textarea",
      },
    ],
    /**
     * @param {object} opts
     * @param {object} opts.row
     * @param {object} opts.configuration
     * @param {object} opts.user
     * @returns {Promise<void>}
     */
    run: async ({
      row,
      configuration: { eventType, channel, payload },
      user,
    }) => {
      return await Trigger.emitEvent(
        eventType,
        channel,
        user,
        payload ? JSON.parse(payload) : row
      );
    },
  },

  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory actions
   */
  webhook: {
    configFields: [
      {
        name: "url",
        label: "URL",
        type: "String",
        sublabel: "Trigger will call specified URL",
      },
      {
        name: "body",
        label: "JSON body",
        sublabel: "Leave blank to use row from table",
        type: "String",
        fieldview: "textarea", // I think that textarea is better
      },
    ],
    /**
     * @param {object} opts
     * @param {string} opts.url
     * @param {object} opts.body
     * @returns {Promise<object>}
     */
    run: async ({ row, configuration: { url, body } }) => {
      return await fetch(url, {
        method: "post",
        body: body || JSON.stringify(row),
        headers: { "Content-Type": "application/json" },
      });
    },
  },

  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory actions
   */
  find_or_create_dm_room: {
    /**
     * @returns {Promise<object[]>}
     */
    configFields: async () => {
      const views = await View.find_all_views_where(
        ({ viewrow }) => viewrow.viewtemplate === "Room"
      );

      const view_opts = views.map((v) => v.name);
      return [
        {
          name: "viewname",
          label: "Room view",
          sublabel: "Select a view with the Room viewtemplate",
          input_type: "select",
          options: view_opts,
        },
      ];
    },

    /**
     * @param {object} opts
     * @param {object} opts.row
     * @param {*} opts.table
     * @param {object} opts.configuration
     * @param {object} opts.user
     * @returns {Promise<object>}
     */
    run: async ({ row, table, configuration: { viewname }, user }) => {
      const view = await View.findOne({ name: viewname });
      if (!view)
        throw new Error(
          `In find_or_create_dm_room action, Room view ${viewname} does not exist`
        );
      const { participant_field } = view.configuration;
      const [part_table_name, part_key_to_room, part_user_field] =
        participant_field.split(".");
      const roomtable = Table.findOne({ id: view.table_id });
      const parttable = Table.findOne({ name: part_table_name });

      //find a room that has both participants
      //select id from rooms r where uid1 in (select id from participants where...) and

      const { rows } = await db.query(
        `with my_rooms as (select "${part_key_to_room}" from "${db.getTenantSchema()}"."${db.sqlsanitize(
          part_table_name
        )}" where "${part_user_field}" = $1)          
        select * from "${db.getTenantSchema()}"."${db.sqlsanitize(
          roomtable.name
        )}" r where r.id in (select "${part_key_to_room}" from my_rooms) 
        and $2 in (select "${part_user_field}" from "${db.getTenantSchema()}"."${db.sqlsanitize(
          part_table_name
        )}" where "${part_key_to_room}" = r.id)`,
        [user.id, row.id]
      );
      if (rows.length > 0) {
        return { goto: `/view/${viewname}?id=${rows[0].id}` };
      } else {
        //create room
        const room_id = await roomtable.insertRow({});
        await parttable.insertRow({
          [part_user_field]: user.id,
          [part_key_to_room]: room_id,
        });
        await parttable.insertRow({
          [part_user_field]: row.id,
          [part_key_to_room]: room_id,
        });
        return { goto: `/view/${viewname}?id=${room_id}` };
      }
    },
  },

  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory actions
   */
  send_email: {
    /**
     * @param {object} opts
     * @param {object} opts.table
     * @returns {Promise<object[]>}
     */
    configFields: async ({ table }) => {
      if (!table) return [];
      const views = await View.find_table_views_where(
        table,
        ({ viewtemplate }) => viewtemplate?.runMany || viewtemplate?.renderRows
      );

      const view_opts = views.map((v) => v.name);
      const fields = await table.getFields();
      const field_opts = fields
        .filter(
          (f) =>
            (f.type && f.type.name === "String") || f.reftable_name === "users"
        )
        .map((f) => f.name);
      return [
        {
          name: "viewname",
          label: "View to send",
          sublabel:
            "Select a view that can render a single record - for instance, of the Show template.",
          input_type: "select",
          options: view_opts,
        },
        {
          name: "to_email",
          label: "Recipient email address",
          sublabel:
            "Select email addresses for send email. Choose option to get more information",
          input_type: "select",
          required: true,

          options: ["Fixed", "User", "Field"],
        },
        {
          name: "to_email_field",
          label: "Field with email address",
          sublabel:
            "Field with email address a String, or Key to user who will receive email",
          input_type: "select",

          options: field_opts,

          showIf: { to_email: "Field" },
        },
        {
          name: "to_email_fixed",
          label: "Fixed address",
          sublabel: "Email address to send emails", // todo send to few addresses?
          type: "String",
          showIf: { to_email: "Fixed" },
        },
        {
          name: "subject",
          label: "Subject",
          sublabel: "Subject of email",
          type: "String",
          required: true,
        },
        {
          name: "only_if",
          label: "Only if",
          sublabel:
            "Only send email if this formula evaluates to true. Leave blank to always send email",
          type: "String",
        },
      ];
    },
    requireRow: true,
    /**
     * @param {object} opts
     * @param {object} opts.row
     * @param {object} opts.table
     * @param {object} opts.configuration
     * @param {object} opts.user
     * @returns {Promise<object>}
     */
    run: async ({
      row,
      table,
      configuration: {
        viewname,
        subject,
        to_email,
        to_email_field,
        to_email_fixed,
        only_if,
      },
      user,
    }) => {
      let to_addr;

      if (only_if) {
        const bres = eval_expression(only_if, row);
        if (!bres) return;
      }
      switch (to_email) {
        case "Fixed":
          to_addr = to_email_fixed;
          break;
        case "User":
          to_addr = user.email;
          break;
        case "Field":
          const fields = await table.getFields();
          const field = fields.find((f) => f.name === to_email_field);
          if (field && field.type.name === "String")
            to_addr = row[to_email_field];
          else if (field && field.reftable_name === "users") {
            const refuser = await User.findOne({ id: row[to_email_field] });
            to_addr = refuser.email;
          }
          break;
      }
      if (!to_addr) {
        getState().log(
          2,
          `send_email action: Not sending as address ${to_email} is missing`
        );
        return;
      }
      const view = await View.findOne({ name: viewname });
      const html = await viewToEmailHtml(view, { id: row.id });
      const from = getState().getConfig("email_from");

      getState().log(
        3,
        `Sending email from ${from} to ${to_addr} with subject ${subject}`
      );

      const email = {
        from,
        to: to_addr,
        subject,
        html,
      };
      //console.log(email);
      await getMailTransport().sendMail(email);
      return { notify: `E-mail sent to ${to_addr}` };
    },
  },

  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory actions
   */
  insert_joined_row: {
    /**
     * @param {object} opts
     * @param {object} opts.table
     * @returns {Promise<object[]>}
     */
    configFields: async ({ table }) => {
      if (!table) return [];
      const { child_field_list } = await table.get_child_relations();
      return [
        {
          name: "joined_table",
          label: "Relation",
          sublabel: "Relation", // todo more detailed explanation
          input_type: "select",
          options: child_field_list,
        },
      ];
    },
    requireRow: true,
    /**
     * @param {object} opts
     * @param {object} opts.row
     * @param {object} opts.table
     * @param {object} opts.configuration
     * @param {object} opts.user
     * @returns {Promise<object>}
     */
    run: async ({ row, table, configuration: { joined_table }, user }) => {
      if (!joined_table)
        throw new Error(`Relation not specified in insert_joined_row action`);
      if (!joinTable)
        throw new Error(
          `Table ${join_table_name} not found in insert_joined_row action`
        );
      const [join_table_name, join_field] = joined_table.split(".");
      const joinTable = await Table.findOne({ name: join_table_name });
      if (!joinTable)
        throw new Error(
          `Table ${join_table_name} not found in insert_joined_row action`
        );
      const fields = await joinTable.getFields();
      const newRow = { [join_field]: row.id };
      for (const field of fields) {
        if (
          field.type === "Key" &&
          field.reftable_name === "users" &&
          user &&
          user.id
        )
          newRow[field.name] = user.id;
      }
      return await joinTable.insertRow(newRow, user);
    },
  },

  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory actions
   */
  duplicate_row: {
    /**
     * @returns {Promise<object[]>}
     */
    configFields: () => [],
    requireRow: true,
    /**
     * @param {object} opts
     * @param {object} opts.row
     * @param {object} opts.table
     * @param {*} opts.user
     * @returns {Promise<object>}
     */
    run: async ({ row, table, user }) => {
      const newRow = { ...row };
      await table.getFields();
      delete newRow[table.pk_name];
      await table.insertRow(newRow, user);
      return { reload_page: true };
    },
  },

  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory actions
   */
  recalculate_stored_fields: {
    /**
     * @param {object} opts
     * @param {object} opts.table
     * @returns {Promise<object[]>}
     */
    configFields: async ({ table }) => {
      const tables = await Table.find();
      return [
        {
          name: "table",
          label: "Table",
          sublabel: "Table on which to recalculate stored calculated fields",
          input_type: "select",
          options: tables.map((t) => t.name),
        },
        {
          name: "only_triggering_row",
          label: "Only triggering row",
          type: "Bool",
          showIf: table ? { table: table.name } : {},
        },
      ];
    },
    /**
     * @param {object} opts
     * @param {object} opts.configuration
     * @returns {Promise<void>}
     */
    run: async ({ table, row, configuration }) => {
      const table_for_recalc = await Table.findOne({
        name: configuration.table,
      });

      //intentionally omit await

      if (
        configuration.only_triggering_row &&
        table.name === table_for_recalc?.name &&
        row &&
        row[table.pk_name]
      ) {
        table.updateRow({}, row[table.pk_name], undefined, true);
      } else if (table_for_recalc) recalculate_for_stored(table_for_recalc);
      else return { error: "recalculate_stored_fields: table not found" };
    },
  },

  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory actions
   */
  insert_any_row: {
    /**
     * @param {object} opts
     * @param {*} opts.table
     * @returns {Promise<object[]>}
     */
    configFields: async ({ table }) => {
      const tables = await Table.find();
      return [
        {
          name: "table",
          label: "Table",
          sublabel: "Table to insert rows in",
          input_type: "select",
          options: tables.map((t) => t.name),
        },
        {
          name: "row_expr",
          label: "Row expression",
          sublabel: "Expression for JavaScript object",
          type: "String",
          fieldview: "textarea",
        },
      ];
    },
    /**
     * @param {object} opts
     * @param {object} opts.row
     * @param {object} opts.configuration
     * @param {object} opts.user
     * @param {...*} opts.rest
     * @returns {Promise<object|boolean>}
     */
    run: async ({ row, configuration: { row_expr, table }, user, ...rest }) => {
      const f = get_async_expression_function(row_expr, [], {
        row: row || {},
        user,
        console,
      });
      const calcrow = await f({});
      const table_for_insert = await Table.findOne({ name: table });
      const res = await table_for_insert.tryInsertRow(calcrow, user);
      if (res.error) return res;
      else return true;
    },
  },

  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory actions
   */
  run_js_code: {
    /**
     * @param {object} opts
     * @param {object} opts.table
     * @returns {Promise<object[]>}
     */
    configFields: async ({ table }) => {
      const fields = table ? (await table.getFields()).map((f) => f.name) : [];
      const vars = [
        ...(table ? ["row"] : []),
        "user",
        "console",
        "Actions",
        "Table",
        "File",
        ...(table ? ["table"] : []),
        ...fields,
      ]
        .map((f) => code(f))
        .join(", ");
      return [
        {
          name: "code",
          label: "Code",
          input_type: "code",
          attributes: { mode: "application/javascript" },
          validator(s) {
            try {
              let AsyncFunction = Object.getPrototypeOf(
                async function () {}
              ).constructor;
              AsyncFunction(s);
              return true;
            } catch (e) {
              return e.message;
            }
          },
        },
        {
          input_type: "section_header",
          label: " ",
          sublabel: div("Variables in scope: ", vars),
          showIf: { run_where: "Server" },
        },
        {
          name: "run_where",
          label: "Run where",
          input_type: "select",
          options: ["Server", "Client page"],
        },
      ];
    },
    /**
     * @type {base-plugin/actions~run_code}
     * @see base-plugin/actions~run_code
     **/
    run: run_code,
  },
  duplicate_row_prefill_edit: {
    configFields: async ({ table }) => {
      const fields = table ? await table.getFields() : [];
      const views = await View.find_table_views_where(
        table,
        ({ viewrow }) => viewrow.viewtemplate === "Edit"
      );

      const fldOpts = fields.map((f) => ({
        label: f.name,
        name: f.name,
        default: f.name !== "id",
        type: "Bool",
      }));
      return [
        {
          name: "viewname",
          label: "View to create",
          input_type: "select",
          options: views.map((v) => v.name),
        },
        ...fldOpts,
      ];
    },
    requireRow: true,
    run: async ({ row, table, configuration: { viewname, ...flds }, user }) => {
      const qs = Object.entries(flds)
        .map(([k, v]) =>
          v && typeof row[k] !== "undefined"
            ? `${encodeURIComponent(k)}=${encodeURIComponent(row[k])}`
            : false
        )
        .filter((s) => s)
        .join("&");
      return { goto: `/view/${viewname}?${qs}` };
    },
  },
  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory actions
   */
  set_user_language: {
    configFields: async ({ table }) => [
      {
        name: "language",
        type: "String",
        required: true,
        attributes: {
          options: Object.entries(available_languages).map(
            ([locale, language]) => ({
              label: language,
              name: locale,
            })
          ),
        },
      },
    ],
    run: async ({ configuration: { language }, user, req, res }) => {
      if (user?.id) {
        const u = await User.findForSession({ id: user.id });
        await u.set_language(language);
        req.login(u.session_object, function (err) {
          if (!err) {
            req.flash("success", req.__("Language changed to %s", language));
            return { reload_page: true };
          } else {
            req.flash("danger", err);
          }
        });
      } else {
        res?.cookie?.("lang", language);
      }
      return { reload_page: true };
    },
  },
  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory actions
   */
  sync_table_from_external: {
    /**
     * @param {object} opts
     * @param {*} opts.table
     * @returns {Promise<object[]>}
     */
    configFields: async ({ table }) => {
      const tables = await Table.find_with_external();
      const pk_options = {};
      for (const table of tables) {
        const fields = await table.getFields();
        pk_options[table.name] = fields.map((f) => f.name);
      }
      return [
        {
          name: "table_src",
          label: "Source table",
          sublabel: "External table to sync from",
          input_type: "select",
          options: tables.filter((t) => t.external).map((t) => t.name),
        },
        {
          name: "table_dest",
          label: "Destination table",
          sublabel: "Table to sync to",
          input_type: "select",
          options: tables.filter((t) => !t.external).map((t) => t.name),
        },
        {
          name: "pk_field",
          label: "Primary key field",
          sublabel:
            "Field on destination table to match primary key in source table",
          type: "String",
          required: true,
          attributes: {
            calcOptions: ["table_dest", pk_options],
          },
        },
        {
          name: "delete_rows",
          label: "Delete removed rows",
          sublabel:
            "Delete rows that are in the destination table but not in the source table",
          type: "Bool",
          default: true,
        },
        {
          name: "match_field_names",
          label: "Match fields",
          sublabel: "Match field names automatically by name or label",
          type: "Bool",
          default: true,
        },
        {
          name: "row_expr",
          label: "Row expression",
          sublabel: "Expression for JavaScript object",
          type: "String",
          fieldview: "textarea",
          showIf: { match_field_names: false },
        },
      ];
    },
    /**
     * @param {object} opts
     * @param {object} opts.row
     * @param {object} opts.configuration
     * @param {object} opts.user
     * @param {...*} opts.rest
     * @returns {Promise<object|boolean>}
     */
    run: async ({
      configuration: {
        row_expr,
        table_src,
        table_dest,
        pk_field,
        delete_rows,
        match_field_names,
      },
      user,
      ...rest
    }) => {
      // set difference: a - b
      // https://stackoverflow.com/a/36504668/19839414
      const set_diff = (a, b) => new Set([...a].filter((x) => !b.has(x)));
      let set_intersect = (a, b) => new Set([...a].filter((x) => b.has(x)));

      const source_table = await Table.findOne({ name: table_src });
      const source_rows = await source_table.getRows({});
      const table_for_insert = await Table.findOne({ name: table_dest });
      const dest_rows = await table_for_insert.getRows({});
      const srcPKfield = source_table.fields.find((f) => f.primary_key).name;
      const src_pks = new Set(source_rows.map((r) => r[srcPKfield]));
      const dest_pks = new Set(dest_rows.map((r) => r[pk_field]));
      let match_expr;
      if (match_field_names) {
        const matched_fields = [];
        const dest_fields = await table_for_insert.getFields();
        const src_fields = await source_table.getFields();
        dest_fields.forEach((df) => {
          const s = src_fields.find(
            (sf) =>
              sf.name === df.name ||
              sf.label === df.label ||
              sf.name === df.label ||
              sf.label === df.name
          );
          if (s) matched_fields.push([df.name, s.name]);
        });
        match_expr = `({${matched_fields
          .map(([d, s]) => `${d}: ${s}`)
          .join(",")}})`;
      }
      // new rows
      for (const newPK of set_diff(src_pks, dest_pks)) {
        const srcRow = source_rows.find((r) => r[srcPKfield] === newPK);
        const newRow = {
          [pk_field]: newPK,
          ...eval_expression(match_expr || row_expr, srcRow),
        };
        await table_for_insert.insertRow(newRow, user);
      }
      // delete rows
      if (delete_rows)
        await table_for_insert.deleteRows(
          {
            [pk_field]: { in: [...set_diff(dest_pks, src_pks)] },
          },
          user
        );

      //update existing
      for (const existPK of set_intersect(src_pks, dest_pks)) {
        const srcRow = source_rows.find((r) => r[srcPKfield] === existPK);
        const newRow = {
          [pk_field]: existPK,
          ...eval_expression(match_expr || row_expr, srcRow),
        };

        const existingRow = dest_rows.find((r) => r[pk_field] === existPK);

        const is_different_for_key = (k) => newRow[k] !== existingRow[k];

        if (Object.keys(newRow).some(is_different_for_key))
          await table_for_insert.updateRow(
            newRow,
            existingRow[table_for_insert.pk_name],
            user
          );
      }
    },
  },
};
