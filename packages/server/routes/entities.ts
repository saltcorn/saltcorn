/**
 * Entities Router - Unified view of all system entities
 * @category server
 * @module routes/entities
 * @subcategory routes
 */

import Router from "express-promise-router";
import Table from "@saltcorn/data/models/table";
import View from "@saltcorn/data/models/view";
import Page from "@saltcorn/data/models/page";
import Trigger from "@saltcorn/data/models/trigger";
import Tag from "@saltcorn/data/models/tag";
import TagEntry from "@saltcorn/data/models/tag_entry";
import User from "@saltcorn/data/models/user";
import Role from "@saltcorn/data/models/role";
import Plugin from "@saltcorn/data/models/plugin";
import db from "@saltcorn/data/db";
import { getState } from "@saltcorn/data/db/state";
import {
  div,
  input,
  button,
  script,
  domReady,
  a,
  i,
  span,
  text,
  table,
  thead,
  tbody,
  tr,
  th,
  td,
  label,
  select,
  option,
} from "@saltcorn/markup/tags";
import {
  post_dropdown_item,
  settingsDropdown,
  post_btn,
} from "@saltcorn/markup";
import {
  view_dropdown,
  page_dropdown,
  trigger_dropdown,
} from "./common_lists.js";
import { error_catcher, isAdminOrHasConfigMinRole } from "./utils.js";
import _am_pack from "@saltcorn/admin-models/models/pack";
const {
  fetch_pack_by_name,
  fetch_available_packs,
  table_pack,
  view_pack,
  page_pack,
  trigger_pack,
  uninstall_pack,
  plugin_pack,
} = _am_pack;
import { escapeHtml } from "@saltcorn/data/utils";
import { Req, Res } from "@saltcorn/types/base_types";

/**
 * @type {object}
 * @const
 * @namespace entitiesRouter
 * @category server
 * @subcategory routes
 */
const router = Router();
export default router;

// Ensure on_done_redirect values remain relative to the app root
const stripLeadingSlash = (path = "") =>
  path.startsWith("/") ? path.slice(1) : path;

/**
 * Get additional entities (modules, users)
 */
const req__ = (req: any, s: any) => (req && req.__(s)) || s;

const getExtendedEntites = async (req: any, { includeAllModules = false }: any = {}) => {
  const entities = [];
  const can_reset = getState()!.getConfig("smtp_host", "") !== "";

  const users = await User.find({}, { cached: true });
  users.forEach((u: any) => {
    entities.push({
      type: "user",
      name: u.email,
      id: u.id,
      viewLink: `/useradmin/${u.id}`,
      editLink: `/useradmin/${u.id}`,
      metadata: {
        email: u.email,
        username: u.username,
        role_id: u.role_id,
        disabled: u.disabled,
      },
      actionsHtml: buildUserActionsDropdown(u, req, can_reset),
    });
  });

  const statePlugins = getState()!.plugins;
  const csrfToken = req?.csrfToken ? req.csrfToken() : null;
  const packs = getState()!.getConfig("installed_packs", []);
  const installedPackNames = new Set(packs);
  const packDetails = await Promise.all(
    packs.map(async (pname: any) => {
      try {
        return (await fetch_pack_by_name(pname)) || { name: pname };
      } catch (e: any) {
        getState()!.log?.(
          2,
          `Failed to fetch installed pack ${pname}: ${e.message}`
        );
        return { name: pname };
      }
    })
  );
  const availablePackSummaries = new Map();
  let storeModules = [];
  const storeModuleSummaries = new Map();
  try {
    storeModules = await Plugin.store_plugins_available();
    storeModules.forEach((mod: any) => {
      if (mod?.name) storeModuleSummaries.set(mod.name, mod);
    });
  } catch (e: any) {
    getState()!.log?.(2, `Failed to fetch available modules: ${e.message}`);
  }
  if (includeAllModules) {
    try {
      const availablePacks = await fetch_available_packs();
      availablePacks.forEach((pack: any) => {
        if (pack?.name) availablePackSummaries.set(pack.name, pack);
      });
    } catch (e: any) {
      getState()!.log?.(2, `Failed to fetch available packs: ${e.message}`);
    }
  }

  const buildModuleActions = (moduleName: any, installed: any) => {
    if (!csrfToken) return "";
    if (installed) {
      return post_btn(
        `/plugins/delete/${encodeURIComponent(moduleName)}`,
        req.__("Uninstall"),
        csrfToken,
        {
          formClass: "d-inline",
          btnClass: "btn btn-sm btn-danger",
          klass: "extended-entity-remove",
          confirm: true,
          req,
        }
      );
    }
    return post_btn(
      `/plugins/install/${encodeURIComponent(moduleName)}`,
      req.__("Install"),
      csrfToken,
      {
        formClass: "d-inline",
        btnClass: "btn btn-sm btn-primary",
        klass: "extended-entity-install",
      }
    );
  };

  const modules = await Plugin.find();
  const installedModuleNames = new Set();
  modules
    .filter((mod: any) => mod.name !== "base")
    .forEach((mod: any) => {
      installedModuleNames.add(mod.name);
      const has_theme =
        typeof mod.has_theme !== "undefined"
          ? mod.has_theme
          : !!statePlugins[mod.name]?.layout;
      const has_auth =
        typeof mod.has_auth !== "undefined"
          ? mod.has_auth
          : !!statePlugins[mod.name]?.authentication;
      const ready_for_mobile = !!statePlugins[mod.name]?.ready_for_mobile;
      const source = mod.source;
      const description =
        storeModuleSummaries.get(mod.name)?.description ||
        mod.description ||
        statePlugins[mod.name]?.description ||
        "";
      entities.push({
        type: "module",
        name: mod.name,
        id: mod.id,
        viewLink: `/plugins/info/${mod.name}`,
        editLink: statePlugins[mod.name]?.configuration_workflow
          ? `/plugins/configure/${mod.name}`
          : null,
        metadata: {
          version: mod.version,
          hasConfig: !!statePlugins[mod.name]?.configuration_workflow,
          has_theme,
          has_auth,
          ready_for_mobile,
          source,
          description,
          local: source === "local",
          installed: true,
          type: "module",
        },
        actionsHtml: buildModuleActions(mod.name, true),
      });
    });

  if (includeAllModules) {
    try {
      storeModules
        .filter(
          (mod: any) => mod.name !== "base" && !installedModuleNames.has(mod.name)
        )
        .forEach((mod: any) => {
          const source = mod.source;
          entities.push({
            type: "module",
            name: mod.name,
            id: mod.id,
            viewLink: `/plugins/info/${mod.name}`,
            editLink: null,
            metadata: {
              version: mod.version,
              hasConfig: false,
              has_theme: !!mod.has_theme,
              has_auth: !!mod.has_auth,
              ready_for_mobile: !!mod.ready_for_mobile,
              source,
              description: mod.description || "",
              local: source === "local",
              installed: false,
              type: "module",
            },
            actionsHtml: buildModuleActions(mod.name, false),
          });
        });
    } catch (e: any) {
      getState()!.log?.(2, `Failed to fetch available modules: ${e.message}`);
    }
  }

  const buildPackActions = (packName: any, installed: any) => {
    if (!csrfToken) return "";
    if (installed) {
      return post_btn(
        `/packs/uninstall/${encodeURIComponent(packName)}`,
        req.__("Uninstall"),
        csrfToken,
        {
          formClass: "d-inline",
          btnClass: "btn btn-sm btn-danger",
          klass: "extended-entity-remove",
        }
      );
    }
    return post_btn(
      `/packs/install-named/${encodeURIComponent(packName)}`,
      req.__("Install"),
      csrfToken,
      {
        formClass: "d-inline",
        btnClass: "btn btn-sm btn-primary",
        klass: "extended-entity-install",
      }
    );
  };

  packDetails.forEach((pack: any) => {
    if (!pack || !pack.name) return;
    const summary = availablePackSummaries.get(pack.name);
    if (summary) availablePackSummaries.delete(pack.name);
    const version = pack.version ?? pack.pack?.version ?? null;
    const description =
      pack.description || pack.pack?.description || summary?.description || "";
    entities.push({
      type: "module",
      name: pack.name,
      id: pack.id || pack.pack?.id || pack.name,
      viewLink: null,
      editLink: null,
      metadata: {
        version,
        description,
        hasConfig: false,
        has_theme: false,
        local: false,
        installed: true,
        type: "pack",
      },
      actionsHtml: buildPackActions(pack.name, true),
    });
  });

  if (availablePackSummaries.size) {
    for (const [packName, pack] of availablePackSummaries.entries()) {
      if (installedPackNames.has(packName)) continue;
      entities.push({
        type: "module",
        name: packName,
        id: pack.id || packName,
        viewLink: null,
        editLink: null,
        metadata: {
          version: null,
          description: pack.description || "",
          hasConfig: false,
          has_theme: false,
          local: false,
          installed: false,
          type: "pack",
        },
        actionsHtml: buildPackActions(packName, false),
      });
    }
  }

  return entities;
};

