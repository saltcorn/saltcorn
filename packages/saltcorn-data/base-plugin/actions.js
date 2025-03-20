/**
 * Action description
 * @category saltcorn-data
 * @module base-plugin/actions
 * @subcategory base-plugin
 */

const fetch = require("node-fetch");
const vm = require("vm");
const Table = require("../models/table");
const EventLog = require("../models/eventlog");
const View = require("../models/view");
const File = require("../models/file");
const { getState } = require("../db/state");
const User = require("../models/user");
const Trigger = require("../models/trigger");
const Notification = require("../models/notification");
const {
  getMailTransport,
  viewToEmailHtml,
  loadAttachments,
  getFileAggregations,
  mjml2html,
} = require("../models/email");
const {
  get_async_expression_function,
  recalculate_for_stored,
  eval_expression,
  freeVariablesInInterpolation,
  add_free_variables_to_joinfields,
  freeVariables,
} = require("../models/expression");
const { div, code, a, span } = require("@saltcorn/markup/tags");
const {
  sleep,
  getSessionId,
  urlStringToObject,
  dollarizeObject,
  objectToQueryString,
  interpolate,
} = require("../utils");
const db = require("../db");
const { isNode, isWeb, ppVal, getFetchProxyOptions } = require("../utils");
const { available_languages } = require("../models/config");

//action use cases: field modify, like/rate (insert join), notify, send row to webhook
// todo add translation

