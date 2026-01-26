/**
 * Packs
 * @category saltcorn-admin-models
 * @module pack
 */

import Table from "@saltcorn/data/models/table";
import db from "@saltcorn/data/db/index";
import View from "@saltcorn/data/models/view";
import Field from "@saltcorn/data/models/field";
import Trigger from "@saltcorn/data/models/trigger";
import WorkflowStep from "@saltcorn/data/models/workflow_step";
const { getState } = require("@saltcorn/data/db/state");
import fetch from "node-fetch";
import Page from "@saltcorn/data/models/page";
import PageGroup from "@saltcorn/data/models/page_group";
import type { AbstractPageGroupMember } from "@saltcorn/types/model-abstracts/abstract_page_group_member";
import TableConstraint from "@saltcorn/data/models/table_constraints";
import Role from "@saltcorn/data/models/role";
import Library from "@saltcorn/data/models/library";
import Tag from "@saltcorn/data/models/tag";
import TagEntry from "@saltcorn/data/models/tag_entry";
import Model from "@saltcorn/data/models/model";
import ModelInstance from "@saltcorn/data/models/model_instance";
import EventLog, { EventLogCfg } from "@saltcorn/data/models/eventlog";
import User from "@saltcorn/data/models/user";
import config from "@saltcorn/data/models/config";
import type { CodePagePack, Pack } from "@saltcorn/types/base_types";
import type { PagePack } from "@saltcorn/types/model-abstracts/abstract_page";
const { save_menu_items } = config;
import type Plugin from "@saltcorn/data/models/plugin";
import type { ViewPack } from "@saltcorn/types/model-abstracts/abstract_view";
import type { PageGroupPack } from "@saltcorn/types/model-abstracts/abstract_page_group";
import type { TablePack } from "@saltcorn/types/model-abstracts/abstract_table";
import type { PluginPack } from "@saltcorn/types/model-abstracts/abstract_plugin";
import type { LibraryPack } from "@saltcorn/types/model-abstracts/abstract_library";
import type { TriggerPack } from "@saltcorn/types/model-abstracts/abstract_trigger";
import type { RolePack } from "@saltcorn/types/model-abstracts/abstract_role";
import type { EventLogPack } from "@saltcorn/types/model-abstracts/abstract_event_log";
import type { ModelPack } from "@saltcorn/types/model-abstracts/abstract_model";
import type { ModelInstancePack } from "@saltcorn/types/model-abstracts/abstract_model_instance";
import type { TagPack } from "@saltcorn/types/model-abstracts/abstract_tag";
import { isEqual } from "lodash";

const { isStale, getFetchProxyOptions } = require("@saltcorn/data/utils");

/**
 * Table Pack
 * @function
 * @param nameOrTable
 */
const table_pack = async (nameOrTable: string | Table): Promise<TablePack> => {
  // todo check this change
  const table =
    typeof nameOrTable === "string"
      ? Table.findOne({ name: nameOrTable })
      : nameOrTable;
  if (!table) throw new Error(`Unable to find table '${nameOrTable}'`);

  const fields = table.getFields();
  const strip_ids = (o: any) => {
    delete o.id;
    delete o.table_id;
    return o;
  };
  //const triggers = await Trigger.find({ table_id: table.id });
  const constraints = await TableConstraint.find({ table_id: table.id });

  return {
    name: table.name,
    description: table.description,
    is_user_group: table.is_user_group,
    min_role_read: table.min_role_read,
    min_role_write: table.min_role_write,
    versioned: table.versioned,
    has_sync_info: table.has_sync_info,
    provider_name: table.provider_name,
    provider_cfg: table.provider_cfg,
    ownership_formula: table.ownership_formula,
    fields: fields.map((f) => strip_ids(f.toJson)),
    //triggers: triggers.map((tr) => tr.toJson),
    constraints: constraints.map((c) => c.toJson),
    ownership_field_name: table.owner_fieldname_from_fields
      ? table.owner_fieldname_from_fields(fields)
      : null,
  };
};