const buildUserActionsDropdown = (user: any, req: any, can_reset: any) => {
  if (!req) return "";
  const dropdownId = `entityUserDropdown${user.id}`;
  const items = [
    a(
      {
        class: "dropdown-item",
        href: `/useradmin/${user.id}`,
      },
      '<i class="fas fa-edit"></i>&nbsp;' + req__(req, "Edit")
    ),
    post_dropdown_item(
      `/useradmin/become-user/${user.id}`,
      '<i class="fas fa-ghost"></i>&nbsp;' + req__(req, "Become user"),
      req
    ),
    post_dropdown_item(
      `/useradmin/set-random-password/${user.id}`,
      '<i class="fas fa-random"></i>&nbsp;' + req__(req, "Set random password"),
      req,
      true
    ),
    can_reset &&
      post_dropdown_item(
        `/useradmin/reset-password/${user.id}`,
        '<i class="fas fa-envelope"></i>&nbsp;' +
          req__(req, "Send password reset email"),
        req
      ),
    can_reset &&
      !user.verified_on &&
      getState()!.getConfig("verification_view", "") &&
      post_dropdown_item(
        `/useradmin/send-verification/${user.id}`,
        '<i class="fas fa-envelope"></i>&nbsp;' +
          req__(req, "Send verification email"),
        req
      ),
    user.disabled &&
      post_dropdown_item(
        `/useradmin/enable/${user.id}`,
        '<i class="fas fa-play"></i>&nbsp;' + req__(req, "Enable"),
        req
      ),
    !user.disabled &&
      post_dropdown_item(
        `/useradmin/disable/${user.id}`,
        '<i class="fas fa-pause"></i>&nbsp;' + req__(req, "Disable"),
        req
      ),
    !user.disabled &&
      post_dropdown_item(
        `/useradmin/force-logout/${user.id}`,
        '<i class="fas fa-sign-out-alt"></i>&nbsp;' +
          req__(req, "Force logout"),
        req
      ),
    post_dropdown_item(
      `/useradmin/delete/${user.id}`,
      '<i class="far fa-trash-alt"></i>&nbsp;' + req__(req, "Delete"),
      req,
      true,
      user.email
    ),
  ].filter(Boolean);
  return settingsDropdown(dropdownId, items);
};

/**
 * Get all entities with their type and metadata
 */
const getAllEntities = async () => {
  const tables = await Table.find({}, { cached: true });
  const tableNameById = new Map(tables.map((t: any) => [t.id, t.name]));
  const views = await View.find({}, { cached: true });
  const pages = await Page.find({}, { cached: true });
  const triggers = await Trigger.findAllWithTableName();

  const entities = [];

  // Add tables
  tables.forEach((t: any) => {
    entities.push({
      type: "table",
      name: t.name,
      id: t.id,
      updated_at: t.updated_at ? new Date(t.updated_at).toISOString() : null,
      viewLink: `/table/${t.id}`,
      editLink: `/table/${t.id}`,
      metadata: {
        external: t.external,
        versioned: t.versioned,
        ownership_field_id: t.ownership_field_id,
        isOwned: t.ownership_field_id || t.ownership_formula,
        min_role_read: t.min_role_read,
        min_role_write: t.min_role_write,
        provider_name: t.provider_name,
      },
    });
  });

  // Add views
  views.forEach((v: any) => {
    const has_config =
      v.configuration &&
      typeof v.configuration === "object" &&
      Object.keys(v.configuration).length > 0;
    entities.push({
      type: "view",
      name: v.name,
      id: v.id,
      updated_at: v.updated_at ? new Date(v.updated_at).toISOString() : null,
      viewLink: `/view/${encodeURIComponent(v.name)}`,
      editLink: v.singleton
        ? null
        : `/viewedit/edit/${encodeURIComponent(v.name)}`,
      metadata: {
        viewtemplate: v.viewtemplate,
        table_id: v.table_id,
        table_name: v.table_id ? tableNameById.get(v.table_id) : null,
        singleton: v.singleton,
        min_role: v.min_role,
        has_config,
      },
    });
  });

  // Add pages
  pages.forEach((p: any) => {
    entities.push({
      type: "page",
      name: p.name,
      id: p.id,
      updated_at: p.updated_at ? new Date(p.updated_at).toISOString() : null,
      viewLink: `/page/${encodeURIComponent(p.name)}`,
      editLink: `/pageedit/edit/${encodeURIComponent(p.name)}`,
      metadata: {
        description: p.description,
        min_role: p.min_role,
      },
    });
  });

  // Add triggers
  triggers.forEach((tr: any) => {
    entities.push({
      type: "trigger",
      name: tr.name,
      id: tr.id,
      updated_at: tr.updated_at ? new Date(tr.updated_at).toISOString() : null,
      viewLink: `/actions/configure/${tr.id}`,
      editLink: `/actions/configure/${tr.id}`,
      metadata: {
        action: tr.action,
        when_trigger: tr.when_trigger,
        table_name: tr.table_name,
        channel: tr.channel,
        min_role: tr.min_role,
      },
    });
  });

  // Sort by name
  entities.sort((a: any, b: any) =>
    (a.name || "").localeCompare(b.name || "", undefined, {
      sensitivity: "base",
    })
  );

  return entities;
};