const consoleInterceptor = (state) => {
  const handle = (printer, level, message, optionalParams) => {
    printer(message, ...optionalParams);
    if (state.hasJoinedLogSockets && state.logLevel >= level) {
      const s = ppVal(message);
      state.emitLog(
        state.tenant || "public",
        level,
        optionalParams.length === 0
          ? s
          : `${s} ${optionalParams.map((val) => ppVal(val)).join(" ")}`
      );
    }
  };
  return {
    log: (message, ...optionalParams) =>
      handle(console.log, 5, message, optionalParams),
    info: (message, ...optionalParams) =>
      handle(console.info, 5, message, optionalParams),
    debug: (message, ...optionalParams) =>
      handle(console.debug, 5, message, optionalParams),
    warn: (message, ...optionalParams) =>
      handle(console.warn, 2, message, optionalParams),
    error: (message, ...optionalParams) =>
      handle(console.error, 1, message, optionalParams),
  };
};

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
  if (run_where === "Client page")
    return {
      eval_js: code,
      row,
      field_names: table ? table.fields.map((f) => f.name) : undefined,
    };
  if (!isNode()) {
    const { isOfflineMode } = getState().mobileConfig;
    if (!isOfflineMode && run_where === "Server") {
      // stop on the app and run the action server side
      return { server_eval: true };
    }
  }
  const Actions = {};
  Object.entries(getState().actions).forEach(([k, v]) => {
    Actions[k] = (args = {}) => {
      return v.run({ row, table, user, configuration: args, ...rest, ...args });
    };
  });
  const trigger_actions = await Trigger.find({
    when_trigger: { or: ["API call", "Never"] },
  });
  for (const trigger of trigger_actions) {
    const state_action = getState().actions[trigger.action];
    Actions[trigger.name] = (args = {}) => {
      return state_action.run({
        row,
        table,
        configuration: trigger.configuration,
        user,
        ...rest,
        ...args,
      });
    };
  }
  const run_js_code = async ({ code, ...restArgs }) => {
    return await run_code({
      row,
      table,
      channel,
      configuration: { code, run_where },
      user,
      ...rest,
      ...restArgs,
    });
  };
  const emitEvent = (eventType, channel, payload) =>
    Trigger.emitEvent(eventType, channel, user, payload);
  const fetchJSON = async (...args) => await (await fetch(...args)).json();
  const sysState = getState();
  const require = (nm) => sysState.codeNPMmodules[nm];
  const f = vm.runInNewContext(`async () => {${code}\n}`, {
    Table,
    table,
    row,
    context: row,
    user,
    console: consoleInterceptor(getState()),
    Actions,
    emitEvent,
    sleep,
    fetchJSON,
    fetch,
    run_js_code,
    URL,
    File,
    User,
    View,
    EventLog,
    Buffer: isNode() ? Buffer : require("buffer"),
    Trigger,
    Notification,
    setTimeout,
    interpolate,
    require,
    setConfig: (k, v) => sysState.setConfig(k, v),
    getConfig: (k) => sysState.getConfig(k),
    channel: table ? table.name : channel,
    session_id: rest.req && getSessionId(rest.req),
    request_headers: rest?.req?.headers,
    request_ip: rest?.req?.ip,
    ...(row || {}),
    ...getState().eval_context,
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
    disableInWorkflow: true,
    description: "Build action with drag and drop steps similar to Scratch",
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
    namespace: "Code",
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
    description: "Emit an event",
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
    namespace: "Control",
  },

  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory actions
   */
  webhook: {
    description: "Make an outbound HTTP/HTTPS request",
    configFields: async ({ table, mode }) => {
      let field_opts = [];
      if (table) {
        field_opts = table.fields
          .filter(
            (f) => f.type && ["String", "HTML", "JSON"].includes(f.type.name)
          )
          .map((f) => f.name);
      }
      return [
        {
          name: "url",
          label: "URL",
          type: "String",
          sublabel: "Trigger will call specified URL",
        },
        {
          name: "method",
          label: "HTTP Method",
          type: "String",
          required: true,
          attributes: { options: "POST,GET,PUT,DELETE,PATCH" },
        },
        {
          name: "body",
          label: "JSON body",
          sublabel: "Leave blank to use row from table",
          type: "String",
          fieldview: "textarea",
          showIf: { method: ["POST", "PUT", "DELETE", "PATCH"] },
        },
        {
          name: "authorization",
          label: "Authorization header",
          type: "String",
          sublabel: "For example <code>Bearer xxxx</code>",
        },
        ...(field_opts.length
          ? [
              {
                name: "response_field",
                label: "Response into field",
                type: "String",
                attributes: { options: field_opts },
              },
            ]
          : []),
        ...(mode === "workflow"
          ? [
              {
                name: "response_var",
                label: "Response variable",
                sublabel: "Variable in the context to fill with the response",
                type: "String",
              },
            ]
          : []),
      ];
    },
    /**
     * @param {object} opts
     * @param {string} opts.url
     * @param {object} opts.body
     * @returns {Promise<object>}
     */
    run: async ({
      row,
      user,
      table,
      configuration: {
        url,
        body,
        authorization,
        response_field,
        response_var,
        method,
      },
    }) => {
      let url1 = interpolate(url, row, user, "Webhook URL");

      const fetchOpts = {
        method: (method || "post").toLowerCase(),
        headers: { "Content-Type": "application/json" },
        ...getFetchProxyOptions(),
      };
      if (method !== "GET") {
        let postBody;
        if (body && table) {
          const f = get_async_expression_function(body, table.fields, {
            row: row || {},
            user,
          });
          postBody = JSON.stringify(await f(row, user));
        } else if (body) postBody = body;
        else postBody = JSON.stringify(row);
        fetchOpts.body = postBody;
      }
      if (authorization)
        fetchOpts.headers.Authorization = interpolate(
          authorization,
          row,
          user,
          "Webhook authorization"
        );
      const response = await fetch(url1, fetchOpts);
      const contentType = response.headers.get("content-type");
      const isJSON =
        contentType && contentType.indexOf("application/json") !== -1;

      if (response_var) {
        const parsedResponse = isJSON
          ? await response.json()
          : await response.text();
        return { [response_var]: parsedResponse };
      } else if (table && row && response_field) {
        const field = table.getField(response_field);
        const parsedResponse = isJSON
          ? await response.json()
          : await response.text();
        const saveResponse =
          isJSON &&
          (field?.type?.name === "String" || field?.type?.sql_name === "text")
            ? JSON.stringify(parsedResponse)
            : parsedResponse;
        await table.updateRow(
          { [response_field]: saveResponse },
          row[table.pk_name]
        );
      } else return;
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
    description:
      "Find or create a direct message room for the user, redirect the page to this room",
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
    namespace: "Communication",
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
    description: "Send an email, based on a chosen view for this table",
    configFields: async ({ table, mode }) => {
      if (mode === "workflow") {
        return [
          {
            name: "to_email",
            label: "To",
            sublabel:
              "To addresses, comma separated, <code>{{ }}</code> interpolations usable",
            type: "String",
          },
          {
            name: "cc_email",
            label: "cc",
            sublabel:
              "cc addresses, comma separated, <code>{{ }}</code> interpolations usable",
            type: "String",
          },
          {
            name: "bcc_email",
            label: "bcc",
            sublabel:
              "bcc addresses, comma separated, <code>{{ }}</code> interpolations usable",
            type: "String",
          },
          {
            name: "subject",
            label: "Subject",
            sublabel:
              "Subject of email, <code>{{ }}</code> interpolations usable",
            type: "String",
            required: true,
          },
          {
            name: "body",
            label: "Body",
            type: "String",
            fieldview: "textarea",
            required: true,
          },
          /*    {
            name: "attachment_paths",
            label: "Attachments",
            sublabel:
              "Comma-separated list of files to attach. <code>{{ }}</code> interpolations usable",
            type: "String",
          },*/
          {
            name: "confirm_field",
            label: "Send confirmation variable",
            type: "String",
            sublabel:
              "Bool variable set in context indicate successful sending of email message",
          },
        ];
      }
      if (!table) return [];
      const views = await View.find_table_views_where(
        table,
        ({ viewtemplate }) => viewtemplate?.runMany || viewtemplate?.renderRows
      );

      const view_opts = views.map((v) => v.name);
      const fields = table.getFields();
      const field_opts = fields
        .filter(
          (f) =>
            (f.type && f.type.name === "String") || f.reftable_name === "users"
        )
        .map((f) => f.name);
      const body_field_opts = fields
        .filter(
          (f) => f.type && (f.type.name === "HTML" || f.type.name === "String")
        )
        .map((f) => f.name);
      const confirm_field_opts = fields
        .filter(
          (f) => f.type && (f.type.name === "Bool" || f.type.name === "Date")
        )
        .map((f) => f.name);
      const attachment_opts = [""];
      for (const field of fields) {
        if (field.type === "File") attachment_opts.push(field.name);
      }
      for (const relationPath of await getFileAggregations(table)) {
        attachment_opts.push(relationPath);
      }
      return [
        {
          name: "body_type",
          label: "Body type",
          type: "String",
          required: true,
          attributes: {
            options: ["View", "Text field", "HTML field", "MJML field"],
          },
        },
        {
          name: "body_field",
          label: "Body field",
          type: "String",
          required: true,
          attributes: {
            options: body_field_opts,
          },
          showIf: { body_type: ["Text field", "HTML field", "MJML field"] },
        },

        {
          name: "viewname",
          label: "View to send",
          sublabel:
            "Select a view that can render a single record - for instance, of the Show template.",
          input_type: "select",
          options: view_opts,
          showIf: { body_type: "View" },
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
          sublabel:
            "To addresses, comma separated, <code>{{ }}</code> interpolations usable",
          type: "String",
          showIf: { to_email: "Fixed" },
        },
        {
          name: "cc_email",
          label: "cc address",
          sublabel:
            "cc addresses, comma separated, <code>{{ }}</code> interpolations usable",
          type: "String",
        },
        {
          name: "bcc_email",
          label: "bcc address",
          sublabel:
            "bcc addresses, comma separated, <code>{{ }}</code> interpolations usable",
          type: "String",
        },
        {
          name: "subject",
          label: "Subject",
          sublabel: "Subject of email",
          type: "String",
          class: "validate-expression validate-expression-conditional",

          required: true,
        },
        {
          name: "subject_formula",
          label: "Subject is a formula?",
          type: "Bool",
          required: false,
        },
        {
          name: "attachment_path",
          label: "Attachment",
          sublabel:
            "Select a field pointing to a file. " +
            "Direct fields produce a single attachment, relations allow multiple attachments.",
          input_type: "select",
          options: attachment_opts,
          type: "String",
          default: "",
        },
        {
          name: "only_if",
          label: "Only if",
          sublabel:
            "Only send email if this formula evaluates to true. Leave blank to always send email",
          type: "String",
        },
        { name: "disable_notify", label: "Disable notification", type: "Bool" },
        {
          name: "confirm_field",
          label: "Send confirmation field",
          type: "String",
          sublabel:
            "Bool or Date field to indicate successful sending of email message",
          attributes: {
            options: confirm_field_opts,
          },
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
        body_type,
        body_field,
        viewname,
        subject,
        subject_formula,
        to_email,
        to_email_field,
        to_email_fixed,
        cc_email,
        bcc_email,
        only_if,
        attachment_path,
        disable_notify,
        confirm_field,
        body,
      },
      user,
      mode,
    }) => {
      const from = getState().getConfig("email_from");

      if (mode === "workflow") {
        const email = {
          from,
          to: interpolate(to_email, row, user, "send_email to address"),
          cc: interpolate(cc_email, row, user, "send_email cc address"),
          bcc: interpolate(bcc_email, row, user, "send_email bcc address"),
          subject: interpolate(subject, row, user, "send_email subject"),
          html: interpolate(body, row, user, "send_email html body"),

          //          attachments,
        };
        const sendres = await getMailTransport().sendMail(email);
        getState().log(5, `send_email result: ${JSON.stringify(sendres)}`);
        if (confirm_field)
          return { [confirm_field]: sendres.accepted.length > 0 };
        else return;
      }
      let to_addr;
      let useRow = row;
      const fvs = [
        ...freeVariablesInInterpolation(to_email_fixed),
        ...freeVariablesInInterpolation(cc_email),
        ...freeVariablesInInterpolation(bcc_email),
        ...(subject_formula ? freeVariables(subject) : []),
        ...freeVariables(only_if),
      ];
      if (fvs.length > 0) {
        const joinFields = {};
        const fields = table.getFields();
        add_free_variables_to_joinfields(new Set(fvs), joinFields, fields);
        useRow = await table.getJoinedRow({
          where: { [table.pk_name]: row[table.pk_name] },
          joinFields,
          forUser: user,
        });
      }

      if (only_if) {
        const bres = eval_expression(
          only_if,
          useRow,
          user,
          "send_email only if formula"
        );
        if (!bres) return;
      }
      switch (to_email) {
        case "Fixed":
          to_addr = interpolate(
            to_email_fixed,
            useRow,
            user,
            "send_email to address"
          );
          break;
        case "User":
          to_addr = user.email;
          break;
        case "Field":
          const fields = table.getFields();
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
      const setBody = {};
      if (body_type === "Text field") {
        setBody.text = row[body_field];
      } else if (body_type === "HTML field") {
        setBody.html = row[body_field];
      } else if (body_type === "MJML field") {
        const mjml = row[body_field];
        const html = mjml2html(mjml, { minify: true });
        setBody.html = html.html;
      } else {
        const view = await View.findOne({ name: viewname });
        setBody.html = await viewToEmailHtml(view, { id: row[table.pk_name] });
      }

      const attachments = await loadAttachments(
        attachment_path,
        row,
        user ? user : { role_id: 100 }
      );
      const the_subject = subject_formula
        ? eval_expression(subject, useRow, user, "send_email subject formula")
        : subject;

      getState().log(
        3,
        `Sending email from ${from} to ${to_addr} with subject ${the_subject}`
      );
      const cc = cc_email
        ? interpolate(cc_email, useRow, user, "send_email cc address")
        : undefined;
      const bcc = bcc_email
        ? interpolate(bcc_email, useRow, user, "send_email bcc address")
        : undefined;
      const email = {
        from,
        to: to_addr,
        cc,
        bcc,
        subject: the_subject,
        ...setBody,
        attachments,
      };
      try {
        const sendres = await getMailTransport().sendMail(email);
        getState().log(5, `send_email result: ${JSON.stringify(sendres)}`);
        if (confirm_field && sendres.accepted.length > 0) {
          const confirm_fld = table.getField(confirm_field);
          if (confirm_fld && confirm_fld.type.name === "Date")
            await table.updateRow(
              { [confirm_field]: new Date() },
              row[table.pk_name]
            );
          else if (confirm_fld && confirm_fld.type.name === "Bool")
            await table.updateRow(
              { [confirm_field]: true },
              row[table.pk_name]
            );
        }
        if (disable_notify) return;
        else return { notify: `E-mail sent to ${to_addr}` };
      } catch (e) {
        if (confirm_field) {
          const confirm_fld = table.getField(confirm_field);
          if (confirm_fld && confirm_fld.type.name === "Bool")
            await table.updateRow(
              { [confirm_field]: false },
              row[table.pk_name]
            );
          throw e;
        }
      }
    },
    namespace: "Communication",
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
    description: "Insert a row in a related table",
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
    disableInWorkflow: true,
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

      const [join_table_name, join_field] = joined_table.split(".");
      const joinTable = Table.findOne({ name: join_table_name });
      if (!joinTable)
        throw new Error(
          `Table ${join_table_name} not found in insert_joined_row action`
        );
      const fields = joinTable.getFields();
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
    namespace: "Database",
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
    description: "Duplicate the current row",
    configFields: () => [],
    disableInWorkflow: true,
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
      table.getFields();
      delete newRow[table.pk_name];
      await table.insertRow(newRow, user);
    },
    namespace: "Database",
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
    description:
      "Re-calculate the stored calculated fields for a table, optionally only for the triggering row",
    configFields: async ({ table }) => {
      const tables = await Table.find({}, { cached: true });
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
        {
          name: "where",
          label: "Recalculate where",
          sublabel: "Where-expression for subset of rows to recalculate",
          type: "String",
          class: "validate-expression",
        },
      ];
    },
    /**
     * @param {object} opts
     * @param {object} opts.configuration
     * @returns {Promise<void>}
     */
    run: async ({ table, row, configuration, user }) => {
      const table_for_recalc = Table.findOne({
        name: configuration.table,
      });

      //intentionally omit await

      if (
        configuration.only_triggering_row &&
        table.name === table_for_recalc?.name &&
        row &&
        row[table.pk_name]
      ) {
        await table.updateRow({}, row[table.pk_name], undefined, true);
      } else if (configuration.where) {
        const where = eval_expression(
          configuration.where,
          row || {},
          user,
          "recalculate_stored_fields where"
        );
        recalculate_for_stored(table_for_recalc, where);
      } else if (table_for_recalc) recalculate_for_stored(table_for_recalc);
      else return { error: "recalculate_stored_fields: table not found" };
    },
    namespace: "Database",
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
    description: "insert a row into any table, using a formula expression",
    configFields: async ({ mode }) => {
      const tables = await Table.find({}, { cached: true });
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
          sublabel:
            "Expression for JavaScript object. Example: <code>{first_name: name.split(' ')[0]}</code>",
          type: "String",
          fieldview: "textarea",
        },
        ...(mode === "workflow"
          ? [
              {
                name: "id_variable",
                label: "ID variable",
                sublabel:
                  "Variable in the context to fill with the created ID value",
                type: "String",
              },
            ]
          : []),
      ];
    },
    /**
     * @param {object} opts
     * @param {object} opts.row
     * @param {object} [opts.table]
     * @param {object} opts.configuration
     * @param {object} opts.user
     * @param {...*} [opts.rest]
     * @returns {Promise<object|boolean>}
     */
    run: async ({ row, table, configuration, user, referrer, ...rest }) => {
      const state = urlStringToObject(referrer);
      const f = get_async_expression_function(
        configuration.row_expr,
        table?.fields || Object.keys(row || {}).map((k) => ({ name: k })),
        {
          user,
          console,
          session_id: rest.req && getSessionId(rest.req),
          ...dollarizeObject(state),
        }
      );
      const calcrow = await f(row || {}, user);
      const table_for_insert = Table.findOne({ name: configuration.table });
      const results = {};
      const res = await table_for_insert.tryInsertRow(calcrow, user, results);

      if (res.error) return res;
      else if (configuration.id_variable)
        return { [configuration.id_variable]: res.success, ...results };
      else return results;
    },
    namespace: "Database",
  },
  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory actions
   */
  modify_row: {
    description: "Modify the triggering row",
    configFields: async ({ mode, when_trigger }) => {
      return [
        {
          name: "row_expr",
          label: "Row expression",
          sublabel:
            "Expression for JavaScript object. For example, <code>{points: 34}</code>",
          input_type: "code",
          attributes: { mode: "application/javascript" },
        },
        ...(mode === "edit" ||
        mode === "filter" ||
        when_trigger === "Validate" ||
        mode === "workflow"
          ? [
              {
                name: "where",
                label: "Modify where",
                type: "String",
                required: true,
                attributes: {
                  options:
                    when_trigger === "Validate"
                      ? ["Row"]
                      : mode === "filter"
                        ? ["Filter state"]
                        : mode === "workflow"
                          ? ["Database", "Active edit view"]
                          : ["Form", "Database"],
                },
              },
            ]
          : []),
        ...(mode === "workflow"
          ? [
              {
                name: "select_table",
                label: "Table",
                type: "String",
                required: true,
                attributes: {
                  options: (await Table.find()).map((t) => t.name),
                  showIf: { where: "Database" },
                },
              },
              {
                name: "query",
                label: "Query object",
                type: "String",
                required: true,
                showIf: { where: "Database" },
              },
            ]
          : []),
      ];
    },
    requireRow: true,
    run: async ({
      row,
      table,
      configuration: { row_expr, where, select_table, query },
      user,
      ...rest
    }) => {
      const f = get_async_expression_function(
        row_expr,
        table?.fields || Object.keys(row).map((k) => ({ name: k })),
        {
          row: row || {},
          user,
        }
      );
      const calcrow = await f(row, user);
      if (
        where === "Form" ||
        where === "Filter state" ||
        where === "Row" ||
        where === "Active edit view"
      )
        return { set_fields: calcrow };
      if (select_table && query) {
        //get table
        const table = Table.findOne(select_table);
        // evaluate query
        const q = eval_expression(
          query,
          row,
          user,
          "Query expression in modify_row step"
        );
        const rows = await table.getRows(q);
        for (const row of rows) {
          await table.updateRow(calcrow, row[table.pk_name]);
        }
        return;
      }
      const res = await table.tryUpdateRow(calcrow, row[table.pk_name], user);
      if (res.error) return res;
      else return;
    },
    namespace: "Database",
  },

  delete_rows: {
    /**
     * @param {object} opts
     * @param {*} opts.table
     * @returns {Promise<object[]>}
     */
    description: "Modify the triggering row",
    configFields: async ({ mode, when_trigger }) => {
      const tables = await Table.find({}, { cached: true });

      return [
        ...(mode === "workflow"
          ? []
          : [
              {
                name: "delete_triggering_row",
                label: "Delete triggering row",
                type: "Bool",
              },
            ]),
        {
          name: "table_name",
          label: "Table",
          sublabel: "Table on which to delete rows",
          input_type: "select",
          showIf: { delete_triggering_row: false },
          options: tables.map((t) => t.name),
        },
        {
          name: "delete_where",
          label: "Delete where",
          type: "String",
          sublabel: "Where expression, ex. <code>{manager: id}</code>",
          required: true,
          class: "validate-expression",
          showIf: { delete_triggering_row: false },
        },
      ];
    },
    run: async ({
      row,
      table,
      configuration: { delete_triggering_row, delete_where, table_name },
      user,
      ...rest
    }) => {
      if (delete_triggering_row) {
        if (!table || !row?.[table.pk_name])
          throw new Error("delete_rows cannot find triggering row");
        await table.deleteRows({ [table.pk_name]: row[table.pk_name] }, user);
        return;
      }
      const where = eval_expression(
        delete_where,
        row || {},
        user,
        "recalculate_stored_fields where"
      );
      const tbl = Table.findOne({ name: table_name });
      await tbl.deleteRows(where, user);
      return;
    },
    namespace: "Database",
  },

  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory actions
   */
  navigate: {
    /**
     * @param {object} opts
     * @param {*} opts.table
     * @returns {Promise<object[]>}
     */
    description: "Navigation action",
    configFields: [
      {
        name: "nav_action",
        label: "Nav Action",
        type: "String",
        required: true,
        attributes: {
          options: [
            "Go to URL",
            "Popup modal",
            "Back",
            "Reload page",
            "Close modal",
            "Close tab",
          ],
        },
      },
      {
        name: "url",
        label: "URL",
        type: "String",
        required: true,
        showIf: { nav_action: ["Go to URL", "Popup modal"] },
      },
    ],
    run: async ({ row, user, configuration: { nav_action, url }, req }) => {
      let url1 = interpolate(url, row, user, "navigate URL");

      switch (nav_action) {
        case "Go to URL":
          return { goto: url1 };
        case "Popup modal":
          return { popup: url1 };
        case "Back":
          return {
            eval_js: isWeb(req)
              ? "history.back()"
              : "parent.saltcorn.mobileApp.navigation.goBack()",
          };
        case "Close tab":
          return { eval_js: "window.close()" };
        case "Close modal":
          return { eval_js: "close_saltcorn_modal()" };
        case "Reload page":
          return { reload_page: true };

        default:
          break;
      }
    },
    namespace: "User interface",
  },
  step_control_flow: {
    /**
     * @param {object} opts
     * @param {*} opts.table
     * @returns {Promise<object[]>}
     */
    description: "Step control flow",
    disableInWorkflow: true,
    configFields: [
      {
        name: "control_action",
        label: "Control action",
        type: "String",
        required: true,
        attributes: {
          options: ["Halt steps", "Goto step", "Clear return values"],
        },
      },
      {
        name: "step",
        label: "Step",
        type: "Integer",
        required: true,
        showIf: { control_action: ["Goto step"] },
      },
    ],
    run: async ({ row, user, configuration: { control_action, step } }) => {
      switch (control_action) {
        case "Halt steps":
          return { halt_steps: true };
        case "Goto step":
          return { goto_step: step };
        case "Clear return values":
          return { clear_return_values: true };

        default:
          break;
      }
    },
    namespace: "Control",
  },
  form_action: {
    /**
     * @param {object} opts
     * @param {*} opts.table
     * @returns {Promise<object[]>}
     */
    description: "Action on form in Edit view",
    requireRow: true,

    configFields: [
      {
        name: "form_action",
        label: "Form Action",
        type: "String",
        required: true,
        attributes: {
          options: [
            "Submit",
            "Save",
            "Reset",
            "Submit with Ajax",
            "Ajax Save Form Data",
          ],
        },
      },
    ],

    run: async ({ row, table, user, configuration: { form_action } }) => {
      const jqGet = `$('form[data-viewname="'+viewname+'"]')`;
      switch (form_action) {
        case "Submit":
          return { eval_js: jqGet + ".submit()" };
        case "Save":
          if (!row[table.pk_name]) {
            //we will save server side so we can set id
            const result = await table.tryInsertRow(row, user);
            if (result.success)
              return { set_fields: { [table.pk_name]: result.success } };
            else {
              getState().log(
                3,
                `form_actions Save failed server side, result: ${JSON.stringify(
                  result
                )} row ${JSON.stringify(row)}`
              );
              return { eval_js: `return saveAndContinueAsync(${jqGet})` };
            }
          }
          return { eval_js: `return saveAndContinueAsync(${jqGet})` };
        case "Reset":
          return { eval_js: jqGet + ".trigger('reset')" };
        case "Submit with Ajax":
          return { eval_js: `submitWithAjax(${jqGet})` };
        case "Ajax Save Form Data":
          return { eval_js: `ajaxSubmitForm(${jqGet}, true)` };
        default:
          return { eval_js: jqGet + ".submit()" };
      }
    },
    namespace: "User interface",
  },

  toast: {
    /**
     * @param {object} opts
     * @param {*} opts.table
     * @returns {Promise<object[]>}
     */
    description: "Notify the user with a toast",
    configFields: [
      {
        name: "notify_type",
        label: "Type",
        type: "String",
        required: true,
        attributes: {
          options: ["Notify", "Error", "Success"],
        },
      },
      {
        name: "text",
        label: "Text",
        type: "String",
        required: true,
      },
      {
        name: "title",
        label: "Title",
        sublabel: "Optional",
        type: "String",
      },
    ],
    run: async ({
      row,
      user,
      configuration: { type, notify_type, text, title },
    }) => {
      //type is legacy. this name gave react problems
      let text1 = interpolate(text, row, user, "Toast text");
      let toast_title = title
        ? { toast_title: interpolate(title, row, user, "Toast title") }
        : {};

      switch (notify_type || type) {
        case "Error":
          return { error: text1, ...toast_title };
        case "Success":
          return { notify_success: text1, ...toast_title };
        default:
          return { notify: text1, ...toast_title };
      }
    },
    namespace: "User interface",
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
    description: "Run arbitrary JavaScript code",
    configFormOptions: {
      formStyle: "vert",
    },
    configFields: async ({ table }) => {
      const fields = table ? table.getFields().map((f) => f.name) : [];
      const vars = [
        ...(table ? ["row"] : []),
        "user",
        "console",
        "Actions",
        a(
          {
            href: "/admin/jsdoc/classes/_saltcorn_data.models.Table-1.html",
            target: "_blank",
          },
          "Table"
        ),
        a(
          {
            href: "/admin/jsdoc/classes/_saltcorn_data.models.File-1.html",
            target: "_blank",
          },
          "File"
        ),
        a(
          {
            href: "/admin/jsdoc/classes/_saltcorn_data.models.User-1.html",
            target: "_blank",
          },
          "User"
        ),
        ...(table ? ["table"] : []),
        ...fields,
      ]
        .map((f) => code(f))
        .join(", ");
      const clientvars = [...fields].map((f) => code(f)).join(", ");

      return [
        {
          name: "code",
          label: "Code",
          input_type: "code",
          attributes: { mode: "application/javascript" },
          class: "validate-statements enlarge-in-card",
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
          sublabel: span("Variables in scope: ", vars),
          help: {
            topic: "JavaScript action code",
          },
          showIf: { run_where: "Server" },
          attributes: { secondColHoriz: true },
        },
        {
          input_type: "section_header",
          label: " ",
          sublabel: span("Variables in scope: ", clientvars),
          help: {
            topic: "JavaScript action code",
          },
          showIf: { run_where: "Client page" },
          attributes: { secondColHoriz: true },
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
    namespace: "Code",
  },
  run_js_code_in_field: {
    /**
     * @param {object} opts
     * @param {object} opts.table
     * @returns {Promise<object[]>}
     */
    description: "Run arbitrary JavaScript code from a String field",
    configFields: async ({ table, mode }) => {
      if (mode === "workflow")
        return [
          {
            name: "code_field",
            label: "Code field",
            sublabel:
              "String variable in context contains the JavaScript code to run",
            type: "String",
            required: true,
          },
          {
            name: "run_where",
            label: "Run where",
            input_type: "select",
            options: ["Server", "Client page"],
          },
        ];
      const field_opts = table.fields
        .filter((f) => f.type?.name === "String")
        .map((f) => f.name);
      table.fields.forEach((f) => {
        if (f.is_fkey && f.type !== "File") {
          const refTable = Table.findOne({ name: f.reftable_name });
          if (!refTable)
            throw new Error(`Unable to find table '${f.reftable_name}`);
          field_opts.push(
            ...refTable.fields
              .filter((jf) => jf.type?.name === "String")
              .map((jf) => `${f.name}.${jf.name}`)
          );
        }
      });
      return [
        {
          name: "code_field",
          label: "Code field",
          sublabel: "String field that contains the JavaScript code to run",
          type: "String",
          required: true,
          attributes: {
            options: field_opts,
          },
        },
        {
          name: "run_where",
          label: "Run where",
          input_type: "select",
          options: ["Server", "Client page"],
        },
      ];
    },
    requireRow: true,

    /**
     * @type {base-plugin/actions~run_code}
     * @see base-plugin/actions~run_code
     **/
    run: async ({
      table,
      configuration: { code_field, run_where },
      row,
      mode,
      ...rest
    }) => {
      let code;
      if (code_field.includes(".")) {
        const [ref, target] = code_field.split(".");
        if (typeof row[ref] === "object") code = row[ref][target];
        else if (!row[ref]) return;
        else {
          const keyfield = table.getField(ref);
          const refTable = Table.findOne({ name: keyfield.reftable_name });
          const refRow = await refTable.getRow({ [table.pk_name]: row[ref] });
          code = refRow[target];
        }
      } else code = row[code_field];
      code = code || "";
      return await run_code({
        ...rest,
        table,
        row,
        configuration: { run_where, code },
      });
    },
    namespace: "Code",
  },

  duplicate_row_prefill_edit: {
    configFields: async ({ table }) => {
      const fields = table ? table.getFields() : [];
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
    disableInWorkflow: true,
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
    namespace: "User interface",
  },
  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory actions
   */
  set_user_language: {
    description: "Set the logged-in user's chosen language",
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
    namespace: "User interface",
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
    description:
      "Synchronize a database table with an external/provider table by copying rows from the external table",
    configFields: async ({ table }) => {
      const tables = await Table.find_with_external();
      const pk_options = {};
      for (const table of tables) {
        const fields = table.getFields();
        pk_options[table.name] = fields.map((f) => f.name);
      }
      return [
        {
          name: "table_src",
          label: "Source table",
          sublabel: "External table to sync from",
          input_type: "select",
          options: tables
            .filter((t) => t.external || t.provider_name)
            .map((t) => t.name),
        },
        {
          name: "table_dest",
          label: "Destination table",
          sublabel: "Table to sync to",
          input_type: "select",
          options: tables
            .filter((t) => !(t.external || t.provider_name))
            .map((t) => t.name),
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

      const source_table = Table.findOne({ name: table_src });
      if (!source_table) return { error: "Source table not found" };

      const source_rows = await source_table.getRows({});
      if (!source_rows) return { error: "No data received" };
      const table_for_insert = Table.findOne({ name: table_dest });
      const dest_rows = await table_for_insert.getRows({});
      const srcPKfield = source_table.fields.find((f) => f.primary_key).name;
      const src_pks = new Set(source_rows.map((r) => r[srcPKfield]));
      const dest_pks = new Set(dest_rows.map((r) => r[pk_field]));
      let match_expr;
      if (match_field_names) {
        const matched_fields = [];
        const dest_fields = table_for_insert.getFields();
        const src_fields = source_table.getFields();
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
    namespace: "Database",
  },
  reload_embedded_view: {
    description: "Reload an embedded view without full page reload",
    configFields: async () => {
      const views = await View.find({});
      return [
        {
          name: "view",
          label: "View to refresh",
          class: "selectizable",
          type: "String",
          required: true,
          attributes: { options: views.map((v) => v.select_option) },
        },
        {
          name: "new_state_fml",
          label: "New state formula",
          type: "String",
          class: "validate-expression",
        },
        {
          name: "interval",
          label: "Periodic interval (ms)",
          sublabel:
            "Optional. Reload periodically with given interval in milliseconds, if set",
          type: "Integer",
        },
      ];
    },
    run: async ({
      row,
      user,
      configuration: { view, new_state_fml, interval },
    }) => {
      let eval_js = `reload_embedded_view('${view}')`;
      if (new_state_fml) {
        const new_state = eval_expression(
          new_state_fml,
          row || {},
          user,
          "reload_embedded_view new state formula"
        );
        const newqs = objectToQueryString(new_state);
        eval_js = `reload_embedded_view('${view}', '${newqs}')`;
      }
      if (interval) eval_js = `setInterval(()=>{${eval_js}}, ${interval})`;
      return { eval_js };
    },
    namespace: "User interface",
  },
  sleep: {
    description: "Delay for a set number of seconds",
    configFields: [
      {
        name: "seconds",
        label: "Seconds",
        type: "Float",
        required: true,
      },
    ],
    run: async ({ configuration: { seconds } }) => {
      return {
        eval_js: `return new Promise((resolve) => setTimeout(resolve, ${
          (seconds || 0) * 1000
        }));`,
      };
    },
    namespace: "Control",
  },
  notify_user: {
    description: "Send a notification to a specific user",
    configFields: () => [
      {
        name: "user_spec",
        label: "User where or email",
        type: "String",
      },
      {
        name: "title",
        label: "Title",
        required: true,
        type: "String",
      },
      {
        name: "body",
        label: "Body",
        type: "String",
      },
      {
        name: "link",
        label: "Link",
        type: "String",
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
      user,
      configuration: { title, body, link, user_spec },
    }) => {
      const user_where =
        //first two cases are for programmatic use
        typeof user_spec === "number"
          ? { id: user_spec }
          : typeof user_spec === "object"
            ? user_spec
            : User.valid_email(user_spec)
              ? { email: user_spec }
              : user_spec === "*"
                ? {}
                : eval_expression(
                    user_spec,
                    row || {},
                    user,
                    "Notify user user where"
                  );
      const users = await User.find(user_where);
      for (const user of users) {
        await Notification.create({
          title: interpolate(title, row, user, "notify_user title"),
          body: interpolate(body, row, user, "notify_user body"),
          link: interpolate(link, row, user, "notify_user link"),
          user_id: user.id,
        });
      }
    },
    namespace: "Communication",
  },

  convert_session_to_user: {
    description:
      "Convert session id fields to user key fields on a table on Login events",
    configFields: async ({ table }) => {
      const tables = await Table.find_with_external();
      const sess_options = {};
      const user_options = {};
      for (const table of tables) {
        const fields = table.getFields();
        sess_options[table.name] = fields
          .filter((f) => f.type?.name === "String")
          .map((f) => f.name);
        user_options[table.name] = fields
          .filter((f) => f.reftable_name === "users")
          .map((f) => f.name);
      }
      return [
        {
          name: "table_name",
          label: "Table",
          sublabel: "Table with session and user field",
          input_type: "select",
          options: tables.filter((t) => !t.external).map((t) => t.name),
        },
        {
          name: "session_field",
          label: "Session field",
          sublabel: "Field containing session IDs",
          type: "String",
          //required: true,
          attributes: {
            calcOptions: ["table_name", sess_options],
          },
        },
        {
          name: "user_field",
          label: "User field",
          sublabel:
            "Key to users field which will be filled from matching session ID",
          type: "String",
          //required: true,
          attributes: {
            calcOptions: ["table_name", user_options],
          },
        },
      ];
    },
    run: async ({
      row,
      configuration: { table_name, session_field, user_field },
      user,
    }) => {
      if (!row?.old_session_id || !user || !session_field || !user_field)
        return;
      const table = Table.findOne({ name: table_name });
      const rows = await table.getRows({
        [session_field]: row.old_session_id,
        [user_field]: null,
      });
      for (const dbrow of rows) {
        await table.updateRow({ [user_field]: user.id }, dbrow[table.pk_name]);
      }
    },
    namespace: "Database",
  },

  download_file_to_browser: {
    description: "Download a file to the user's browser",
    configFields: async ({ table, mode }) => {
      if (mode === "workflow") {
        return [
          {
            name: "filepath_expr",
            label: "File path",
            class: "validate-expression",
            sublabel:
              'JavaScript expression, based on the context, for the file path within the file store. If giving a literal filename, enclose in quotes: "myfile.zip"',
            type: "String",
          },
        ];
      }
      let field_opts = [];
      if (table) {
        field_opts = table.fields
          .filter((f) => f.type === "File")
          .map((f) => f.name);
      }
      return [
        {
          name: "file_field",
          label: "File field",
          type: "String",
          required: true,
          attributes: { options: field_opts },
        },
      ];
    },
    run: async ({
      row,
      configuration: { filepath_expr, file_field },
      user,
      mode,
    }) => {
      let filepath;
      if (mode === "workflow") {
        filepath = eval_expression(
          filepath_expr,
          row,
          user,
          "download filepath formula"
        );
      } else filepath = row[file_field];
      if (!filepath) return;
      const file = await File.findOne(filepath);
      return {
        download: {
          filename: file.filename,
          mimetype: file.mimetype,
          blob: await file.get_contents("base64"),
        },
      };
    },
  },

  install_progressive_web_app: {
    description: "Install a Progressive Web Application",
    configFields: () => [],
    run: async ({ req }) => {
      const pwaEnabled = await getState().getConfig("pwa_enabled", false);
      return pwaEnabled
        ? { eval_js: "installPWA()" }
        : { error: req.__("Progressive Web Application is not enabled") };
    },
  },
};