/**
 * View Pack
 * @param name
 */
const view_pack = async (name: string | View): Promise<ViewPack> => {
  const view = typeof name === "string" ? await View.findOne({ name }) : name;
  if (!view) throw new Error(`Unable to find view '${name}'`);
  const table = Table.findOne({ id: view.table_id });
  //if (!table)
  //  throw new Error(`Unable to find table with id '${view.table_id}'`);
  return {
    name: view.name,
    description: view.description,
    viewtemplate: view.viewtemplate,
    configuration: view.configuration,
    min_role: view.min_role,
    table: table ? table.name : null,
    menu_label: view.menu_label,
    slug: view.slug,
    attributes: view.attributes,
    default_render_page: view.default_render_page,
    exttable_name: view.exttable_name,
  };
};

/**
 * Plugin pack
 * @param name
 */
const plugin_pack = async (name: string): Promise<PluginPack> => {
  const Plugin = (await import("@saltcorn/data/models/plugin")).default;
  const plugin = await Plugin.findOne({ name });
  if (!plugin) throw new Error(`Unable to find plugin '${name}'`);
  const configuration = plugin.configuration
    ? { ...plugin.configuration }
    : null;
  if (configuration) {
    const state = getState();
    Object.keys(configuration).forEach((k) => {
      if (state.isFixedPluginConfig(name, k)) delete configuration[k];
    });
  }
  return {
    name: plugin.name,
    source: plugin.source,
    location: plugin.location,
    configuration,
    deploy_private_key: plugin.deploy_private_key,
    version: plugin.version || "latest",
  };
};

/**
 * Page Pack
 * @param name name of the page
 */
const page_pack = async (name: string | Page): Promise<PagePack> => {
  const page = typeof name === "string" ? Page.findOne({ name }) : name;
  if (!page) throw new Error(`Unable to find page '${name}'`);
  const root_page_for_roles = await page.is_root_page_for_roles();
  return {
    name: page.name,
    title: page.title,
    description: page.description,
    min_role: page.min_role,
    layout: page.layout,
    fixed_states: page.fixed_states,
    menu_label: page.menu_label,
    attributes: page.attributes,
    root_page_for_roles,
  };
};

/**
 * Page group pack (page_id is replaced by page_name)
 * @param name name of the page group
 */
const page_group_pack = async (name: string): Promise<PageGroupPack> => {
  const group = PageGroup.findOne({ name });
  if (!group) throw new Error(`Unable to find page group '${name}'`);
  return {
    name: group.name,
    description: group.description,
    min_role: group.min_role,
    random_allocation: group.random_allocation,
    members: group.members.map((m: AbstractPageGroupMember) => {
      // could get slow (caching ?)
      const page = Page.findOne({ id: m.page_id });
      if (!page) throw new Error(`Unable to find page '${m.page_id}'`);
      return {
        page_name: page.name,
        description: m.description,
        sequence: m.sequence,
        eligible_formula: m.eligible_formula,
      };
    }),
  };
};

/**
 * Library pack
 * @function
 * @param name
 */
const library_pack = async (name: string): Promise<LibraryPack> => {
  const lib = await Library.findOne({ name });
  return lib.toJson;
};

/**
 * Trigger pack
 * @param name
 */
const trigger_pack = async (name: string | Trigger): Promise<TriggerPack> => {
  const trig =
    typeof name === "string" ? await Trigger.findOne({ name }) : name;
  const pack = trig.toJson;
  if (trig.action === "Workflow") {
    const steps = await WorkflowStep.find({ trigger_id: trig.id });
    pack.steps = steps.map((step) => step.toJson);
  }
  return pack;
};

/**
 * Role pack
 * @function
 * @param {string} role
 * @returns {Promise<object>}
 */
const role_pack = async (role: string): Promise<RolePack> => {
  return await Role.findOne({ role });
};

/**
 * 'page/view/table/trigger' ids are replaced by names
 * @param name name of the tag
 * @returns
 */