/**
 * Generate entity type badge
 */
const entityTypeBadge = (type: any) => {
  const badges = {
    table: { class: "primary", icon: "table", label: "Table" },
    view: { class: "success", icon: "eye", label: "View" },
    page: { class: "info", icon: "file", label: "Page" },
    trigger: { class: "warning", icon: "play", label: "Trigger" },
    module: { class: "secondary", icon: "cube", label: "Module" },
    user: { class: "dark", icon: "user", label: "User" },
    role: { class: "danger", icon: "lock", label: "Role" },
  };
  const badge = badges[type];
  return span(
    { class: `badge bg-${badge.class} me-2` },
    i({ class: `fas fa-${badge.icon} me-1` }),
    badge.label
  );
};

// Helper: build details column content based on entity type
const detailsContent = (entity: any, req: any, roles: any) => {
  const bits = [];
  if (entity.type === "table") {
    if (entity.metadata.external)
      bits.push(span({ class: "badge bg-info me-1" }, req.__("External")));
    if (entity.metadata.versioned)
      bits.push(span({ class: "badge bg-success me-1" }, req.__("History")));
    if (entity.metadata.isOwned)
      bits.push(span({ class: "badge bg-primary me-1" }, req.__("Owned")));
    if (entity.metadata.provider_name)
      bits.push(
        span(
          { class: "badge bg-success me-1" },
          text(entity.metadata.provider_name)
        )
      );
  } else if (entity.type === "view" && entity.metadata.viewtemplate) {
    if (entity.metadata.table_name)
      bits.push(
        span(
          { class: "badge bg-secondary me-1" },
          text(entity.metadata.table_name)
        )
      );
    bits.push(
      span({ class: "text-muted small" }, text(entity.metadata.viewtemplate))
    );
  } else if (entity.type === "trigger") {
    if (entity.metadata.when_trigger)
      bits.push(
        span(
          { class: "text-muted small me-2" },
          text(entity.metadata.when_trigger)
        )
      );
    if (entity.metadata.table_name || entity.metadata.channel)
      bits.push(
        span(
          { class: "text-muted small me-2 fst-italic" },
          text(entity.metadata.table_name || entity.metadata.channel)
        )
      );
    if (entity.metadata.action)
      bits.push(
        span(
          { class: "text-muted small fst-italic" },
          text(entity.metadata.action)
        )
      );
  } else if (entity.type === "user") {
    const disabled = entity.metadata.disabled;
    const roleName = Array.isArray(roles)
      ? roles.find((r: any) => r.id === entity.metadata.role_id)?.role
      : null;
    if (roleName)
      bits.push(span({ class: "badge bg-secondary me-1" }, text(roleName)));
    if (disabled)
      bits.push(span({ class: "badge bg-danger me-1" }, req.__("Disabled")));
  } else if (entity.type === "module") {
    if (entity.metadata.version)
      bits.push(
        span(
          { class: "text-muted small me-2" },
          text(`v${entity.metadata.version}`)
        )
      );
  }
  return bits.length ? div(...bits) : "";
};

// Helper: role label per entity
const roleLabel = (entity: any, roles: any) => {
  const getRole = (rid: any) => roles.find((r: any) => r.id === rid)?.role || "?";
  if (entity.type === "table") {
    const r = entity.metadata;
    if (r.external) return `${getRole(r.min_role_read)} (read only)`;
    if (
      typeof r.min_role_read !== "undefined" &&
      typeof r.min_role_write !== "undefined"
    )
      return `${getRole(r.min_role_read)}/${getRole(r.min_role_write)}`;
    return "";
  } else {
    const mr = entity.metadata.min_role;
    return typeof mr !== "undefined" ? getRole(mr) : "";
  }
};

const tableActionsDropdown = (entity: any, req: any, user_can_edit_tables: any) => {
  const metadata = entity.metadata || {};
  if (metadata.external || metadata.provider_name) return "";
  const items = [
    !db.isSQLite &&
      user_can_edit_tables &&
      entity.name !== "users" &&
      a(
        {
          class: "dropdown-item",
          href: `/table/rename/${entity.id}`,
        },
        '<i class="fas fa-edit"></i>&nbsp;' + req.__("Rename table")
      ),
    post_dropdown_item(
      `/table/recalc-stored/${encodeURIComponent(entity.name)}`,
      '<i class="fas fa-sync"></i>&nbsp;' + req.__("Recalculate stored fields"),
      req
    ),
    user_can_edit_tables &&
      post_dropdown_item(
        `/table/delete-all-rows/${encodeURIComponent(entity.name)}`,
        '<i class="far fa-trash-alt"></i>&nbsp;' + req.__("Delete all rows"),
        req,
        true
      ),
    user_can_edit_tables &&
      entity.name !== "users" &&
      post_dropdown_item(
        `/table/forget-table/${entity.id}`,
        '<i class="fas fa-recycle"></i>&nbsp;' + req.__("Forget table"),
        req,
        true
      ),
    a(
      {
        class: "dropdown-item",
        href: `/registry-editor?etype=table&ename=${encodeURIComponent(
          entity.name
        )}`,
      },
      '<i class="fas fa-cog"></i>&nbsp;' + req.__("Registry editor")
    ),
    user_can_edit_tables &&
      entity.name !== "users" &&
      post_dropdown_item(
        `/table/delete/${entity.id}`,
        '<i class="fas fa-trash"></i>&nbsp;' + req.__("Delete table"),
        req,
        true
      ),
    req.user?.role_id === 1 &&
      entity.name !== "users" &&
      post_dropdown_item(
        `/table/delete-with-trig-views/${entity.id}`,
        '<i class="fas fa-trash"></i>&nbsp;' +
          req.__("Delete table+views+triggers"),
        req,
        true
      ),
  ].filter(Boolean);
  if (!items.length) return "";
  return settingsDropdown(`entityTableDropdown${entity.id}`, items);
};

/**
 * Deep search index endpoint. loaded lazily on check
 */
