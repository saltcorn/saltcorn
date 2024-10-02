/**
 * Trigger Data Access Layer
 * @category saltcorn-data
 * @module models/trigger
 * @subcategory models
 */

import db = require("../db");
import EventLog from "./eventlog";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import type {
  TriggerCfg,
  AbstractTrigger,
} from "@saltcorn/types/model-abstracts/abstract_trigger";
import Crash = require("./crash");
import { AbstractTable as Table } from "@saltcorn/types/model-abstracts/abstract_table";
const {
  comparingCaseInsensitiveValue,
  satisfies,
  mergeActionResults,
  cloneName,
} = require("../utils");
import type Tag from "./tag";
import { AbstractTag } from "@saltcorn/types/model-abstracts/abstract_tag";
import expression from "./expression";
const { eval_expression } = expression;

/**
 * Trigger class
 * @category saltcorn-data
 */
class Trigger implements AbstractTrigger {
  name?: string;
  action: string;
  description?: string;
  table_id?: number | null;
  table_name?: string;
  when_trigger: string;
  channel?: string;
  id?: number | null;
  configuration: any;
  min_role?: number;
  run?: (row: Row, extraArgs?: any) => Promise<any>;

  /**
   * Trigger constructor
   * @param {object} o
   */
  constructor(o: TriggerCfg) {
    this.name = o.name;
    this.action = o.action;
    this.description = o.description;
    this.table_id = !o.table_id ? null : +o.table_id;
    this.table_name = o.table_name;
    if (o.table) {
      this.table_id = o.table.id;
      this.table_name = o.table.name;
    }
    this.when_trigger = o.when_trigger;
    this.channel = o.channel;
    this.id = !o.id ? null : +o.id;
    this.configuration =
      typeof o.configuration === "string"
        ? JSON.parse(o.configuration)
        : o.configuration || {};
    this.min_role = !o.min_role ? 100 : +o.min_role;
  }

  /**
   * Get JSON from Trigger
   * @type {{when_trigger, configuration: any, name, description, action}}
   */
  get toJson(): any {
    let table_name = this.table_name;
    if (!table_name && this.table_id) {
      const Table = require("./table");
      const table = Table.findOne(+this.table_id);
      table_name = table.name;
    }
    return {
      name: this.name,
      description: this.description,
      action: this.action,
      when_trigger: this.when_trigger,
      configuration: this.configuration,
      table_name,
      channel: this.channel,
      min_role: this.min_role,
    };
  }

  /**
   * Find triggers in State cache
   * @param where - condition
   * @returns {Trigger[]}
   */
  static find(where?: Where): Trigger[] {
    const { getState } = require("../db/state");
    return getState().triggers.filter(satisfies(where));
  }

  /**
   * Find triggers in DB
   * @param where
   * @param selectopts
   * @returns {Promise<Trigger[]>}
   */
  static async findDB(
    where?: Where,
    selectopts?: SelectOptions
  ): Promise<Trigger[]> {
    const db_flds = await db.select("_sc_triggers", where, selectopts);
    return db_flds.map((dbf: TriggerCfg) => new Trigger(dbf));
  }

  /**
   * Find all triggers
   * @returns {Promise<Trigger[]>}
   */
  static async findAllWithTableName(): Promise<Trigger[]> {
    const schema = db.getTenantSchemaPrefix();

    const sql = `select a.id, a.name, a.action, t.name as table_name, a. when_trigger, a.channel, a.min_role 
    from ${schema}_sc_triggers a left join ${schema}_sc_tables t on t.id=table_id order by lower(a.name)`;
    const { rows } = await db.query(sql);
    return rows.map((dbf: any) => new Trigger(dbf));
  }

  /**
   * Find one trigger in State cache
   * @param where
   * @returns {Trigger}
   */
  static findOne(where: Where) {
    const { getState } = require("../db/state");
    return getState().triggers.find(
      where.id ? (v: Trigger) => v.id === +where.id : satisfies(where)
    );
  }

  /**
   * Update trigger
   * @param id
   * @param row
   * @returns {Promise<void>}
   */
  static async update(id: number, row: Row): Promise<void> {
    const { getState } = require("../db/state");
    getState().log(6, `Update trigger ID=${id} Row=${JSON.stringify(row)}`);
    if (row.table_id === "") row.table_id = null;
    await db.update("_sc_triggers", row, id);
    await require("../db/state").getState().refresh_triggers();
  }