const tag_pack = async (name: string | Tag): Promise<TagPack> => {
  const tag = typeof name === "string" ? await Tag.findOne({ name }) : name;
  if (!tag) throw new Error(`Unable to find tag '${name}'`);
  const entries = await tag.getEntries();
  const withNames = entries.map((e) => {
    const result: any = {};
    if (e.page_id) {
      const page = Page.findOne({ id: e.page_id });
      if (!page) throw new Error(`Unable to find page '${e.page_id}'`);
      result.page_name = page.name;
    }
    if (e.view_id) {
      const view = View.findOne({ id: e.view_id });
      if (!view) throw new Error(`Unable to find view '${e.view_id}'`);
      result.view_name = view.name;
    }
    if (e.table_id) {
      const table = Table.findOne({ id: e.table_id });
      if (!table) throw new Error(`Unable to find table '${e.table_id}'`);
      result.table_name = table.name;
    }
    if (e.trigger_id) {
      const trigger = Trigger.findOne({ id: e.trigger_id });
      if (!trigger) throw new Error(`Unable to find trigger '${e.trigger_id}'`);
      result.trigger_name = trigger.name;
    }
    return result;
  });
  return {
    name: tag.name,
    entries: withNames,
  };
};

/**
 * tableIds are replace by names
 * @param name name of model
 * @param tableName name of table the model is based on
 * @returns
 */
const model_pack = async (
  name: string,
  tableName: string
): Promise<ModelPack> => {
  const table = Table.findOne({ name: tableName });
  if (!table) throw new Error(`Model-table '${tableName}' not found`);
  const model = await Model.findOne({ name, table_id: table.id });
  if (!model) throw new Error(`Model '${name}' not found`);
  return model.toJson;
};

/**
 * the modelId gets replaced with modelName + tableName
 * @param instanceName
 * @param modelName
 * @param tableName
 * @returns
 */
const model_instance_pack = async (
  instanceName: string,
  modelName: string,
  tableName: string
): Promise<ModelInstancePack> => {
  const table = Table.findOne({ name: tableName });
  if (!table) throw new Error(`Model-table '${tableName}' not found`);
  const model = await Model.findOne({ name: modelName, table_id: table.id });
  if (!model) throw new Error(`Unable to find model '${modelName}'`);
  const instance = await ModelInstance.findOne({
    name: instanceName,
    model_id: model.id,
  });
  if (!instance)
    throw new Error(`Unable to find model instance '${instanceName}'`);
  const result = instance.toJson;
  if (result.model_id) delete result.model_id;
  result.model_name = model.name;
  result.table_name = table.name;
  return result;
};

/**
 * the userId gets replaced with userName
 * no lookup by name because either all eventlogs or none are packed
 * @param eventLog
 */
const event_log_pack = async (eventLog: EventLog): Promise<EventLogPack> => {
  const result = eventLog.toJson;
  if (result.user_id) {
    const userId = result.user_id;
    if (result.user_id) delete result.user_id;
    const user = await User.findOne({ id: userId });
    if (!user) throw new Error(`Unable to find user '${userId}'`);
    result.user_email = user.email;
  }
  return result;
};

/**
 * Can install pock
 * @param pack
 */