router.get(
  "/deep-search-index",
  isAdminOrHasConfigMinRole("min_role_edit_views"),
  error_catcher(async (req: Req, res: Res) => {
    const entities = await getAllEntities();
    const deepSearchIndex = {};
    const addDeepSearch = (key: any, pack: any) => {
      if (!pack) return;
      try {
        deepSearchIndex[key] = escapeHtml(JSON.stringify(pack).toLowerCase());
      } catch (e: any) {
        console.error(
          `Failed to stringify pack ${pack.name} for deep search index:`,
          e
        );
      }
    };

    for (const entity of entities) {
      const keyById = `${entity.type}:${entity.id}`;
      try {
        if (entity.type === "table") {
          const table = Table.findOne({ id: entity.id });
          if (table) addDeepSearch(keyById, await table_pack(table));
        } else if (entity.type === "view") {
          const view = View.findOne({ name: entity.name });
          if (view) {
            const viewKeyById = `view:${view.id ?? entity.id ?? entity.name}`;
            const viewKeyByName = `view:${entity.name}`;
            const vpack = await view_pack(view);
            addDeepSearch(viewKeyById, vpack);
            if (viewKeyByName !== viewKeyById)
              addDeepSearch(viewKeyByName, vpack);
          }
        } else if (entity.type === "page") {
          const page = Page.findOne({ name: entity.name });
          if (page) addDeepSearch(keyById, await page_pack(page));
        } else if (entity.type === "trigger") {
          const trigger = Trigger.findOne({ id: entity.id });
          if (trigger) addDeepSearch(keyById, await trigger_pack(trigger));
        }
      } catch (e: any) {
        getState()!.log?.(
          2,
          `Failed to build deep search index for ${keyById}: ${e.message}`
        );
      }
    }
    res.json(deepSearchIndex);
  })
);

/**
 * Main entities list page
 */
