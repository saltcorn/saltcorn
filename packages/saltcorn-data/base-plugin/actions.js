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
const { getState } = require("../db/state");
const User = require("../models/user");
const Trigger = require("../models/trigger");
const { getMailTransport, viewToEmailHtml } = require("../models/email");
const {
  get_async_expression_function,
  recalculate_for_stored,
} = require("../models/expression");
const { div, code } = require("@saltcorn/markup/tags");
const { sleep } = require("../utils");
const db = require("../db");
const { isNode } = require("../utils");

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
  if (!isNode() && run_where === "Server")
    return { error: "Running server code is not yet implemented." };
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
  const f = vm.runInNewContext(`async () => {${code}}`, {
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
      const { participant_field } = view.configuration;
      const [part_table_name, part_key_to_room, part_user_field] =
        participant_field.split(".");
      const roomtable = Table.findOne({ id: view.table_id });
      const parttable = Table.findOne({ name: part_table_name });

      //find a room that has both participants
      // select id from rooms r where uid1 in (select id from participants where...) and

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
        ({ viewtemplate }) => viewtemplate.runMany || viewtemplate.renderRows
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
      },
      user,
    }) => {
      let to_addr;
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
      const view = await View.findOne({ name: viewname });
      const html = await viewToEmailHtml(view, { id: row.id });
      console.log(
        "Sending email from %s to %s with subject %s to_email",
        getState().getConfig("email_from"),
        to_addr,
        subject,
        to_addr
      );
      const email = {
        from: getState().getConfig("email_from"),
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
      const [join_table_name, join_field] = joined_table.split(".");
      const joinTable = await Table.findOne({ name: join_table_name });
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
      return await joinTable.insertRow(newRow);
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
      await table.insertRow(newRow);
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
      ];
    },
    /**
     * @param {object} opts
     * @param {object} opts.configuration
     * @returns {Promise<void>}
     */
    run: async ({ configuration: { table } }) => {
      const table_for_recalc = await Table.findOne({ name: table });
      recalculate_for_stored(table_for_recalc);
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
      const res = await table_for_insert.tryInsertRow(calcrow, user && user.id);
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
          sublabel: div("Variables in scope: ", vars),
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
};