const can_install_pack = async (
  pack: Pack
): Promise<true | { error?: string; warning?: string }> => {
  const warns = new Array<string>();

  const allViews = (await View.find()).map((t) => ({
    name: t.name,
    table: Table.findOne({ id: t.table_id })?.name,
  }));

  for (const pt of pack.tables || []) {
    const matchTable = Table.findOne({ name: pt.name });
    if (!matchTable) continue;

    //failure conditions: existing field with different type (warn)

    pt.fields.forEach((f) => {
      const ex = matchTable.getField(f.name as string);
      if (ex && ex.type_name !== f.type) {
        warns.push(`Clashing field types for ${f.name} on table ${pt.name}`);
      }
    });
  }

  const matchViews = allViews.filter((dbt) =>
    (pack.views || []).some(
      (pv) => pv.name === dbt.name && dbt.table && pv.table !== dbt.table
    )
  );

  pack.tables.forEach((t) => {
    if (t.name === "users") {
      const userTable = Table.findOne({ name: "users" });
      t.fields.forEach((f) => {
        if (f.required) {
          const ex = userTable?.getField(f.name as string);
          if (!ex || !ex.required)
            warns.push(
              `User field '${f.name}' is required in pack, but there are existing users. You must set a value for each user and then change the field to be required. Got to <a href="/list/users">users table data</a>.`
            );
        }
      });
    }
  });
  matchViews.forEach((v) => {
    warns.push(`Clashing view ${v} on different tables.`);
  });
  if (warns.length > 0) return { warning: warns.join(" ") };
  else return true;
};

/**
 * Uninstall pack
 * @param pack
 * @param name
 */
const uninstall_pack = async (pack: Pack, name?: string): Promise<void> => {
  for (const pageGroupSpec of pack.page_groups || []) {
    const pageGroup = PageGroup.findOne({ name: pageGroupSpec.name });
    if (pageGroup) await pageGroup.delete();
  }
  for (const pageSpec of pack.pages || []) {
    const page = Page.findOne({ name: pageSpec.name });
    if (page) await page.delete();
  }
  for (const viewSpec of pack.views) {
    const view = View.findOne({ name: viewSpec.name });
    if (view) await view.delete();
  }
  for (const tableSpec of pack.tables) {
    const table = Table.findOne({ name: tableSpec.name });
    if (table && table.name === "users") continue;
    if (table) {
      const fields = table.getFields();
      for (const field of fields) {
        if (field.is_fkey) await field.delete();
      }
      const triggers = Trigger.find({ table_id: table.id });
      for (const trigger of triggers) {
        await trigger.delete();
      }
    }
  }
  for (const tableSpec of pack.tables) {
    const table = Table.findOne({ name: tableSpec.name });
    if (table && table.name !== "users") await table.delete();
  }

  if (name) {
    const existPacks = getState().getConfigCopy("installed_packs", []);

    await getState().setConfig(
      "installed_packs",
      existPacks.filter((p: string) => p !== name)
    );
  }
};

const old_to_new_role = (old_roleS: any) => {
  if (!old_roleS) return old_roleS;
  const old_role = +old_roleS;
  if (!old_role || isNaN(old_role)) return old_roleS;

  return old_role;
};

/**
 * @param item {label, type, viewname, pagename, min_role}
 */
const add_to_menu = async (item: {
  label: string;
  type: "View" | "Page";
  viewname?: string;
  pagename?: string;
  min_role: number;
}): Promise<void> => {
  item.min_role = old_to_new_role(item.min_role);
  const current_menu = getState().getConfigCopy("menu_items", []);
  const existing = current_menu.findIndex((m: any) => m.label === item.label);
  if (existing >= 0) {
    //current_menu[existing] = item;
    //do not change exisiting menu item
  } else current_menu.push(item);
  await save_menu_items(current_menu);
};

/**
 * @param pack
 * @param name
 * @param loadAndSaveNewPlugin
 * @param bare_tables
 */