router.get(
  "/",
  isAdminOrHasConfigMinRole("min_role_edit_views"),
  error_catcher(async (req: Req, res: Res) => {
    const entities = await getAllEntities();
    // fetch roles and tags
    const roles = await User.get_roles();
    const tags = await Tag.find();
    const tagEntries = await TagEntry.find();
    const userRoleId = req.user?.role_id ?? Infinity;
    const user_can_edit_tables =
      userRoleId === 1 ||
      getState()!.getConfig("min_role_edit_tables", 1) >= userRoleId;
    const on_done_redirect_str = `?on_done_redirect=${encodeURIComponent(
      stripLeadingSlash(req.originalUrl || "")
    )}`;
    const buildActionMenu = (entity: any) => {
      if (entity.type === "table")
        return tableActionsDropdown(entity, req, user_can_edit_tables);
      if (entity.type === "view")
        return view_dropdown(entity, req, on_done_redirect_str, false);
      if (entity.type === "page")
        return page_dropdown(entity, req, on_done_redirect_str, true, false);
      if (entity.type === "trigger")
        return trigger_dropdown(entity, req, on_done_redirect_str, false);
      return "";
    };

    const tagsById = {};
    tags.forEach((t: any) => (tagsById[t.id] = t));

    const tagsByEntityKey = new Map();
    const addTag = (key: any, tag_id: any) => {
      const arr = tagsByEntityKey.get(key) || [];
      if (!arr.includes(tag_id)) arr.push(tag_id);
      tagsByEntityKey.set(key, arr);
    };
    tagEntries.forEach((te: any) => {
      if (te.table_id) addTag(`table:${te.table_id}`, te.tag_id);
      if (te.view_id) addTag(`view:${te.view_id}`, te.tag_id);
      if (te.page_id) addTag(`page:${te.page_id}`, te.tag_id);
      if (te.trigger_id) addTag(`trigger:${te.trigger_id}`, te.tag_id);
    });

    const filterToggles = div(
      {
        class: "btn-group btn-group-sm entity-type-group",
        role: "group",
        "aria-label": "Entity type filters",
      },
      button(
        {
          type: "button",
          class: `btn btn-sm btn-${req.query?.tables ? "" : "outline-"}primary entity-filter-btn`,
          "data-entity-type": "table",
          title: req.__("Show tables (Alt+T)"),
        },
        i({ class: "fas fa-table me-1" }),
        req.__("Tables")
      ),
      button(
        {
          type: "button",
          class: `btn btn-sm btn-${req.query?.views ? "" : "outline-"}primary entity-filter-btn`,
          "data-entity-type": "view",
          title: req.__("Show views (Alt+V)"),
        },
        i({ class: "fas fa-eye me-1" }),
        req.__("Views")
      ),
      button(
        {
          type: "button",
          class: `btn btn-sm btn-${req.query?.pages ? "" : "outline-"}primary entity-filter-btn`,
          "data-entity-type": "page",
          title: req.__("Show pages (Alt+P)"),
        },
        i({ class: "fas fa-file me-1" }),
        req.__("Pages")
      ),
      button(
        {
          type: "button",
          class: `btn btn-sm btn-${req.query?.triggers ? "" : "outline-"}primary entity-filter-btn`,
          "data-entity-type": "trigger",
          title: req.__("Show triggers (Alt+R)"),
        },
        i({ class: "fas fa-play me-1" }),
        req.__("Triggers")
      ),
      button(
        {
          type: "button",
          class:
            "btn btn-sm btn-outline-primary entity-filter-btn entity-extended-btn d-none",
          "data-entity-type": "user",
          title: req.__("Show users (Alt+U)"),
        },
        i({ class: "fas fa-user me-1" }),
        req.__("Users")
      ),
      button(
        {
          type: "button",
          class:
            "btn btn-sm btn-outline-primary entity-filter-btn entity-extended-btn d-none",
          "data-entity-type": "module",
          title: req.__("Show modules (Alt+M)"),
        },
        i({ class: "fas fa-cube me-1" }),
        req.__("Modules")
      ),
      button(
        {
          type: "button",
          class: "btn btn-sm btn-outline-secondary",
          id: "entity-more-btn",
          onclick: "toggleEntityExpanded(true)",
        },
        req.__("More...")
      ),
      button(
        {
          type: "button",
          class: "btn btn-sm btn-outline-secondary d-none",
          id: "entity-less-btn",
          onclick: "toggleEntityExpanded(false)",
        },
        req.__("Less...")
      )
    );

    const searchBox = div(
      { class: "input-group mb-2" },
      input({
        type: "search",
        class: "form-control",
        name: "q",
        placeholder: req.__("Search entities by name or type..."),
        "aria-label": req.__("Search entities by name or type..."),
        autocomplete: "off",
        id: "entity-search",
      }),
      span({ class: "input-group-text" }, [
        input({
          class: "form-check-input mt-0 me-2",
          type: "checkbox",
          id: "entity-deep-search",
          title: req.__("Toggle deep search (Alt+S)"),
        }),
        label(
          {
            class: "form-check-label mb-0",
            for: "entity-deep-search",
            title: req.__("Toggle deep search (Alt+S)"),
          },
          req.__("Deep search")
        ),
      ])
    );

    const manageTagsLink = a(
      {
        class: "btn btn-sm btn-outline-secondary",
        href: `/tag${on_done_redirect_str}`,
        title: req.__("Manage tags"),
      },
      i({ class: "fas fa-cog" })
    );

    // Tag filter buttons + manage
    const tagFilterBar = div(
      { class: "d-flex flex-wrap align-items-center gap-1" },
      span(
        { class: "me-2 text-muted" },
        i({ class: "fas fa-tags me-1" }),
        req.__("Tags:")
      ),
      ...tags.map((t: any) =>
        button(
          {
            type: "button",
            class: "btn btn-sm btn-outline-secondary tag-filter-btn",
            "data-tag-id": String(t.id),
          },
          text(t.name)
        )
      ),
      manageTagsLink
    );

    // One row for type filters and tag filters
    const filtersRow = div(
      {
        id: "entity-filters-row",
        class:
          "d-flex flex-wrap align-items-center justify-content-between mb-2 gap-2 p-2 border rounded",
        style: "border-color: transparent !important;",
      },
      div(
        { class: "d-flex align-items-center gap-2 flex-wrap" },
        span(
          { class: "me-1 text-muted" },
          i({ class: "fas fa-filter me-1" }),
          req.__("Types:")
        ),
        filterToggles
      ),
      tagFilterBar
    );

    const selectionBar = div(
      {
        id: "entity-selection-bar",
        class:
          "d-flex align-items-center justify-content-between mb-2 gap-2 d-none p-2 border rounded",
        style:
          "background-color: var(--bs-secondary-bg, var(--bs-secondary-bg-fallback)); border-color: transparent !important; flex-wrap: wrap;",
      },
      div(
        { class: "d-flex align-items-center gap-2" },
        button(
          {
            type: "button",
            class: "btn btn-sm btn-outline-secondary selection-control-btn",
            id: "entity-clear-selection",
            "aria-label": req.__("Clear selection"),
          },
          i({ class: "fas fa-times" })
        ),
        span(
          { id: "entity-selection-count", class: "fw-semibold" },
          req.__("%s selected", "0")
        )
      ),
      div(
        {
          class: "d-flex align-items-center gap-2",
          style: "flex: 1; flex-direction: row-reverse;",
        },
        button(
          {
            type: "button",
            class: "btn btn-sm btn-danger selection-control-btn",
            id: "entity-bulk-delete",
            "aria-label": req.__("Delete selected"),
            disabled: true,
          },
          i({ class: "fas fa-trash" })
        ),
        button(
          {
            type: "button",
            class: "btn btn-sm btn-outline-secondary selection-control-btn",
            style: "min-width: 147px;",
            id: "entity-bulk-download-pack",
            title: req.__("Download pack for selected modules/packs"),
            disabled: true,
          },
          i({ class: "fas fa-download me-1" }),
          req.__("Download pack")
        ),
        div(
          {
            id: "entity-bulk-role-write-group",
            class: "input-group input-group-sm",
            style: "max-width: 180px; min-width: 150px",
          },
          select(
            {
              class:
                "form-select border border-secondary btn-outline-secondary",
              id: "entity-bulk-role-write-select",
              "aria-label": req.__("Select write role"),
              style:
                "--entity-bulk-role-border: var(--bs-secondary); border: 2px solid var(--entity-bulk-role-border) !important;",
            },
            option({ value: "" }, req.__("Set write role")),
            ...roles.map((r: any) => option({ value: r.id }, r.role))
          ),
          button(
            {
              type: "button",
              class: "btn btn-sm btn-outline-secondary",
              id: "entity-bulk-apply-role-write",
              title: req.__("Apply write role to selected tables"),
              disabled: true,
            },
            req.__("Set write")
          )
        ),
        div(
          {
            id: "entity-bulk-role-read-group",
            class: "input-group input-group-sm",
            style: "max-width: 180px; min-width: 150px",
          },
          select(
            {
              class:
                "form-select border border-secondary btn-outline-secondary",
              id: "entity-bulk-role-read-select",
              "aria-label": req.__("Select access role"),
              style:
                "--entity-bulk-role-border: var(--bs-secondary); border: 2px solid var(--entity-bulk-role-border) !important;",
            },
            option({ value: "", disabled: true }, req.__("Set access role")),
            ...roles.map((r: any) => option({ value: r.id }, r.role))
          ),
          button(
            {
              type: "button",
              class: "btn btn-sm btn-outline-secondary",
              id: "entity-bulk-apply-role-read",
              title: req.__("Apply access role to selected"),
              disabled: true,
            },
            req.__("Set access")
          )
        ),
        div(
          {
            class: "input-group input-group-sm",
            style: "max-width: 200px; min-width: 150px;",
          },
          // span({ class: "input-group-text" }, i({ class: "fas fa-tag" })),
          select(
            {
              class:
                "form-select border border-secondary btn-outline-secondary",
              style:
                "--entity-bulk-tag-border: var(--bs-secondary); border: 2px solid var(--entity-bulk-tag-border) !important;",
              id: "entity-bulk-tag-select",
              "aria-label": req.__("Select tag to apply"),
            },
            option(
              { value: "", disabled: true, selected: true },
              req.__("Select tag")
            ),
            ...tags.map((t: any) => option({ value: t.id }, t.name))
          ),
          button(
            {
              type: "button",
              class: "btn btn-sm btn-outline-secondary",
              id: "entity-bulk-apply-tag",
              title: req.__("Apply tag to selected"),
              disabled: true,
            },
            req.__("Apply tag")
          )
        )
      )
    );

    // Build table
    const headerRow = tr(
      th(req.__("Type")),
      th(req.__("Name")),
      th(req.__("Run")),
      th(req.__("Details")),
      th(req.__("Access | Read/Write")),
      th(req.__("Tags")),
      th(req.__("Actions"))
    );

    const typePlural = (t: any) =>
      ({ table: "tables", view: "views", page: "pages", trigger: "triggers" })[
        t
      ];

    const legacyLinkMeta = {
      table: { href: "/table", label: req.__("Go to tables list") },
      view: { href: "/viewedit", label: req.__("Go to views list") },
      page: { href: "/pageedit", label: req.__("Go to pages list") },
      trigger: { href: "/actions", label: req.__("Go to triggers list") },
    };

    const initially_hidden = Object.keys(req.query || {}).length;

    const bodyRows = entities.map((entity: any) => {
      const key = `${entity.type}:${
        entity.type === "view" ? (entity.id ?? entity.name) : entity.id
      }`;
      const tagIds = tagsByEntityKey.get(key) || [];
      const tagBadges = tagIds.map((tid: any) =>
        a(
          {
            class: "badge bg-secondary me-1",
            href: `/tag/${tid}?show_list=${typePlural(entity.type)}`,
          },
          text(tagsById[tid]?.name || "")
        )
      );

      // Add-tag dropdown (appears on hover)
      const addTagDropdown = div(
        { class: "dropdown d-inline ms-1" },
        span(
          {
            class: "badge bg-secondary add-tag",
            "data-bs-toggle": "dropdown",
            "aria-haspopup": "true",
            "aria-expanded": "false",
            "data-boundary": "viewport",
            title: req.__("Add tag"),
          },
          i({ class: "fas fa-plus fa-sm" })
        ),
        div(
          { class: "dropdown-menu dropdown-menu-end" },
          ...tags
            .filter((t: any) => !tagIds.includes(t.id))
            .map((t: any) =>
              post_dropdown_item(
                `/tag-entries/add-tag-entity/${encodeURIComponent(
                  t.name
                )}/${typePlural(entity.type)}/${entity.id}${on_done_redirect_str}`,
                t.name,
                req
              )
            )
        )
      );

      // searchable content
      const searchableValues = [entity.name.toLowerCase(), entity.type];
      Object.entries(entity.metadata).forEach(([k, v]: any) => {
        if (v && typeof v === "string") searchableValues.push(v.toLowerCase());
      });

      // Compute main link: configure entity for pages/views, otherwise default
      const mainLinkHref =
        entity.type === "page"
          ? `/pageedit/edit/${encodeURIComponent(entity.name)}${on_done_redirect_str}`
          : entity.type === "view"
            ? `/viewedit/config/${encodeURIComponent(entity.name)}${on_done_redirect_str}`
            : entity.type === "trigger"
              ? `/actions/configure/${encodeURIComponent(entity.id)}${on_done_redirect_str}`
              : entity.viewLink;
      const tableMeta =
        entity.type === "table" ? Table.findOne(entity.name) : null;
      const minRoleRead =
        entity.type === "table" ? tableMeta?.min_role_read : undefined;
      const minRoleWrite =
        entity.type === "table" ? tableMeta?.min_role_write : undefined;
      const external =
        entity.type === "table" ? tableMeta?.external : undefined;
      const minRole =
        entity.type !== "table" ? entity.metadata?.min_role : undefined;
      const roleMetadata =
        entity.type === "table"
          ? {
              ...entity.metadata,
              min_role_read: minRoleRead,
              min_role_write: minRoleWrite,
              external,
            }
          : { ...entity.metadata, min_role: minRole };
      const actionsMenu = buildActionMenu(entity);
      const runCell = (() => {
        if (entity.type === "view") {
          return a(
            {
              href: entity.viewLink,
              class: "link-primary text-decoration-none",
            },
            // i({ class: "fas fa-play me-1" }),
            req.__("Run")
          );
        }
        if (entity.type === "page") {
          return a(
            {
              href: entity.viewLink,
              class: "link-primary text-decoration-none",
            },
            // i({ class: "fas fa-play me-1" }),
            req.__("Run")
          );
        }
        if (entity.type === "trigger") {
          return a(
            {
              href: `/actions/testrun/${entity.id}${on_done_redirect_str}`,
              class: "link-primary text-decoration-none text-nowrap",
            },
            // i({ class: "fas fa-running me-1" }),
            req.__("Test run")
          );
        }
        return "";
      })();
      return tr(
        {
          class: "entity-row",
          "data-entity-type": entity.type,
          "data-entity-name": entity.name.toLowerCase(),
          "data-entity-label": entity.name,
          "data-entity-id": entity?.id ?? "",
          "data-entity-key": key,
          "data-installed":
            typeof entity.metadata?.installed === "boolean"
              ? String(entity.metadata.installed)
              : "",
          "data-module-kind": entity.metadata?.type || "",
          "data-searchable": searchableValues.join(" "),
          "data-tags": tagIds.join(" "),
          "data-min-role-read":
            typeof minRoleRead !== "undefined" ? String(minRoleRead) : "",
          "data-min-role-write":
            typeof minRoleWrite !== "undefined" ? String(minRoleWrite) : "",
          "data-min-role":
            typeof minRole !== "undefined" ? String(minRole) : "",
          "data-external":
            typeof external !== "undefined" ? String(external) : "",
          ...(entity.updated_at
            ? { "data-updated-at": entity.updated_at }
            : {}),
        },
        td(entityTypeBadge(entity.type)),
        td(
          entity.type === "view" &&
            !entity.metadata.table_id &&
            !entity.metadata.has_config
            ? span({ class: "fw-bold" }, text(entity.name))
            : a({ href: mainLinkHref, class: "fw-bold" }, text(entity.name))
        ),
        td(runCell),
        td(detailsContent(entity, req, roles)),
        td(
          text(
            roleLabel(
              {
                ...entity,
                metadata: roleMetadata,
              },
              roles
            )
          )
        ),
        td(div(...tagBadges, addTagDropdown)),
        td(actionsMenu || "")
      );
    });

    const entitiesList = div(
      { class: "table-responsive" },
      table(
        {
          id: "entities-list",
          class: "table table-sm table-hover align-middle",
        },
        thead(headerRow),
        tbody({ id: "entities-recent-body", class: "d-none" }),
        tbody(
          {
            id: "entities-main-body",
            ...(initially_hidden ? { style: { opacity: "0" } } : {}),
          },
          ...bodyRows
        )
      )
    );

    const noResultsMessage = div(
      {
        id: "no-results",
        class: "text-center text-muted py-5 d-none",
      },
      div({ class: "h5" }, req.__("No entities found")),
      div(req.__("Try adjusting your search or filter options"))
    );

    const styles = `
      <style>
        /* Temporary fallback selection bg color */
        :root {
          --bs-secondary-bg-fallback: #ececec;
        }
        [data-bs-theme="dark"] {
          --bs-secondary-bg-fallback: #2c2c2c;
        }
        .entity-row td { vertical-align: middle; }
        .entity-row { user-select: none; }
        .entity-row-selection-disabled {
          cursor: not-allowed;
          /* opacity: 0.8; */
        }
        .entity-filter-btn { transition: all 0.15s ease-in-out; max-width: 105px; }
        .tag-filter-btn { transition: all 0.15s ease-in-out; }
        /* Show plus badge only on hover over tag cell */
        td:nth-child(6) .add-tag { visibility: hidden; cursor: pointer; }
        tr:hover td:nth-child(6) .add-tag { visibility: visible; }
               
        #entity-more-btn:not(.d-none) {
          border-top-right-radius: 0.25rem !important;
          border-bottom-right-radius: 0.25rem !important;
          max-width: 80px;
        }
        #entity-less-btn:not(.d-none) {
          max-width: 80px;
        }
        .entity-section-header-row td {
          padding: 3px 8px;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--bs-secondary-color, #6c757d);
          background: var(--bs-secondary-bg, #f8f9fa);
          border-bottom: 1px solid var(--bs-border-color, #dee2e6);
          user-select: none;
        }
        .entity-row-recent td { opacity: 0.88; }
        @keyframes entity-row-flash {
          0%   { background-color: var(--bs-warning-bg-subtle, #fff3cd); }
          100% { background-color: var(--bs-table-bg, transparent); }
        }
        #entities-list .entity-row-flash > td,
        #entities-list .entity-row-flash > th {
          animation: entity-row-flash 2.5s ease-out;
        }
      </style>
    `;

    res.sendWrap(
      {
        title: req.__("Entities"),
        headers: [{ headerTag: styles }],
      },
      {
        above: [
          {
            type: "card",
            class: "mt-0 card-max-full-screen",
            title: req.__("All entities"),
            contents: [
              div(
                { class: "d-flex flex-column gap-0" },
                searchBox,
                filtersRow,
                selectionBar,
                div(
                  { class: "flex-grow-1 card-max-full-screen-scroll" },
                  entitiesList,
                  noResultsMessage
                )
              ),
              script(
                domReady(/*js*/ `
        window.ENTITY_ROLES = ${JSON.stringify(roles)};
        window.TXT_DISABLED = ${JSON.stringify(req.__("Disabled"))};
        window.TXT_CONFIGURABLE = ${JSON.stringify(req.__("Configurable"))};
        window.TXT_THEME = ${JSON.stringify(req.__("Theme"))};
        window.TXT_LOCAL = ${JSON.stringify(req.__("Local"))};
        window.TXT_INSTALLED = ${JSON.stringify(req.__("Installed"))};
        window.TXT_MODULE = ${JSON.stringify(req.__("Module"))};
        window.TXT_PACK = ${JSON.stringify(req.__("Pack"))};
        window.TXT_INFO = ${JSON.stringify(req.__("Info"))};
        window.TXT_AUTH = ${JSON.stringify(req.__("Authentication"))};
        window.TXT_MOBILE = ${JSON.stringify(req.__("Mobile"))};
        window.ENTITY_DEEP_SEARCH = null;

        document.getElementById("entities-main-body").style.opacity = "1";
        entitiesListInit({
          LEGACY_LINK_META: ${JSON.stringify(legacyLinkMeta)},
          TAGS_BY_ID: ${JSON.stringify(Object.fromEntries(tags.map((t: any) => [t.id, t.name])))},
          ROLES_BY_ID: ${JSON.stringify(Object.fromEntries(roles.map((r: any) => [r.id, r.role])))},
          TXT_SELECTED: ${JSON.stringify(req.__("selected"))},
          TXT_DELETE_SELECTED_CONFIRM: ${JSON.stringify(req.__("Delete %s selected items?"))},
          TXT_DELETE_SELECTED_FALLBACK: ${JSON.stringify(req.__("Delete selected items?"))},
          TXT_DELETE_FAILED: ${JSON.stringify(req.__("Failed to delete selected items"))},
        });
        `)
              ),
            ],
            footer: div(
              {
                class: "d-flex flex-wrap gap-2",
              },
              a(
                {
                  href: `/table/new/${on_done_redirect_str}`,
                  class: "btn btn-secondary",
                },
                i({ class: "fas fa-table me-1" }),
                req.__("Create table")
              ),
              a(
                {
                  href: `/viewedit/new${on_done_redirect_str}`,
                  class: "btn btn-secondary",
                },
                i({ class: "fas fa-eye me-1" }),
                req.__("Create view")
              ),
              a(
                {
                  href: `/pageedit/new${on_done_redirect_str}`,
                  class: "btn btn-secondary",
                },
                i({ class: "fas fa-file me-1" }),
                req.__("Create page")
              ),
              a(
                {
                  href: `/actions/new${on_done_redirect_str}`,
                  class: "btn btn-secondary",
                },
                i({ class: "fas fa-play me-1" }),
                req.__("Create trigger")
              ),
              a(
                {
                  id: "legacy-entity-link",
                  class: "btn btn-outline-secondary d-none",
                  href: "#",
                },
                i({ class: "fas fa-list me-1" }),
                span({ class: "legacy-label" }, req.__("Open legacy list"))
              )
            ),
          },
        ],
      }
    );
  })
);