  /**
   * Create trigger
   * @param f
   * @returns {Promise<Trigger>}
   */
  static async create(f: TriggerCfg): Promise<Trigger> {
    const trigger = new Trigger(f);
    const { id, table_name, ...rest } = trigger;
    if (table_name && !rest.table_id) {
      const Table = require("./table");
      const table = Table.findOne(table_name);
      rest.table_id = table.id;
    }
    trigger.id = await db.insert("_sc_triggers", rest);
    await require("../db/state").getState().refresh_triggers();
    return trigger;
  }

  /**
   * Delete current trigger
   * @returns {Promise<void>}
   */
  async delete(): Promise<void> {
    // delete tag entries from _sc_tag_entries
    await db.deleteWhere("_sc_tag_entries", { trigger_id: this.id });
    await db.deleteWhere("_sc_triggers", { id: this.id });
    await require("../db/state").getState().refresh_triggers();
  }

  /**
   * Emit an event: run associated triggers
   * @param {*} eventType
   * @param {*} channel
   * @param {object} [userPW = {}]
   * @param {*} payload
   */
  static emitEvent(
    eventType: string,
    channel: string | null = null,
    userPW = {},
    payload?: any
  ): void {
    setTimeout(async () => {
      const { password, ...user }: any = userPW || {};
      const { getState } = require("../db/state");
      const findArgs: Where = { when_trigger: eventType };
      const state = getState();
      state.log(5, `Event ${eventType} ${channel} ${JSON.stringify(payload)}`);
      let table;
      if (
        channel &&
        ["Insert", "Update", "Delete", "Validate"].includes(channel)
      ) {
        const Table = require("./table");
        table = Table.findOne({ name: channel });
        findArgs.table_id = table.id;
      } else if (channel) findArgs.channel = { in: ["", channel] };

      const triggers = Trigger.find(findArgs);

      for (const trigger of triggers) {
        state.log(4, `Trigger run ${trigger.name} ${trigger.action} `);
        try {
          if (trigger.action === "Multi-step action") {
            let step_count = 0;
            const MAX_STEPS = 200;
            for (
              let i = 0;
              i < trigger.configuration?.steps?.length &&
              step_count < MAX_STEPS;
              i++
            ) {
              step_count += 1;
              const step = trigger.configuration?.steps[i];
              if (step.step_only_if && payload)
                if (
                  !eval_expression(
                    step.step_only_if,
                    payload,
                    user,
                    "Multistep only if formula"
                  )
                )
                  continue;
              const stepAction = state.actions[step.step_action_name];
              const stepRes =
                stepAction && stepAction.run
                  ? await stepAction.run({
                      table,
                      channel,
                      user,
                      configuration: step,
                      row: payload,
                      ...(payload || {}),
                    })
                  : null;
              if (stepRes?.goto_step) i = +stepRes.goto_step - 2;
              if (stepRes?.set_fields && payload) {
                Object.entries(stepRes?.set_fields).forEach(([k, v]) => {
                  payload[k] = v;
                });
              }
            }
          } else {
            const action = state.actions[trigger.action];
            action &&
              action.run &&
              (await action.run({
                table,
                channel,
                user,
                configuration: trigger.configuration,
                row: payload,
                ...(payload || {}),
              }));
          }
        } catch (e) {
          Crash.create(e, {
            url: "/",
            headers: {
              eventType,
              trigger_name: trigger.name,
              action: trigger.action,
            },
          });
        }
      }
      //intentionally omit await
      EventLog.create({
        event_type: eventType,
        channel,
        user_id: (<any>(userPW || {})).id || null,
        payload: typeof payload === "string" ? { text: payload } : payload,
        occur_at: new Date(),
      });
    }, 0);
  }

  /**
   * Run table triggers
   * @param when_trigger
   * @param table
   * @param row
   * @returns {Promise<void>}
   */
  static async runTableTriggers(
    when_trigger: string,
    table: Table,
    row: Row,
    resultCollector?: any,
    user?: Row,
    extraArgs?: any
  ): Promise<void> {
    const triggers = Trigger.getTableTriggers(when_trigger, table, user);
    const { getState } = require("../db/state");
    const state = getState();
    for (const trigger of triggers) {
      state.log(
        4,
        `Trigger run ${trigger.name} ${trigger.action} on ${when_trigger} ${table.name} id=${row?.id}`
      );

      try {
        const res = await trigger.run!(row, extraArgs); // getTableTriggers ensures run is set
        if (res && resultCollector) mergeActionResults(resultCollector, res);
      } catch (e: any) {
        if (resultCollector)
          resultCollector.error = (resultCollector.error || "") + e.message;
        Crash.create(e, {
          url: "/",
          headers: { when_trigger, table: table.name, trigger: trigger.name },
        });
      }
    }
    //intentionally omit await
    EventLog.create({
      event_type: when_trigger,
      channel: table.name,
      user_id: user?.id,
      payload: row,
      occur_at: new Date(),
    });
  }