const install_pack = async (
  pack: Pack,
  name: string | undefined,
  loadAndSaveNewPlugin: (arg0: Plugin) => void,
  bare_tables = false
): Promise<void> => {
  const Plugin = (await import("@saltcorn/data/models/plugin")).default;
  for (const plugin of pack.plugins) {
    if (plugin.source === "npm" && plugin.name.startsWith("@saltcorn/"))
      plugin.name = plugin.name.replace("@saltcorn/", "");
    const existingPlugins = await Plugin.find({});
    if (!existingPlugins.some((ep) => ep.name === plugin.name)) {
      // local plugins can crah
      try {
        const p = new Plugin(plugin);
        await loadAndSaveNewPlugin(p);
      } catch (e) {
        console.error("install pack plugin error:", e);
      }
    }
  }
  for (const role of pack.roles || []) {
    role.id = old_to_new_role(role.id);
    const existing = await Role.findOne({ id: role.id });
    if (existing) await existing.update(role);
    else await Role.create(role);
  }
  for (const lib of pack.library || []) {
    const exisiting = await Library.findOne({ name: lib.name });
    if (exisiting) await exisiting.update(lib);
    else await Library.create(lib);
  }
  // create tables (users skipped because created by other ways)

  // tables with a provider go last because they can depend on presence
  // of other tables
  const packTables = pack.tables.sort((left, right) =>
    left.provider_name ? 1 : right.provider_name ? -1 : 0
  );
  for (const tableSpec of packTables) {
    const {
      id,
      ownership_field_id,
      ownership_field_name,
      triggers,
      constraints,
      fields,
      ...updrow
    } = tableSpec;

    if (tableSpec.name !== "users") {
      let tbl_pk;
      const existing = Table.findOne({ name: tableSpec.name });
      getState().log(
        5,
        `Restoring table pack name=${
          tableSpec.name
        } existing=${!!existing} tenant=${db.getTenantSchema()}`
      );
      if (existing) {
        tbl_pk = await existing.getField(existing.pk_name);

        await existing.update(updrow);
      } else {
        tableSpec.min_role_read = old_to_new_role(tableSpec.min_role_read);
        tableSpec.min_role_write = old_to_new_role(tableSpec.min_role_write);
        const table = await Table.create(tableSpec.name, tableSpec);
        [tbl_pk] = table.getFields();
      } //set pk
      const pack_pk = tableSpec.fields.find((f) => f.primary_key);
      if (pack_pk && tbl_pk) {
        await tbl_pk.update(pack_pk);
      }
    } else {
      await User.table.update(updrow);
    }
  }
  await getState().refresh_tables(true);

  for (const tableSpec of pack.tables) {
    const _table = Table.findOne({ name: tableSpec.name });
    if (!_table) throw new Error(`Unable to find table '${tableSpec.name}'`);

    const exfields = _table.getFields();
    if (!_table.provider_name)
      for (const field of tableSpec.fields) {
        const exfield = exfields.find((f) => f.name === field.name);
        if (
          !(
            (_table.name === "users" &&
              (field.name === "email" || field.name === "role_id")) ||
            exfield
          )
        ) {
          if (_table.name === "users" && field.required)
            await Field.create(
              { table: _table, ...field, required: false },
              bare_tables
            );
          else await Field.create({ table: _table, ...field }, bare_tables);
        } else if (
          exfield &&
          !(
            _table.name === "users" &&
            (field.name === "email" || field.name === "role_id")
          ) &&
          exfield.type
        ) {
          const { id, table_id, ...updrow } = field;
          await exfield.update(updrow);
        }
      }
    for (const { table, ...trigger } of tableSpec.triggers || []) {
      trigger.min_role = old_to_new_role(trigger.min_role);
      await Trigger.create({ table: _table, ...trigger }); //legacy, not in new packs
    }
    const existing_constraints = _table.constraints;
    for (const constraint of tableSpec.constraints || []) {
      if (
        !existing_constraints.find(
          (excon) =>
            excon.type === constraint.type &&
            isEqual(excon.configuration, constraint.configuration)
        )
      )
        await TableConstraint.create({ table: _table, ...constraint });
    }
    if (tableSpec.ownership_field_name) {
      const owner_field = await Field.findOne({
        table_id: _table.id,
        name: tableSpec.ownership_field_name,
      });
      await _table.update({ ownership_field_id: owner_field.id });
    }
  }
  await getState().refresh_tables(true);

  for (const viewSpec of pack.views) {
    viewSpec.min_role = old_to_new_role(viewSpec.min_role);
    const { table, on_menu, menu_label, on_root_page, ...viewNoTable } =
      viewSpec;
    const vtable = Table.findOne({ name: table });
    const existing = View.findOne({ name: viewNoTable.name });
    if (existing?.id) {
      await View.update(viewNoTable, existing.id);
    } else {
      await View.create({
        ...viewNoTable,
        table_id: vtable ? vtable.id : null,
      });
    }
    if (menu_label)
      await add_to_menu({
        label: menu_label,
        type: "View",
        viewname: viewSpec.name,
        min_role: viewSpec.min_role || 100,
      });
  }
  await getState().refresh_views(true);

  for (const triggerSpec of pack.triggers || []) {
    triggerSpec.min_role = old_to_new_role(triggerSpec.min_role);
    let id;
    const existing = await Trigger.findOne({ name: triggerSpec.name });
    if (existing) {
      const { table_name, steps, ...tsNoTableName } = triggerSpec;
      if (table_name)
        tsNoTableName.table_id = Table.findOne({ name: table_name })?.id;
      await Trigger.update(existing.id, tsNoTableName);
      id = existing.id;
    } else {
      const newTrigger = await Trigger.create(triggerSpec);
      id = newTrigger.id;
    }
    if (triggerSpec.action === "Workflow" && triggerSpec.steps) {
      await WorkflowStep.deleteForTrigger(id);
      for (const step of triggerSpec.steps) {
        await WorkflowStep.create({ ...step, trigger_id: id });
      }
    }
  }
  await getState().refresh_triggers(true);

  for (const pageFullSpec of pack.pages || []) {
    pageFullSpec.min_role = old_to_new_role(pageFullSpec.min_role);
    const { root_page_for_roles, menu_label, ...pageSpec } = pageFullSpec;
    const existing = Page.findOne({ name: pageSpec.name });
    if (existing?.id) await Page.update(existing.id, pageSpec);
    else await Page.create(pageSpec as PagePack);
    for (const role of root_page_for_roles || []) {
      const current_root = getState().getConfigCopy(role + "_home", "");
      if (!current_root || current_root === "")
        await getState().setConfig(role + "_home", pageSpec.name);
    }
    if (menu_label)
      await add_to_menu({
        label: menu_label,
        type: "Page",
        pagename: pageSpec.name,
        min_role: pageSpec.min_role,
      });
  }

  await getState().refresh_pages(true);

  for (const pageGroupSpec of pack.page_groups || []) {
    pageGroupSpec.min_role = old_to_new_role(pageGroupSpec.min_role);
    const { members, ...pageGroupNoMembers } = pageGroupSpec;
    let existing = PageGroup.findOne({ name: pageGroupSpec.name });
    if (existing?.id) {
      await existing.clearMembers(); // or merge ?
      await PageGroup.update(existing.id, pageGroupNoMembers);
    } else existing = await PageGroup.create(pageGroupNoMembers);
    const group = existing;
    if (!group)
      throw new Error(`Unable to create page group '${pageGroupSpec.name}'`);
    for (const member of members || []) {
      const { page_name, ...memberNoPageName } = member;
      const page = Page.findOne({ name: page_name });
      if (!page) throw new Error(`Unable to find page '${member.page_name}'`);
      await group.addMember({ ...memberNoPageName, page_id: page.id! });
    }
  }

  for (const tag of pack.tags || []) {
    const entries = tag.entries
      ? tag.entries.map((e) => {
          const result: any = {};
          if (e.page_name) {
            const page = Page.findOne({ name: e.page_name });
            if (!page) throw new Error(`Unable to find page '${e.page_name}'`);
            result.page_id = page.id;
          }
          if (e.view_name) {
            const view = View.findOne({ name: e.view_name });
            if (!view) throw new Error(`Unable to find view '${e.view_name}'`);
            result.view_id = view.id;
          }
          if (e.table_name) {
            const table = Table.findOne({ name: e.table_name });
            if (!table)
              throw new Error(`Unable to find table '${e.table_name}'`);
            result.table_id = table.id;
          }
          if (e.trigger_name) {
            const trigger = Trigger.findOne({ name: e.trigger_name });
            if (!trigger)
              throw new Error(`Unable to find trigger '${e.trigger_name}'`);
            result.trigger_id = trigger.id;
          }
          return result;
        })
      : undefined;
    const existing = await Tag.findOne({ name: tag.name });
    if (!existing) await Tag.create({ name: tag.name, entries });
    else {
      for (const entry of entries || []) {
        await TagEntry.create({ tag_id: existing.id, ...entry });
      }
    }
  }
  for (const model of pack.models || []) {
    const mTbl = Table.findOne({ name: model.table_name });
    if (!mTbl) throw new Error(`Unable to find table '${model.table_name}'`);
    if (!mTbl.id) throw new Error(`Table '${model.table_name}' has no id`);
    const { table_name, ...cfg } = model.configuration;
    if (table_name) {
      if (table_name === mTbl.name) cfg.table_id = mTbl.id;
      else {
        const cfgTbl = Table.findOne({ name: table_name });
        if (!cfgTbl) throw new Error(`Unable to find table '${table_name}'`);
        cfg.table_id = cfgTbl.id;
      }
    }
    const existing = await Model.findOne({
      name: model.name,
      table_id: mTbl.id,
    });
    if (existing)
      await existing.update({
        modelpattern: model.modelpattern,
        configuration: cfg,
      });
    else
      await Model.create({
        name: model.name,
        table_id: mTbl.id,
        modelpattern: model.modelpattern,
        configuration: cfg,
      });
  }

  for (const modelInst of pack.model_instances || []) {
    const table = Table.findOne({ name: modelInst.table_name });
    if (!table)
      throw new Error(`Unable to find table '${modelInst.table_name}'`);
    const model = await Model.findOne({
      name: modelInst.model_name,
      table_id: table.id,
    });
    if (!model)
      throw new Error(`Unable to find table '${modelInst.model_name}'`);
    const { model_name, ...mICfg }: any = modelInst;
    mICfg.model_id = model.id;
    const existing = await ModelInstance.findOne({
      name: modelInst.name,
      model_id: model.id,
    });
    if (existing) {
      const { id, table_name, ...updrow } = mICfg;
      await existing.update(updrow);
    } else await ModelInstance.create(mICfg);
  }

  for (const eventLog of pack.event_logs || []) {
    const { user_email, ...rest } = eventLog;
    const eventLogCfg = rest as EventLogCfg;
    if (user_email) {
      const user = await User.findOne({ email: user_email });
      if (user) eventLogCfg.user_id = user.id;
      else {
        getState().log(
          2,
          `User '${user_email}' not found for event log ${eventLog.event_type}`
        );
      }
    }
    await EventLog.create(eventLogCfg);
  }

  if (pack.config) {
    const state = getState();

    for (const [k, v] of Object.entries(pack.config)) {
      await state.setConfig(k, v);
    }
  }

  if (pack.code_pages) {
    const code_pages = getState().getConfigCopy("function_code_pages", {});
    const function_code_pages_tags = getState().getConfigCopy(
      "function_code_pages_tags",
      {}
    );

    for (const { name, code, tags } of pack.code_pages) {
      code_pages[name] = code;
      function_code_pages_tags[name] = tags;
    }
    await getState().setConfig("function_code_pages", code_pages);
    await getState().setConfig(
      "function_code_pages_tags",
      function_code_pages_tags
    );
    await getState().refresh_codepages();
  }

  if (name) {
    const existPacks = getState().getConfigCopy("installed_packs", []);
    await getState().setConfig("installed_packs", [...existPacks, name]);
  }
};