/**
 * AJAX endpoint to fetch extended entities (modules, users)
 */
router.get(
  "/extended",
  isAdminOrHasConfigMinRole("min_role_edit_views"),
  error_catcher(async (req: Req, res: Res) => {
    const includeAllModules =
      req.query.include_all_modules === "1" ||
      req.query.include_all_modules === "true";
    const extendedEntities = await getExtendedEntites(req, {
      includeAllModules,
    });
    res.json({
      entities: extendedEntities.map((entity: any) => ({
        type: entity.type,
        name: entity.name,
        id: entity.id,
        viewLink: entity.viewLink,
        editLink: entity.editLink,
        metadata: entity.metadata,
        actionsHtml: entity.actionsHtml || "",
      })),
    });
  })
);

router.post(
  "/bulk-delete",
  isAdminOrHasConfigMinRole("min_role_edit_views"),
  error_catcher(async (req: Req, res: Res) => {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length)
      return res.status(400).json({ error: "No items selected" });

    const deletedKeys = [];
    const errors = [];
    const installedPackNames = new Set(
      getState()!.getConfig("installed_packs", []) || []
    );
    const asNumber = (val: any) => {
      if (val === null || typeof val === "undefined") return null;
      if (val === "") return null;
      const num = Number(val);
      return Number.isNaN(num) ? null : num;
    };

    for (const item of items) {
      const type = item?.type;
      const id = asNumber(item?.id);
      const name = item?.name;
      const key = item?.key;
      try {
        if (type === "table" && id) {
          const table = Table.findOne({ id });
          if (!table) throw new Error("Table not found");
          await table.delete(false);
          if (key) deletedKeys.push(key);
        } else if (type === "view" && id) {
          const view = View.findOne({ id });
          if (!view) throw new Error("View not found");
          await view.delete();
          if (key) deletedKeys.push(key);
        } else if (type === "page" && id) {
          const page = Page.findOne({ id });
          if (!page) throw new Error("Page not found");
          await page.delete();
          if (key) deletedKeys.push(key);
        } else if (type === "trigger" && id) {
          const trigger = await Trigger.findOne({ id });
          if (!trigger) throw new Error("Trigger not found");
          await trigger.delete();
          if (key) deletedKeys.push(key);
        } else if (type === "module" && name) {
          const isPack = installedPackNames.has(name);
          if (isPack) {
            const pack = await fetch_pack_by_name(name);
            if (!pack) throw new Error("Pack not found");
            await db.withTransaction(async () => {
              await uninstall_pack(pack.pack, name);
            });
            await getState()!.refresh();
          } else {
            const plugin = await Plugin.findOne({ name });
            if (!plugin) throw new Error("Plugin not found");
            await plugin.delete();
          }
          if (key) deletedKeys.push(key);
        } else if (type === "user" && id) {
          const user = await User.findOne({ id });
          if (!user) throw new Error("User not found");
          await user.delete();
          if (key) deletedKeys.push(key);
        } else {
          throw new Error("Invalid item type or id: " + JSON.stringify(item));
        }
      } catch (e: any) {
        const isPack = type === "module" && installedPackNames.has(name);
        errors.push({
          type: isPack ? "pack" : type,
          isPack,
          id,
          name,
          key,
          message: e.message,
        });
      }
    }

    res.status(errors.length ? 207 : 200).json({
      ok: errors.length === 0,
      deletedKeys,
      errors,
    });
  })
);