  /**
   * Run trigger without row
   * @param runargs
   * @returns {Promise<any>}
   */
  async runWithoutRow(runargs: any = {}): Promise<any> {
    const { getState } = require("../db/state");
    const state = getState();
    state.log(4, `Trigger run ${this.name} ${this.action} no row`);
    const table = this.table_id
      ? require("./table").findOne({ id: this.table_id })
      : undefined;
    if (this.action === "Multi-step action") {
      let result: any = {};
      let step_count = 0;
      let MAX_STEPS = 200;
      for (
        let i = 0;
        i < this.configuration?.steps?.length && step_count < MAX_STEPS;
        i++
      ) {
        step_count += 1;
        const step = this.configuration?.steps[i];
        if (step.step_only_if && runargs?.row)
          if (
            !eval_expression(
              step.step_only_if,
              runargs.row,
              undefined,
              "Multistep only if formula"
            )
          )
            continue;

        let configuration = step;
        let action = state.actions[step.step_action_name];

        if (!action) {
          const trigger = await Trigger.findOne({
            name: step.step_action_name,
          });
          if (trigger) {
            action = getState().actions[trigger.action];
            configuration = trigger.configuration;
          }
        }
        if (!action)
          throw new Error(
            "Runnable action not found: " + step.step_action_name
          );
        state.log(
          6,
          `Multistep step ${i} (step count ${step_count}) action ${step.step_action_name}`
        );
        const stepres = await action.run({
          table,
          ...runargs,
          configuration,
        });
        state.log(6, `Multistep step result ${JSON.stringify(stepres)}`);
        if (stepres?.goto_step) {
          i = +stepres.goto_step - 2;
          delete stepres.goto_step;
        }
        if (stepres?.clear_return_values) result = {};
        if (stepres?.set_fields && runargs?.row) {
          Object.entries(stepres?.set_fields).forEach(([k, v]) => {
            runargs.row[k] = v;
          });
        }
        try {
          mergeActionResults(result, stepres);
        } catch (error) {
          console.error(error);
        }
        if (result.error || result.halt_steps) break;
      }
      return result;
    }
    const action = state.actions[this.action];
    return (
      action &&
      action.run &&
      action.run({
        table,
        ...runargs,
        configuration: this.configuration,
      })
    );
  }

  static setRunFunctions(triggers: Array<Trigger>, table: Table, user?: Row) {
    const { getState } = require("../db/state");
    for (const trigger of triggers) {
      if (trigger.action === "Multi-step action") {
        trigger.run = (row: Row, extraArgs?: any) =>
          trigger.runWithoutRow({
            user,
            table,
            row,
            ...row,
            ...(extraArgs || {}),
          });
      } else {
        const action = getState().actions[trigger.action];
        trigger.run = (row: Row, extraArgs?: any) =>
          action &&
          action.run &&
          action.run({
            table,
            user,
            configuration: trigger.configuration,
            row,
            ...row,
            ...(extraArgs || {}),
          });
      }
    }
  }

  /**
   * get triggers
   * @param when_trigger
   * @param table
   * @returns {Trigger[]}
   */
  static getTableTriggers(
    when_trigger: string,
    table: Table,
    user?: Row
  ): Trigger[] {
    const { getState } = require("../db/state");
    const triggers = Trigger.find({ when_trigger, table_id: table.id });
    Trigger.setRunFunctions(triggers, table, user);
    const virtual_triggers = getState().virtual_triggers.filter(
      (tr: Trigger) =>
        when_trigger === tr.when_trigger && tr.table_id == table.id
    );
    return [...triggers, ...virtual_triggers];
  }
  /**
   * get triggers
   * @param when_trigger
   * @param table
   * @returns {boolean}
   */
  static hasTableTriggers(when_trigger: string, table: Table): boolean {
    const { getState } = require("../db/state");
    const triggers = Trigger.find({ when_trigger, table_id: table.id });
    const virtual_triggers = getState().virtual_triggers.filter(
      (tr: Trigger) =>
        when_trigger === tr.when_trigger && tr.table_id == table.id
    );
    return triggers.length + virtual_triggers.length > 0;
  }