/**
 * Fetch available packs from the store endpoint (packs_store_endpoint cfg)
 */
const fetch_available_packs = async (): Promise<Array<{ name: string }>> => {
  const stored = getState().getConfigCopy("available_packs", false);
  const stored_at = getState().getConfigCopy(
    "available_packs_fetched_at",
    false
  );
  const airgap = getState().getConfig("airgap", false);

  //console.log("in fetch", stored_at, stored)
  if (!airgap && (!stored || !stored_at || isStale(stored_at))) {
    try {
      const from_api = await fetch_available_packs_from_store();
      await getState().setConfig("available_packs", from_api);
      await getState().setConfig("available_packs_fetched_at", new Date());
      return from_api;
    } catch (e) {
      console.error("fetch store error", e);
      return [];
    }
  } else return stored || [];
};

/**
 * Get cached packs
 */
const get_cached_packs = (): Array<{ name: string }> => {
  const stored = getState().getConfigCopy("available_packs", false);
  return stored || [];
};

/**
 * Fetch available packs from store
 */
const fetch_available_packs_from_store = async (): Promise<
  Array<{ name: string }>
> => {
  //console.log("fetch packs");
  //const { getState } = require("../db/state");
  const packs_store_endpoint = getState().getConfig(
    "packs_store_endpoint",
    false
  );
  //console.log(`[fetch_available_packs_from_store] packs_store_endpoint:%s`, packs_store_endpoint);

  const response = await fetch(
    //"http://store.saltcorn.com/api/packs?fields=name,description"
    packs_store_endpoint + "?fields=name,description",
    getFetchProxyOptions()
  );

  const json: any = await response.json();
  return json.success;
};