const idField = (entryType: any) => {
  switch (entryType) {
    case "table":
    case "tables":
      return "table_id";
    case "view":
    case "views":
      return "view_id";
    case "page":
    case "pages":
      return "page_id";
    case "trigger":
    case "triggers":
      return "trigger_id";
    default:
      return null;
  }
};

router.post(
  "/bulk-apply-tag",
  isAdminOrHasConfigMinRole([
    "min_role_edit_tables",
    "min_role_edit_views",
    "min_role_edit_pages",
    "min_role_edit_triggers",
  ]),
  error_catcher(async (req: Req, res: Res) => {
    const { items, tag_id } = req.body || {};
    const tagIdNum = Number(tag_id);
    if (!Array.isArray(items) || !items.length || Number.isNaN(tagIdNum)) {
      return res.status(400).json({ error: "Invalid request" });
    }
    const tag = await Tag.findOne({ id: tagIdNum });
    if (!tag) return res.status(404).json({ error: "Tag not found" });
    for (const item of items) {
      const field = idField(item?.type);
      const id = Number(item?.id);
      if (!field || Number.isNaN(id)) continue;
      await db.withTransaction(async () => {
        await tag.addEntry({ [field]: id });
      });
    }
    res.json({ ok: true });
  })
);

router.post(
  "/bulk-set-role",
  isAdminOrHasConfigMinRole([
    "min_role_edit_tables",
    "min_role_edit_views",
    "min_role_edit_pages",
  ]),
  error_catcher(async (req: Req, res: Res) => {
    const { items, role_id, mode } = req.body || {};
    const roleIdNum = Number(role_id);
    const validMode = mode === "read" || mode === "write";
    if (
      !Array.isArray(items) ||
      !items.length ||
      Number.isNaN(roleIdNum) ||
      !validMode
    ) {
      return res.status(400).json({ error: "Invalid request" });
    }
    const role = await Role.findOne({ id: roleIdNum });
    if (!role) return res.status(404).json({ error: "Role not found" });

    const errors = [];
    const updatedKeys = [];

    for (const item of items) {
      const type = item?.type;
      const idNum = Number(item?.id);
      const id = Number.isNaN(idNum) ? null : idNum;
      const key = item?.key;
      try {
        if (type === "table") {
          const table =
            (id !== null ? Table.findOne({ id }) : null) ||
            Table.findOne({ name: item?.name });
          if (!table) throw new Error("Table not found");
          const update = {};
          if (mode === "read") update.min_role_read = roleIdNum;
          if (mode === "write") update.min_role_write = roleIdNum;
          if (!Object.keys(update).length)
            throw new Error("No fields to update");
          await table.update(update);
          if (key) updatedKeys.push(key);
        } else if (mode === "read" && type === "view") {
          const view =
            (id !== null ? View.findOne({ id }) : null) ||
            View.findOne({ name: item?.name });
          if (!view) throw new Error("View not found");
          if (view.id && typeof view.id !== "undefined") {
            await View.update({ min_role: roleIdNum }, id);
          } // Might need to add an option to update tableless views like SQL which have no id but only name
          if (key) updatedKeys.push(key);
        } else if (mode === "read" && type === "page") {
          const page =
            (id !== null ? Page.findOne({ id }) : null) ||
            Page.findOne({ name: item?.name });
          if (!page) throw new Error("Page not found");
          await Page.update(id, { min_role: roleIdNum });
          if (key) updatedKeys.push(key);
        } else {
          throw new Error("Unsupported item type for role change");
        }
      } catch (e: any) {
        errors.push({ type, id, key, message: e.message });
      }
    }

    res.status(errors.length ? 207 : 200).json({
      ok: errors.length === 0,
      updatedKeys,
      errors,
    });
  })
);