  /**
   * get triggers for a table with all when options
   * @param table
   * @returns {Trigger[]}
   */
  static getAllTableTriggers(table: Table): Trigger[] {
    const { getState } = require("../db/state");
    const triggers = Trigger.find({ table_id: table.id });
    Trigger.setRunFunctions(triggers, table);
    const virtual_triggers = getState().virtual_triggers.filter(
      (tr: Trigger) => tr.table_id == table.id
    );
    return [...triggers, ...virtual_triggers];
  }

  /**
   * Trigger when options
   * @type {string[]}
   */
  static get when_options(): string[] {
    const { getState } = require("../db/state");

    return [
      "Insert",
      "Update",
      "Validate",
      "Delete",
      "Weekly",
      "Daily",
      "Hourly",
      "Often",
      "API call",
      "Never",
      "PageLoad",
      "Login",
      "LoginFailed",
      "Error",
      "Startup",
      "UserVerified",
      ...Object.keys(getState().eventTypes),
    ];
  }

  /**
   * Clone page
   * @returns {Promise<Trigger>}
   */
  async clone(): Promise<Trigger> {
    const myname = this.name || "Trigger";
    const existingNames = Trigger.find({}).filter((t) =>
      (t.name || "").startsWith(myname)
    );
    const newname = cloneName(
      myname,
      existingNames.map((v) => v.name)
    );

    const createObj = {
      ...this,
      name: newname,
    };
    delete createObj.id;
    return await Trigger.create(createObj);
  }

  async getTags(): Promise<Array<AbstractTag>> {
    const Tag = (await import("./tag")).default;
    return await Tag.findWithEntries({ trigger_id: this.id });
  }

  static get abbreviated_actions() {
    const { getState } = require("../db/state");

    return Object.entries(getState().actions).map(([k, v]: [string, any]) => {
      const hasConfig = !!v.configFields;
      const requireRow = !!v.requireRow;
      return {
        name: k,
        hasConfig,
        requireRow,
        namespace: v.namespace,
      };
    });
  }

  static trigger_actions({
    tableTriggers,
    apiNeverTriggers,
  }: {
    tableTriggers?: number;
    apiNeverTriggers?: boolean;
  }): string[] {
    let triggerActions: Array<string> = [];
    if (tableTriggers) {
      const trs = Trigger.find({
        table_id: tableTriggers,
      });
      triggerActions = trs.map((tr) => tr.name as string);
    }
    if (apiNeverTriggers) {
      const trs = Trigger.find({
        when_trigger: { or: ["API call", "Never"] },
        table_id: null,
      });
      triggerActions = [
        ...triggerActions,
        ...trs.map((tr) => tr.name as string),
      ];
    }

    return triggerActions.sort(comparingCaseInsensitiveValue);
  }

  static action_options({
    notRequireRow,
    tableTriggers,
    apiNeverTriggers,
    builtIns,
    builtInLabel,
  }: {
    notRequireRow?: boolean;
    tableTriggers?: number;
    apiNeverTriggers?: boolean;
    builtIns?: string[];
    builtInLabel?: string;
  }): any[] {
    const triggerActions = Trigger.trigger_actions({
      tableTriggers,
      apiNeverTriggers,
    });
    const actions = Trigger.abbreviated_actions;
    const action_namespaces = [...new Set(actions.map((a) => a.namespace))]
      .filter(Boolean) //Other last
      .sort();
    if (builtInLabel) action_namespaces.unshift(builtInLabel);
    if (triggerActions.length) action_namespaces.push("Triggers");

    action_namespaces.push("Other");

    return action_namespaces.map((ns) => {
      if (ns === "Triggers")
        return { optgroup: true, label: ns, options: triggerActions };
      if (ns === builtInLabel)
        return { optgroup: true, label: builtInLabel, options: builtIns || [] };

      const options = actions
        .filter(
          (a) =>
            (ns === "Other" ? !a.namespace : a.namespace === ns) &&
            (!notRequireRow || !a.requireRow)
        )
        .map((t) => t.name)
        .sort();
      if (ns === "Other") options.push("Multi-step action");
      return { optgroup: true, label: ns, options };
    });
  }
}

export = Trigger;