/**
 * Fetch pack by name
 * @function
 * @param name
 */
const fetch_pack_by_name = async (
  name: string
): Promise<{ name: string; pack: any } | null> => {
  //const { getState } = require("../db/state");
  const packs_store_endpoint = getState().getConfig(
    "packs_store_endpoint",
    false
  );
  //console.log(`[fetch_pack_by_name] packs_store_endpoint:%s`, packs_store_endpoint);

  const response = await fetch(
    //"http://store.saltcorn.com/api/packs?name=" + encodeURIComponent(name)
    packs_store_endpoint + "?name=" + encodeURIComponent(name),
    getFetchProxyOptions()
  );
  const json: any = await response.json();
  if (json.success.length == 1) return json.success[0];
  else return null;
};

const code_pages_from_tag = async (tag: Tag): Promise<Array<CodePagePack>> => {
  const function_code_pages_tags: { string: [string] } =
    getState().getConfigCopy("function_code_pages_tags", {});
  const function_code_pages = getState().getConfigCopy(
    "function_code_pages",
    {}
  );

  const cps: Array<CodePagePack> = [];
  Object.entries(function_code_pages_tags || {}).forEach(([cpname, tags]) => {
    const code = function_code_pages[cpname];
    if (tags.includes(tag.name) && code) cps.push({ name: cpname, code, tags });
  });
  return cps;
};