router.post(
  "/download-pack",
  isAdminOrHasConfigMinRole("min_role_edit_views"),
  error_catcher(async (req: Req, res: Res) => {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: "No items" });

    const pack = {
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

    const added = {
      table: new Set(),
      view: new Set(),
      page: new Set(),
      trigger: new Set(),
      module: new Set(),
    };

    for (const item of items) {
      const type = item?.type;
      const id = Number(item?.id);
      const name = item?.name;
      if (
        !type ||
        !["table", "view", "page", "trigger", "module"].includes(type)
      )
        continue;

      if (!Number.isNaN(id) && added[type].has(id)) continue;

      switch (type) {
        case "table": {
          const table = !Number.isNaN(id)
            ? Table.findOne({ id })
            : name
              ? Table.findOne({ name })
              : null;
          if (table) {
            pack.tables.push(await table_pack(table));
            if (!Number.isNaN(id)) added.table.add(id);
          }
          break;
        }
        case "view": {
          const view = !Number.isNaN(id)
            ? View.findOne({ id })
            : name
              ? View.findOne({ name })
              : null;
          if (view) {
            pack.views.push(await view_pack(view));
            if (!Number.isNaN(id)) added.view.add(id);
          }
          break;
        }
        case "page": {
          const page = !Number.isNaN(id)
            ? Page.findOne({ id })
            : name
              ? Page.findOne({ name })
              : null;
          if (page) {
            pack.pages.push(await page_pack(page));
            if (!Number.isNaN(id)) added.page.add(id);
          }
          break;
        }
        case "trigger": {
          const trigger = !Number.isNaN(id)
            ? await Trigger.findOne({ id })
            : name
              ? await Trigger.findOne({ name })
              : null;
          if (trigger) {
            pack.triggers.push(await trigger_pack(trigger));
            if (!Number.isNaN(id)) added.trigger.add(id);
          }
          break;
        }
        case "module": {
          const plugin = !Number.isNaN(id)
            ? await Plugin.findOne({ id })
            : name
              ? await Plugin.findOne({ name })
              : null;
          const packModule = await fetch_pack_by_name(name);
          if (plugin) {
            pack.plugins.push(await plugin_pack(plugin.name));
            if (!Number.isNaN(id)) added.module.add(id);
            break;
          }
          if (packModule) {
            pack.plugins.push(packModule);
            if (!Number.isNaN(id)) added.module.add(id);
            break;
          }
        }
        default:
          break;
      }
    }

    const hasContent =
      pack.tables.length ||
      pack.views.length ||
      pack.pages.length ||
      pack.triggers.length ||
      pack.plugins.length;

    if (!hasContent) {
      return res.status(404).json({ error: "No packs available" });
    }

    const filenameBase = (() => {
      if (items.length === 1) {
        const label = items[0].name || items[0].type || "pack";
        return label.toString().replace(/[^a-zA-Z0-9_-]+/g, "_");
      }
      return "selected-entities-pack";
    })();

    res.json({
      ok: true,
      packs: [
        {
          name: filenameBase || "entities-pack",
          content: pack,
        },
      ],
    });
  })
);
