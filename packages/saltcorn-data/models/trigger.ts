/**
 * Trigger Data Access Layer
 * @category saltcorn-data
 * @module models/trigger
 * @subcategory models
 */

import { comparingCaseInsensitiveValue, satisfies, mergeActionResults, cloneName, isNode } from "../utils.js";
import { getState } from "../db/state.js";
import { eval_expression } from "./expression.js";
import Table from "./table.js";
import WorkflowStep from "./workflow_step.js";
import workflowRunMod from "./workflow_run.js";
import * as nsState from "../db/state.js";
import db from "../db/index.js";
import EventLog from "./eventlog.js";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import type {
  TriggerCfg,
  AbstractTrigger,
} from "@saltcorn/types/model-abstracts/abstract_trigger";
import Crash from "./crash.js";
import type Tag from "./tag.js";
import { AbstractTag } from "@saltcorn/types/model-abstracts/abstract_tag";
import User from "./user.js";
import type { Action } from "@saltcorn/types/base_types";

declare const saltcorn: any;

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
  updated_at?: Date;
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
    this.updated_at = ["string", "number"].includes(typeof o.updated_at)
      ? new Date(o.updated_at as any)
      : o.updated_at;
  }

  /**
   * Get JSON from Trigger
   * @type {{when_trigger, configuration: any, name, description, action}}
   */
  get toJson(): any {
    let table_name = this.table_name;
    if (!table_name && this.table_id) {
      const table = Table.findOne(+this.table_id)!;
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
    return getState()!.triggers.filter(satisfies(where));
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

    const sql = `select a.id, a.name, a.action, t.name as table_name, a. when_trigger, a.channel, a.updated_at, a.min_role 
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
    return getState()!.triggers.find(
      where.id ? (v: Trigger) => v.id === +where.id : satisfies(where)
    );
  }

  static async state_refresh() {
    await nsState.getState()!.refresh_triggers();
  }

  /**
   * Update trigger
   * @param id
   * @param row
   * @returns {Promise<void>}
   */
  static async update(id: number, row: Row): Promise<void> {
    getState()!.log(6, `Update trigger ID=${id} Row=${JSON.stringify(row)}`);
    if (row.table_id === "") row.table_id = null;
    await db.update("_sc_triggers", { ...row, updated_at: new Date() }, id);
    if (!db.getRequestContext()?.client)
      await nsState.getState()!.refresh_triggers(true);
  }

  /**
   * Create trigger
   * @param f
   * @returns {Promise<Trigger>}
   */
  static async create(f: TriggerCfg): Promise<Trigger> {
    const trigger = new Trigger(f);
    trigger.updated_at = new Date();
    const { id, table_name, ...rest } = trigger;
    if (table_name && !rest.table_id) {
      const table = Table.findOne(table_name)!;
      rest.table_id = table.id;
    }
    trigger.id = await db.insert("_sc_triggers", rest);
    if (!db.getRequestContext()?.client)
      await nsState.getState()!.refresh_triggers(true);
    return trigger;
  }

  /**
   * Delete current trigger
   * @returns {Promise<void>}
   */
  async delete(): Promise<void> {
    // delete tag entries from _sc_tag_entries
    await db.deleteWhere("_sc_workflow_runs", { trigger_id: this.id });
    await db.deleteWhere("_sc_workflow_steps", { trigger_id: this.id });
    await db.deleteWhere("_sc_tag_entries", { trigger_id: this.id });
    await db.deleteWhere("_sc_triggers", { id: this.id });
    if (!db.getRequestContext()?.client)
      await nsState.getState()!.refresh_triggers(true);
  }

  static async sendEventToServer(
    eventType: string,
    channel: string | null = null,
    user = {},
    payload?: any
  ) {
    await saltcorn.mobileApp.api.apiCall({
      method: "POST",
      path: `/api/emit-event/${eventType}`,
      body: {
        channel,
        user, // password is not set on mobile
        payload,
      },
    });
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
    userPW: User | object = {},
    payload?: any
  ): void {
    if (
      !isNode() &&
      !nsState.getState()!.mobileConfig?.isOfflineMode
    ) {
      Trigger.sendEventToServer(eventType, channel, userPW, payload);
      return;
    }
    setTimeout(async () => {
      const { password, ...user } = (userPW || {}) as User;
      if (!getState) return; // probably in a test
      const findArgs: Where = { when_trigger: eventType };
      const state = getState()!;
      state.log(5, `Event ${eventType} ${channel} ${JSON.stringify(payload)}`);
      let table;
      if (
        channel &&
        ["Insert", "Update", "Delete", "Validate"].includes(channel)
      ) {
        table = Table.findOne({ name: channel });
        findArgs.table_id = table!.id;
      } else if (channel) findArgs.channel = { in: ["", channel] };
      const virtual_triggers = getState()!.virtual_triggers.filter(
        (tr: Trigger) =>
          eventType === tr.when_trigger &&
          (tr.channel === channel || !tr.channel)
      );

      const triggers = [...Trigger.find(findArgs), ...virtual_triggers];

      for (const trigger of triggers) {
        state.log(4, `Trigger run ${trigger.name} ${trigger.action} `);
        try {
          if (trigger.action === "Workflow") {
            const wfrun = await workflowRunMod.create({
              trigger_id: trigger.id!,
              context: payload,
              started_by: user?.id || undefined,
            });
            await wfrun.run({ user: user as any });
          } else if (trigger.action === "Multi-step action") {
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
            if (trigger.configuration?._only_if) {
              if (trigger.haltOnOnlyIf(payload, user)) {
                state.log(
                  4,
                  `Trigger "${trigger.name}" skipped due to _only_if condition.`
                );
                continue;
              }
            }
            const action = state.actions[trigger.action];
            if (action?.run)
              await action.run({
                table,
                channel,
                user,
                configuration: trigger.configuration,
                row: payload,
                ...(payload || {}),
              });
            else if (trigger.run) await trigger.run(payload);
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
        payload: payload,
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
    table: Table | null,
    row: Row,
    resultCollector?: any,
    user?: Row,
    extraArgs?: any
  ): Promise<void> {
    const triggers = Trigger.getTableTriggers(when_trigger, table, user);
    const state = getState()!;
    for (const trigger of triggers) {
      state.log(
        4,
        `Trigger run ${trigger.name} ${trigger.action} on ${when_trigger} ${table?.name} id=${row?.id}`
      );

      try {
        // Halt if _only_if condition evaluates to falsy
        if (
          trigger.haltOnOnlyIf?.(
            { ...row, ...extraArgs },
            user || extraArgs?.user
          )
        ) {
          state.log(
            4,
            `Trigger "${trigger.name}" skipped due to _only_if condition.`
          );
          continue;
        }
        if (extraArgs) extraArgs.user = extraArgs.user || user;
        else if (user) extraArgs = { user };
        const res = await trigger.run!(row, extraArgs); // getTableTriggers ensures run is set
        if (res && resultCollector) mergeActionResults(resultCollector, res);
      } catch (e: any) {
        if (resultCollector)
          resultCollector.error = (resultCollector.error || "") + e.message;
        Crash.create(e, {
          url: "/",
          headers: { when_trigger, table: table?.name, trigger: trigger.name },
        });
      }
    }
    //intentionally omit await
    EventLog.create({
      event_type: when_trigger,
      channel: table?.name,
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
    const state = getState()!;
    state.log(4, `Trigger run ${this.name} ${this.action} no row`);
    const table = this.table_id
      ? Table.findOne({ id: this.table_id })
      : undefined;

    // Halt if _only_if condition evaluates to falsy
    if (
      this.haltOnOnlyIf(
        { ...runargs.row, old_row: runargs.old_row },
        runargs.user
      )
    ) {
      state.log(4, `Trigger "${this.name}" skipped due to _only_if condition.`);
      return;
    }

    if (this.action === "Workflow") {
      const user = runargs?.user || runargs?.req?.user;
      const wfrun = await workflowRunMod.create({
        trigger_id: this.id!,
        context: runargs?.row || undefined,
        started_by: user?.id,
      });
      const runResult = await wfrun.run({
        user,
        interactive: runargs?.interactive,
        trace: this.configuration?.save_traces,
        req: runargs?.req,
      });
      if (runResult && typeof runResult === "object")
        runResult.__wf_run_id = wfrun.id;
      return runResult;
    } else if (this.action === "Multi-step action") {
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
            action = getState()!.actions[trigger.action];
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
          trigger_id: this.id,
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
    if (action) {
      return (
        action.run &&
        action.run({
          table,
          ...runargs,
          configuration: this.configuration,
          trigger_id: this.id,
        })
      );
    }
    // trigger.action may reference another trigger by name
    const refTrigger = Trigger.findOne({ name: this.action });
    if (refTrigger) {
      return await refTrigger.runWithoutRow(runargs);
    }
    state.log(2, `Action not found: ${this.action}`);
  }

  /**
   * Check if the trigger should halt based on the _only_if condition.
   * @param row - The current (new) row data, potentially merged with extra trigger arguments.
   * @param user - The user data.
   * @returns {boolean} - Returns true if the _only_if condition exists and evaluates to falsy.
   */
  haltOnOnlyIf(row: Row, user?: Row): boolean {
    if (this.configuration?._only_if) {
      return !eval_expression(
        this.configuration._only_if,
        row || {},
        user || {},
        "Trigger _only_if condition"
      );
    }
    return false;
  }

  static setRunFunctions(
    triggers: Array<Trigger>,
    table: Table | null,
    user?: Row
  ) {
    for (const trigger of triggers) {
      if (
        trigger.action === "Multi-step action" ||
        trigger.action === "Workflow"
      ) {
        trigger.run = (row: Row, extraArgs?: any) =>
          trigger.runWithoutRow({
            user,
            table,
            row,
            trigger_id: trigger.id,
            ...row,
            ...(extraArgs || {}),
          });
      } else {
        const action = getState()!.actions[trigger.action];
        if (action) {
          trigger.run = (row: Row, extraArgs?: any) =>
            action.run &&
            action.run({
              table,
              user,
              configuration: trigger.configuration,
              trigger_id: trigger.id,
              row,
              ...row,
              ...(extraArgs || {}),
            });
        } else {
          // trigger.action references another trigger by name
          trigger.run = (row: Row, extraArgs?: any) =>
            trigger.runWithoutRow({
              user,
              table,
              row,
              trigger_id: trigger.id,
              ...row,
              ...(extraArgs || {}),
            });
        }
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
    table: Table | null,
    user?: Row
  ): Trigger[] {
    const triggers = Trigger.find({
      when_trigger,
      ...(table ? { table_id: table.id } : {}),
    });
    Trigger.setRunFunctions(triggers, table, user);
    const virtual_triggers = getState()!.virtual_triggers.filter(
      (tr: Trigger) =>
        when_trigger === tr.when_trigger && tr.table_id == table?.id
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
    const triggers = Trigger.find({ when_trigger, table_id: table.id });
    const virtual_triggers = getState()!.virtual_triggers.filter(
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
    const triggers = Trigger.find({ table_id: table.id });
    Trigger.setRunFunctions(triggers, table);
    const virtual_triggers = getState()!.virtual_triggers.filter(
      (tr: Trigger) => tr.table_id == table.id
    );
    return [...triggers, ...virtual_triggers];
  }

  /**
   * Trigger when options
   * @type {string[]}
   */
  static get when_options(): string[] {

    return [
      "Never",
      "Insert",
      "Update",
      "Validate",
      "Delete",
      "Weekly",
      "Daily",
      "Hourly",
      "Often",
      "API call",
      "PageLoad",
      "Login",
      "LoginFailed",
      "Error",
      "Startup",
      "UserVerified",
      "ReceiveMobileShareData",
      "AppChange",
      ...Object.keys(getState()!.eventTypes),
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
      existingNames.map((v) => v.name) as string[]
    );

    const createObj = {
      ...this,
      name: newname,
    };
    delete createObj.id;
    const trig = await Trigger.create(createObj);
    if (trig.action === "Workflow") {
      const steps = await WorkflowStep.find({ trigger_id: this.id });
      for (const step of steps) {
        const { id, trigger_id, ...stepNoId } = step;
        await WorkflowStep.create({ ...stepNoId, trigger_id: trig.id! });
      }
    }
    return trig;
  }

  async getTags(): Promise<Array<AbstractTag>> {
    const Tag = (await import("./tag.js")).default;
    return await Tag.findWithEntries({ trigger_id: this.id });
  }

  /**
   * Checks plugin `authorize_trigger` hooks. Combine with the caller's own
   * role/min_role check, e.g. `role <= trigger.min_role || (await trigger.authorize(...))`.
   * @param user - the acting user (or undefined/public)
   * @param opts.action - "get" or "post"
   * @param opts.req - the request object, forwarded to hooks
   * @param opts.state - query/state, for action "get"
   * @param opts.body - POST body, for action "post"
   * @returns {Promise<boolean>}
   */
  async authorize(
    user: any,
    opts: {
      action: "get" | "post";
      req: any;
      state?: Row;
      body?: Row;
    }
  ): Promise<boolean> {
    const result = await getState()!.runAuthorizeAccess(
      {
        kind: "trigger",
        action: opts.action,
        name: this.name,
        trigger: this,
        state: opts.state,
        body: opts.body,
        req: opts.req,
      },
      user
    );
    return result.decision === "allow";
  }

  static get abbreviated_actions() {

    return Object.entries(getState()!.actions)
      .filter(([k, v]: [string, any]) => !v.disableIf || !v.disableIf())
      .map(([k, v]: [string, any]) => {
        const hasConfig = !!v.configFields;
        const requireRow = !!v.requireRow;
        const disableInWorkflow = !!v.disableInWorkflow;
        const disableInBuilder = !!v.disableInBuilder;
        return {
          name: k,
          hasConfig,
          requireRow,
          disableInWorkflow,
          disableInBuilder,
          namespace: v.namespace,
        };
      });
  }

  static actionsNotRequiringRow(): string[] {
    const result = [];
    for (const [name, action] of Object.entries(getState()!.actions) as [
      string,
      Action,
    ][]) {
      if (action.requireRow === false) {
        result.push(name);
      }
    }
    return result;
  }

  static trigger_actions({
    tableTriggers,
    apiNeverTriggers,
    allTriggers,
    noWorkflows,
    onlyWorkflows,
  }: {
    tableTriggers?: number;
    apiNeverTriggers?: boolean;
    allTriggers?: boolean;
    noWorkflows?: boolean;
    onlyWorkflows?: boolean;
  }): string[] {
    let triggerActions: Array<string> = [];
    if (tableTriggers) {
      const trs = Trigger.find({
        table_id: tableTriggers,
      });
      triggerActions = trs
        .filter((t) => !noWorkflows || t.action !== "Workflow")
        .filter((t) => !onlyWorkflows || t.action === "Workflow")
        .map((tr) => tr.name as string);
    }
    if (apiNeverTriggers) {
      const trs = Trigger.find({
        when_trigger: { or: ["API call", "Never"] },
        table_id: null,
      });

      const idLookup = new Set(trs.map((t) => t.id));
      const triggersNotRequiringRow = Trigger.find({
        when_trigger: { or: ["API call", "Never"] },
        action: { in: Trigger.actionsNotRequiringRow() },
      }).filter((t) => !idLookup.has(t.id));

      triggerActions = [
        ...triggerActions,
        ...[...trs, ...triggersNotRequiringRow]
          .filter((t) => !noWorkflows || t.action !== "Workflow")
          .filter((t) => !onlyWorkflows || t.action === "Workflow")
          .map((tr) => tr.name as string),
      ];
    }
    if (allTriggers) {
      const existing = new Set(triggerActions);
      const others = Trigger.find({})
        .filter((t) => !noWorkflows || t.action !== "Workflow")
        .filter((t) => !onlyWorkflows || t.action === "Workflow")
        .map((tr) => tr.name as string)
        .filter((name) => Boolean(name) && !existing.has(name));
      triggerActions = [...triggerActions, ...others];
    }

    return triggerActions.sort(comparingCaseInsensitiveValue);
  }

  static action_explainers(): Record<string, string> {
    const actionExplainers: Record<string, string> = {};
    Object.entries(getState()!.actions).map(([k, v]: [string, any]) => {
      if (v.description) actionExplainers[k] = v.description;
    });
    return actionExplainers;
  }

  static action_options({
    notRequireRow,
    tableTriggers,
    apiNeverTriggers,
    allTriggers,
    builtIns,
    builtInLabel,
    workflow,
    noMultiStep,
    forWorkflow,
    forBuilder,
  }: {
    notRequireRow?: boolean;
    tableTriggers?: number;
    apiNeverTriggers?: boolean;
    allTriggers?: boolean;
    builtIns?: string[];
    builtInLabel?: string;
    workflow?: boolean;
    noMultiStep?: boolean;
    forWorkflow?: boolean;
    forBuilder?: boolean;
  }): any[] {
    const triggerActions = Trigger.trigger_actions({
      tableTriggers,
      apiNeverTriggers,
      allTriggers,
      noWorkflows: !!forWorkflow,
    });
    const actions = forWorkflow
      ? Trigger.abbreviated_actions.filter((a) => !a.disableInWorkflow)
      : forBuilder
        ? Trigger.abbreviated_actions.filter((a) => !a.disableInBuilder)
        : Trigger.abbreviated_actions;
    const action_namespaces = [...new Set(actions.map((a) => a.namespace))]
      .filter(Boolean) //Other last
      .sort();
    if (builtInLabel) action_namespaces.unshift(builtInLabel);

    if (triggerActions.length) action_namespaces.push("Triggers");
    let wfs: string[] = [];

    if (forWorkflow) {
      wfs = Trigger.find({ action: "Workflow" })
        .map((wf) => wf.name)
        .filter(Boolean) as string[];
      wfs.sort(comparingCaseInsensitiveValue);
      if (wfs.length) action_namespaces.push("Workflows");
    }

    action_namespaces.push("Other");

    const acts: any[] = action_namespaces.map((ns) => {
      if (ns === "Triggers")
        return { optgroup: true, label: ns, options: triggerActions };
      if (ns === builtInLabel)
        return { optgroup: true, label: builtInLabel, options: builtIns || [] };

      const options = actions
        .filter(
          (a) =>
            (ns === "Other" ? !a.namespace : a.namespace === ns) &&
            (!notRequireRow || !a.requireRow || forWorkflow)
        )
        .map((t) => t.name)
        .sort();
      if (ns === "Other" && !noMultiStep) options.push("Multi-step action");
      //if (ns === "Other" && workflow) options.push("Workflow");
      if (ns === "Workflows") {
        options.push(...wfs);
      }
      return { optgroup: true, label: ns, options };
    });
    if (workflow) {
      acts.unshift({
        name: "",
        value: "",
        disabled: true,
        label: "Single action:",
      });
      acts.unshift("Workflow");
    }

    return acts;
  }
}

export default Trigger;