const create_pack_from_tag = async (tag: Tag): Promise<any> => {
  const pack: Pack = {
    tables: [],
    views: [],
    plugins: [],
    pages: [],
    page_groups: [],
    roles: [],
    library: [],
    triggers: [],
    tags: [],
    models: [],
    model_instances: [],
    event_logs: [],
    code_pages: [],
  };
  const tables = await tag.getTables();
  for (const t of tables) pack.tables.push(await table_pack(t));
  const views = await tag.getViews();
  for (const v of views) pack.views.push(await view_pack(v));
  const pages = await tag.getPages();
  for (const p of pages) pack.pages.push(await page_pack(p));
  const triggers = await tag.getTriggers();
  for (const t of triggers) pack.triggers.push(await trigger_pack(t));
  pack.tags.push(await tag_pack(tag));
  pack.code_pages = await code_pages_from_tag(tag);
  return pack;

  //TODO add models, plugins
};

export = {
  table_pack,
  view_pack,
  plugin_pack,
  page_pack,
  page_group_pack,
  role_pack,
  library_pack,
  trigger_pack,
  tag_pack,
  model_pack,
  model_instance_pack,
  event_log_pack,
  install_pack,
  fetch_available_packs,
  get_cached_packs,
  fetch_pack_by_name,
  can_install_pack,
  uninstall_pack,
  add_to_menu,
  create_pack_from_tag,
};
