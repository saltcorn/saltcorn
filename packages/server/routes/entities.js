/**
 * Entities Router - Unified view of all system entities
 * @category server
 * @module routes/entities
 * @subcategory routes
 */

const Router = require("express-promise-router");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
const Page = require("@saltcorn/data/models/page");
const Trigger = require("@saltcorn/data/models/trigger");
const Tag = require("@saltcorn/data/models/tag");
const TagEntry = require("@saltcorn/data/models/tag_entry");
const User = require("@saltcorn/data/models/user");
const Role = require("@saltcorn/data/models/role");
const Plugin = require("@saltcorn/data/models/plugin");
const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");
const {
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
} = require("@saltcorn/markup/tags");
const {
  post_dropdown_item,
  settingsDropdown,
  post_btn,
} = require("@saltcorn/markup");
const {
  view_dropdown,
  page_dropdown,
  trigger_dropdown,
} = require("./common_lists.js");
const { error_catcher, isAdminOrHasConfigMinRole } = require("./utils.js");
const {
  fetch_pack_by_name,
  fetch_available_packs,
  table_pack,
  view_pack,
  page_pack,
  trigger_pack,
  uninstall_pack,
  plugin_pack,
} = require("@saltcorn/admin-models/models/pack");
const { escapeHtml } = require("@saltcorn/data/utils");

/**
 * @type {object}
 * @const
 * @namespace entitiesRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

// Ensure on_done_redirect values remain relative to the app root
const stripLeadingSlash = (path = "") =>
  path.startsWith("/") ? path.slice(1) : path;

/**
 * Get additional entities (modules, users)
 */
const req__ = (req, s) => (req && req.__(s)) || s;

const getExtendedEntites = async (req, { includeAllModules = false } = {}) => {
  const entities = [];
  const can_reset = getState().getConfig("smtp_host", "") !== "";

  const users = await User.find({}, { cached: true });
  users.forEach((u) => {
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

  const statePlugins = getState().plugins;
  const csrfToken = req?.csrfToken ? req.csrfToken() : null;
  const packs = getState().getConfig("installed_packs", []);
  const installedPackNames = new Set(packs);
  const packDetails = await Promise.all(
    packs.map(async (pname) => {
      try {
        return (await fetch_pack_by_name(pname)) || { name: pname };
      } catch (e) {
        getState().log?.(
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
    storeModules.forEach((mod) => {
      if (mod?.name) storeModuleSummaries.set(mod.name, mod);
    });
  } catch (e) {
    getState().log?.(2, `Failed to fetch available modules: ${e.message}`);
  }
  if (includeAllModules) {
    try {
      const availablePacks = await fetch_available_packs();
      availablePacks.forEach((pack) => {
        if (pack?.name) availablePackSummaries.set(pack.name, pack);
      });
    } catch (e) {
      getState().log?.(2, `Failed to fetch available packs: ${e.message}`);
    }
  }

  const buildModuleActions = (moduleName, installed) => {
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
    .filter((mod) => mod.name !== "base")
    .forEach((mod) => {
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
          (mod) => mod.name !== "base" && !installedModuleNames.has(mod.name)
        )
        .forEach((mod) => {
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
    } catch (e) {
      getState().log?.(2, `Failed to fetch available modules: ${e.message}`);
    }
  }

  const buildPackActions = (packName, installed) => {
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

  packDetails.forEach((pack) => {
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

const buildUserActionsDropdown = (user, req, can_reset) => {
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
      getState().getConfig("verification_view", "") &&
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
  const tableNameById = new Map(tables.map((t) => [t.id, t.name]));
  const views = await View.find({}, { cached: true });
  const pages = await Page.find({}, { cached: true });
  const triggers = await Trigger.findAllWithTableName();

  const entities = [];

  // Add tables
  tables.forEach((t) => {
    entities.push({
      type: "table",
      name: t.name,
      id: t.id,
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
  views.forEach((v) => {
    const has_config =
      v.configuration &&
      typeof v.configuration === "object" &&
      Object.keys(v.configuration).length > 0;
    entities.push({
      type: "view",
      name: v.name,
      id: v.id,
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
  pages.forEach((p) => {
    entities.push({
      type: "page",
      name: p.name,
      id: p.id,
      viewLink: `/page/${encodeURIComponent(p.name)}`,
      editLink: `/pageedit/edit/${encodeURIComponent(p.name)}`,
      metadata: {
        description: p.description,
        min_role: p.min_role,
      },
    });
  });

  // Add triggers
  triggers.forEach((tr) => {
    entities.push({
      type: "trigger",
      name: tr.name,
      id: tr.id,
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
  entities.sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", undefined, {
      sensitivity: "base",
    })
  );

  return entities;
};

/**
 * Generate entity type badge
 */
const entityTypeBadge = (type) => {
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
const detailsContent = (entity, req, roles) => {
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
      ? roles.find((r) => r.id === entity.metadata.role_id)?.role
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
const roleLabel = (entity, roles) => {
  const getRole = (rid) => roles.find((r) => r.id === rid)?.role || "?";
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

const tableActionsDropdown = (entity, req, user_can_edit_tables) => {
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
 * Main entities list page
 */
router.get(
  "/",
  isAdminOrHasConfigMinRole("min_role_edit_views"),
  error_catcher(async (req, res) => {
    const entities = await getAllEntities();
    const deepSearchIndex = {};
    const addDeepSearch = (key, pack) => {
      if (!pack) return;
      try {
        deepSearchIndex[key] = escapeHtml(JSON.stringify(pack).toLowerCase());
      } catch (e) {
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
      } catch (e) {
        getState().log?.(
          2,
          `Failed to build deep search index for ${keyById}: ${e.message}`
        );
      }
    }
    // fetch roles and tags
    const roles = await Role.find({}, { orderBy: "id" });
    const tags = await Tag.find();
    const tagEntries = await TagEntry.find();
    const userRoleId = req.user?.role_id ?? Infinity;
    const user_can_edit_tables =
      userRoleId === 1 ||
      getState().getConfig("min_role_edit_tables", 1) >= userRoleId;
    const on_done_redirect_str = `?on_done_redirect=${encodeURIComponent(
      stripLeadingSlash(req.originalUrl || "")
    )}`;
    const buildActionMenu = (entity) => {
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
    tags.forEach((t) => (tagsById[t.id] = t));

    const tagsByEntityKey = new Map();
    const addTag = (key, tag_id) => {
      const arr = tagsByEntityKey.get(key) || [];
      if (!arr.includes(tag_id)) arr.push(tag_id);
      tagsByEntityKey.set(key, arr);
    };
    tagEntries.forEach((te) => {
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
          class: "btn btn-sm btn-outline-primary entity-filter-btn",
          "data-entity-type": "table",
          title: req.__("Show tables (Alt+T)"),
        },
        i({ class: "fas fa-table me-1" }),
        req.__("Tables")
      ),
      button(
        {
          type: "button",
          class: "btn btn-sm btn-outline-primary entity-filter-btn",
          "data-entity-type": "view",
          title: req.__("Show views (Alt+V)"),
        },
        i({ class: "fas fa-eye me-1" }),
        req.__("Views")
      ),
      button(
        {
          type: "button",
          class: "btn btn-sm btn-outline-primary entity-filter-btn",
          "data-entity-type": "page",
          title: req.__("Show pages (Alt+P)"),
        },
        i({ class: "fas fa-file me-1" }),
        req.__("Pages")
      ),
      button(
        {
          type: "button",
          class: "btn btn-sm btn-outline-primary entity-filter-btn",
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
      ...tags.map((t) =>
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
            ...roles.map((r) => option({ value: r.id }, r.role))
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
            option({ value: "" }, req.__("Set access role")),
            ...roles.map((r) => option({ value: r.id }, r.role))
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
            option({ value: "" }, req.__("Select tag")),
            ...tags.map((t) => option({ value: t.id }, t.name))
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

    const typePlural = (t) =>
      ({ table: "tables", view: "views", page: "pages", trigger: "triggers" })[
        t
      ];

    const legacyLinkMeta = {
      table: { href: "/table", label: req.__("Go to tables list") },
      view: { href: "/viewedit", label: req.__("Go to views list") },
      page: { href: "/pageedit", label: req.__("Go to pages list") },
      trigger: { href: "/actions", label: req.__("Go to triggers list") },
    };

    const bodyRows = entities.map((entity) => {
      const key = `${entity.type}:${
        entity.type === "view" ? (entity.id ?? entity.name) : entity.id
      }`;
      const tagIds = tagsByEntityKey.get(key) || [];
      const deepSearchable =
        deepSearchIndex[key] ||
        (entity.type === "view"
          ? deepSearchIndex[`${entity.type}:${entity.name}`]
          : undefined);
      const tagBadges = tagIds.map((tid) =>
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
            .filter((t) => !tagIds.includes(t.id))
            .map((t) =>
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
      Object.entries(entity.metadata).forEach(([k, v]) => {
        if (v && typeof v === "string") searchableValues.push(v.toLowerCase());
      });

      // Compute main link: configure entity for pages/views, otherwise default
      const mainLinkHref =
        entity.type === "page"
          ? `/pageedit/edit/${encodeURIComponent(entity.name)}${on_done_redirect_str}`
          : entity.type === "view"
            ? `/viewedit/config/${encodeURIComponent(entity.name)}${on_done_redirect_str}`
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
          "data-deep-searchable": deepSearchable || searchableValues.join(" "),
          "data-tags": tagIds.join(" "),
          "data-min-role-read":
            typeof minRoleRead !== "undefined" ? String(minRoleRead) : "",
          "data-min-role-write":
            typeof minRoleWrite !== "undefined" ? String(minRoleWrite) : "",
          "data-min-role":
            typeof minRole !== "undefined" ? String(minRole) : "",
          "data-external":
            typeof external !== "undefined" ? String(external) : "",
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
        tbody(...bodyRows)
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

    const clientScript = script(
      domReady(/*js*/ `
        const searchInput = document.getElementById("entity-search");
        const deepSearchToggle = document.getElementById("entity-deep-search");
        const entitiesList = document.getElementById("entities-list");
        const noResults = document.getElementById("no-results");
        const filterButtons = document.querySelectorAll(".entity-filter-btn");
        const filterButtonsByType = {};
        filterButtons.forEach((btn) => {
          const type = btn.dataset.entityType;
          if (type) filterButtonsByType[type] = btn;
        });
        const tagButtons = document.querySelectorAll(".tag-filter-btn");
        const LEGACY_LINK_META = ${JSON.stringify(legacyLinkMeta)};
        const legacyButton = document.getElementById("legacy-entity-link");
        const legacyLabel = legacyButton ? legacyButton.querySelector(".legacy-label") : null;
        const filtersRow = document.getElementById("entity-filters-row");
        const selectionBar = document.getElementById("entity-selection-bar");
        const selectionCountEl = document.getElementById("entity-selection-count");
        const clearSelectionBtn = document.getElementById("entity-clear-selection");
        const bulkDeleteBtn = document.getElementById("entity-bulk-delete");
        const bulkTagSelect = document.getElementById("entity-bulk-tag-select");
        const bulkApplyTagBtn = document.getElementById("entity-bulk-apply-tag");
        const bulkDownloadPackBtn = document.getElementById("entity-bulk-download-pack");
        const bulkRoleReadSelect = document.getElementById("entity-bulk-role-read-select");
        const bulkApplyRoleReadBtn = document.getElementById("entity-bulk-apply-role-read");
        const bulkRoleWriteSelect = document.getElementById("entity-bulk-role-write-select");
        const bulkApplyRoleWriteBtn = document.getElementById("entity-bulk-apply-role-write");
        const bulkRoleReadGroup = document.getElementById("entity-bulk-role-read-group");
        const bulkRoleWriteGroup = document.getElementById("entity-bulk-role-write-group");
        const entitiesTbody = entitiesList ? entitiesList.querySelector("tbody") : null;
        const TAGS_BY_ID = ${JSON.stringify(Object.fromEntries(tags.map((t) => [t.id, t.name])))};
        const ROLES_BY_ID = ${JSON.stringify(Object.fromEntries(roles.map((r) => [r.id, r.role])))};

        const TXT_SELECTED = ${JSON.stringify(req.__("selected"))};
        const TXT_DELETE_SELECTED_CONFIRM = ${JSON.stringify(req.__("Delete %s selected items?"))};
        const TXT_DELETE_SELECTED_FALLBACK = ${JSON.stringify(req.__("Delete selected items?"))};
        const TXT_DELETE_FAILED = ${JSON.stringify(req.__("Failed to delete selected items"))};

        const BASE_TYPES = ["table","view","page","trigger"];
        const EXTENDED_TYPES = window.ENTITY_EXTENDED_TYPES || ["module","user"];
        const ALL_TYPES = BASE_TYPES.concat(EXTENDED_TYPES);

        const selectedKeys = new Set();
        let lastSelectedIndex = null;

        const isRowSelectable = (row) => {
          if (!row) return false;
          const type = row.dataset.entityType;
          const installed = row.dataset.installed !== 'false';
          const moduleKind = (row.dataset.moduleKind || '').toLowerCase();
          if (type === 'module' && !installed) return false;
          return true;
        };

        const findRowByKey = (key) =>
          Array.from(document.querySelectorAll('.entity-row')).find(
            (row) => row.dataset.entityKey === key
          );

        const selectionPayloadFromRow = (row) => {
          if (!row) return null;
          return {
            key: row.dataset.entityKey,
            type: row.dataset.entityType,
            id: row.dataset.entityId || null,
            name: row.dataset.entityLabel || row.dataset.entityName || "",
            installed: row.dataset.installed,
            moduleKind: row.dataset.moduleKind,
          };
        };

        const getVisibleRows = () =>
          Array.from(document.querySelectorAll('.entity-row')).filter(
            (row) => row.style.display !== 'none'
          );

        const getSelectableVisibleRows = () =>
          getVisibleRows().filter((row) => isRowSelectable(row));

        const isTypingTarget = (el) => {
          if (!el) return false;
          if (el.isContentEditable) return true;
          const tag = el.tagName;
          if (!tag) return false;
          const tagName = tag.toUpperCase();
          if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return true;
          return !!el.closest('[contenteditable="true"]');
        };

        const refreshSelectionStyles = () => {
          document.querySelectorAll('.entity-row').forEach((row) => {
            const key = row.dataset.entityKey;
            if (!isRowSelectable(row) && selectedKeys.has(key)) {
              selectedKeys.delete(key);
            }
            if (selectedKeys.has(key)) {
              row.classList.add('table-active', 'entity-row-selected');
            } else {
              row.classList.remove('table-active', 'entity-row-selected');
            }
          });
        };

        const syncSelectBorder = (el, varName) => {
          if (!el) return;
          const disabledBorder =
            'color-mix(in srgb, var(--bs-btn-disabled-color, var(--bs-secondary)) 70%, transparent)';
          const enabledBorder = 'var(--bs-secondary)';
          const borderColor = el.disabled ? disabledBorder : enabledBorder;
          el.style.setProperty(varName, borderColor);
        };

        const markSelectChangedByUser = (sel) => {
          if (sel) sel.dataset.userSelected = 'true';
        };

        const resetSelectUserFlag = (sel) => {
          if (sel) sel.dataset.userSelected = '';
        };

        const updateSelectionUI = () => {
          refreshSelectionStyles();
          const count = selectedKeys.size ?? 0;
          if (selectionCountEl) {
            const suffix = TXT_SELECTED || 'selected';
            selectionCountEl.textContent = count + ' ' + suffix;
          }
          if (filtersRow && selectionBar) {
            if (count > 0) {
              filtersRow.classList.add('d-none');
              selectionBar.classList.remove('d-none');
            } else {
              filtersRow.classList.remove('d-none');
              selectionBar.classList.add('d-none');
            }
          }
          if (bulkDeleteBtn) bulkDeleteBtn.disabled = count === 0;
          if (clearSelectionBtn) clearSelectionBtn.disabled = count === 0;
          const items = Array.from(selectedKeys)
            .map((key) => selectionPayloadFromRow(findRowByKey(key)))
            .filter(Boolean);
          const hasTaggable = items.some((item) => isTaggableType(item.type));
          const hasDownloadable = items.some((item) => isDownloadableEntity(item));
          const hasAccessRoleEntities = items.some((item) =>
            ["table","view","page"].includes(item.type)
          );
          const hasWriteRoleEntities = items.some((item) => item.type === "table");
          if (items.length === 1) {
            const only = items[0];
            const row = findRowByKey(only.key);
            if (row && bulkRoleReadSelect && bulkRoleReadSelect.dataset.userSelected !== 'true') {
              const initRead =
                only.type === 'table'
                  ? row.dataset.minRoleRead || ''
                  : row.dataset.minRole || '';
              bulkRoleReadSelect.value = initRead || '';
            }
            if (row && bulkRoleWriteSelect && only.type === 'table' && bulkRoleWriteSelect.dataset.userSelected !== 'true') {
              const initWrite = row.dataset.minRoleWrite || '';
              bulkRoleWriteSelect.value = initWrite || '';
            }
          } else if (items.length === 0) {
            if (bulkRoleReadSelect) {
              bulkRoleReadSelect.value = '';
              resetSelectUserFlag(bulkRoleReadSelect);
            }
            if (bulkRoleWriteSelect) {
              bulkRoleWriteSelect.value = '';
              resetSelectUserFlag(bulkRoleWriteSelect);
            }
          }
          if (bulkTagSelect) {
            bulkTagSelect.disabled = !(count > 0 && hasTaggable);
            syncSelectBorder(bulkTagSelect, '--entity-bulk-tag-border');
          }
          if (bulkApplyTagBtn) {
            const tagSelected = bulkTagSelect && bulkTagSelect.value;
            bulkApplyTagBtn.disabled = !(count > 0 && hasTaggable && tagSelected);
          }
          if (bulkRoleReadSelect) {
            bulkRoleReadSelect.disabled = !(count > 0 && hasAccessRoleEntities);
            syncSelectBorder(bulkRoleReadSelect, '--entity-bulk-role-border');
          }
          if (bulkApplyRoleReadBtn) {
            const roleSelected = bulkRoleReadSelect && bulkRoleReadSelect.value;
            bulkApplyRoleReadBtn.disabled = !(count > 0 && hasAccessRoleEntities && roleSelected);
          }
          if (bulkRoleWriteSelect) {
            bulkRoleWriteSelect.disabled = !(count > 0 && hasWriteRoleEntities);
            syncSelectBorder(bulkRoleWriteSelect, '--entity-bulk-role-border');
          }
          if (bulkApplyRoleWriteBtn) {
            const roleSelected = bulkRoleWriteSelect && bulkRoleWriteSelect.value;
            bulkApplyRoleWriteBtn.disabled = !(count > 0 && hasWriteRoleEntities && roleSelected);
          }
          if (bulkRoleWriteGroup) {
            if (hasWriteRoleEntities) bulkRoleWriteGroup.classList.remove('d-none');
            else bulkRoleWriteGroup.classList.add('d-none');
          }
          if (bulkDownloadPackBtn) {
            // bulkDownloadPackBtn.disabled = !(count > 0 && hasDownloadable);
            bulkDownloadPackBtn.disabled = !(count > 0);
          }
        };

        const clearSelection = () => {
          selectedKeys.clear();
          lastSelectedIndex = null;
          updateSelectionUI();
        };

        // Track active filters
        const activeFilters = new Set([]);
        const activeTags = new Set([]);
        const isModulesFilterExclusive = () =>
          activeFilters.size === 1 && activeFilters.has("module");
        window.isModulesFilterExclusive = isModulesFilterExclusive;

        const isTaggableType = (type) => ["table","view","page","trigger"].includes(type);
        const isDownloadableEntity = (item) => {
          if (!item) return false;
          return ["table","view","page","trigger"].includes(item.type);
        };

        const updateRowTags = (row, tagId, tagName, entityType) => {
          if (!row || !tagId) return;
          const tagsCell = row.querySelector('td:nth-child(6)');
          if (!tagsCell) return;
          const dropdown = tagsCell.querySelector('.dropdown');
          const currentTags = (row.dataset.tags || '').split(' ').filter(Boolean);
          if (!currentTags.includes(String(tagId))) currentTags.push(String(tagId));
          row.dataset.tags = currentTags.join(' ');
          tagsCell.innerHTML = '';
          const pluralMap = { table: 'tables', view: 'views', page: 'pages', trigger: 'triggers' };
          currentTags.forEach((tid) => {
            const name = TAGS_BY_ID[tid] || tagName || tid;
            const plural = pluralMap[entityType] || 'tables';
            const badge = document.createElement('a');
            badge.className = 'badge bg-secondary me-1';
            badge.setAttribute('href', '/tag/' + encodeURIComponent(tid) + '?show_list=' + plural);
            badge.textContent = name;
            tagsCell.appendChild(badge);
          });
          if (dropdown) tagsCell.appendChild(dropdown);
        };

        // URL state helpers
        const updateUrl = () => {
          const params = new URLSearchParams(window.location.search);
          // search
          if (searchInput.value) params.set('q', searchInput.value);
          else params.delete('q');
          if (deepSearchToggle && deepSearchToggle.checked) params.set('deep', 'on');
          else params.delete('deep');
          // types
          ALL_TYPES.forEach(t => {
            if (activeFilters.has(t)) params.set(t+'s', 'on');
            else params.delete(t+'s');
          });
          // extended flag
          if (typeof isExtendedExpanded !== 'undefined' && isExtendedExpanded) {
            params.set('extended', 'on');
          } else {
            params.delete('extended');
          }
          // tags (comma-separated ids)
          if (activeTags.size > 0) params.set('tags', Array.from(activeTags).join(','));
          else params.delete('tags');
          const newUrl = window.location.pathname + (params.toString() ? ('?' + params.toString()) : '');
          window.history.replaceState(null, '', newUrl);
        };

        const getCurrentOnDoneTarget = () => {
          const path = window.location.pathname.startsWith("/")
            ? window.location.pathname.slice(1)
            : window.location.pathname;
          return path + window.location.search;
        };

        const shouldSkipOnDoneHref = (raw) => {
          if (!raw) return true;
          const trimmed = raw.trim();
          const lowered = trimmed.toLowerCase();
          return trimmed === "#" || trimmed === "" || lowered.startsWith("javascript:");
        };

        const toRelativeHrefWithOnDone = (raw) => {
          if (shouldSkipOnDoneHref(raw)) return null;
          try {
            const url = new URL(raw, window.location.origin);
            url.searchParams.set("on_done_redirect", getCurrentOnDoneTarget());
            return url.pathname + url.search + url.hash;
          } catch (e) {
            return null;
          }
        };

        const updateElementOnDoneHref = (el, attr) => {
          const raw = el.getAttribute(attr) || el[attr];
          const updated = toRelativeHrefWithOnDone(raw);
          if (updated) el.setAttribute(attr, updated);
        };

        const ensureOnDoneHiddenInput = (form) => {
          if (form.querySelector('input[name="on_done_redirect"]')) return;
          const hidden = document.createElement('input');
          hidden.type = 'hidden';
          hidden.name = 'on_done_redirect';
          hidden.value = getCurrentOnDoneTarget();
          form.appendChild(hidden);
        };

        const updateOnDoneRedirectTargets = () => {
          document
            .querySelectorAll('a[href*="on_done_redirect="]')
            .forEach((link) => updateElementOnDoneHref(link, "href"));
          document
            .querySelectorAll('form[action*="on_done_redirect="]')
            .forEach((form) => updateElementOnDoneHref(form, "action"));
        };

        const updateLegacyButton = () => {
          if (!legacyButton) return;
          const activeTypes = Array.from(activeFilters);
          if (activeTypes.length === 1) {
            const meta = LEGACY_LINK_META[activeTypes[0]];
            if (meta) {
              legacyButton.classList.remove("d-none");
              legacyButton.setAttribute("href", meta.href);
              if (legacyLabel) legacyLabel.textContent = meta.label;
              return;
            }
          }
          legacyButton.classList.add("d-none");
        };

        const initFromUrl = () => {
          const params = new URLSearchParams(window.location.search);
          // search
          const q = params.get('q') || '';
          if (q) searchInput.value = q;
          const deep = params.get('deep') === 'on';
          if (deep && deepSearchToggle) deepSearchToggle.checked = true;
          const shouldExpandExtended =
            params.get('extended') === 'on' ||
            EXTENDED_TYPES.some((t) => params.get(t + 's') === 'on');
          // types
          ALL_TYPES.forEach(t => {
            if (params.get(t+'s') === 'on') activeFilters.add(t);
          });
          // apply button classes for types
          filterButtons.forEach((btn) => {
            const t = btn.dataset.entityType;
            if (activeFilters.has(t)) {
              btn.classList.add('btn-primary');
              btn.classList.remove('btn-outline-primary');
            }
          });
          // tags
          const tagsParam = params.get('tags');
          if (tagsParam) {
            tagsParam.split(',').filter(Boolean).forEach(id => activeTags.add(id));
          }
          // apply button classes for tags
          tagButtons.forEach((btn) => {
            const id = btn.dataset.tagId;
            if (activeTags.has(id)) {
              btn.classList.add('active', 'btn-secondary');
              btn.classList.remove('btn-outline-secondary');
            }
          });
          return { shouldExpandExtended };
        };

        // Filter function
        function filterEntities() {
          const entityRows = document.querySelectorAll(".entity-row");
          const searchTerm = searchInput.value.toLowerCase();
          const useDeep = deepSearchToggle && deepSearchToggle.checked;
          let visibleCount = 0;
          const visibleKeys = new Set();
          const allowAllModules = isModulesFilterExclusive();
          const canShowAllModules =
            allowAllModules && typeof isExtendedExpanded !== "undefined" && isExtendedExpanded;
          if (
            canShowAllModules &&
            typeof ensureAllModulesLoaded === "function" &&
            typeof hasLoadedAllModules !== "undefined" &&
            !hasLoadedAllModules
          ) {
            ensureAllModulesLoaded();
          }

          entityRows.forEach((row, id) => {
            const entityType = row.dataset.entityType;
            const key = row.dataset.entityKey;
            const deepText =
              useDeep && window.ENTITY_DEEP_SEARCH
                ? window.ENTITY_DEEP_SEARCH[key]
                : null;
            const searchableText = useDeep ? deepText || row.dataset.deepSearchable || "" : row.dataset.searchable || "";

            const rowTags = (row.dataset.tags || "").split(" ").filter(Boolean);
            const rowInstalled = row.dataset.installed !== "false";

            // Check if entity type is active
            const typeMatch = activeFilters.has(entityType);

            // Check if search term matches
            let searchMatch = true;
            if (searchTerm) {
              searchMatch = searchableText.includes(searchTerm);
            }

            // Check tag match (OR across selected tags). If none selected, match all
            let tagMatch = true;
            if (activeTags.size > 0) {
              tagMatch = rowTags.some((tid) => activeTags.has(tid));
            }

            const moduleVisibilityOk =
              entityType !== "module" || rowInstalled || canShowAllModules;

            // Show/hide row
            if (
              (activeFilters.size === 0 || typeMatch) &&
              searchMatch &&
              tagMatch &&
              moduleVisibilityOk
            ) {
              row.style.display = "";
              visibleKeys.add(row.dataset.entityKey);
              visibleCount++;
            } else {
              row.style.display = "none";
            }
          });

          selectedKeys.forEach((key) => {
            if (!visibleKeys.has(key)) selectedKeys.delete(key);
          });

          // Show/hide no results message
          if (visibleCount === 0) {
            entitiesList.parentElement.classList.add("d-none");
            noResults.classList.remove("d-none");
          } else {
            entitiesList.parentElement.classList.remove("d-none");
            noResults.classList.add("d-none");
          }

          updateUrl();
          updateOnDoneRedirectTargets();
          updateLegacyButton();
          updateSelectionUI();
        }

        // Search input handler
        searchInput.addEventListener("input", filterEntities);
        searchInput.addEventListener("keydown", (e) => {
          if (e.key === "Escape" || e.key === "Esc") {
            e.preventDefault();
            searchInput.blur();
          }
        });
        if (deepSearchToggle) {
          deepSearchToggle.addEventListener("change", filterEntities);
        }

        // Filter button handlers
        filterButtons.forEach((btn) => {
          btn.addEventListener("click", function () {
            const entityType = this.dataset.entityType;

            if (!activeFilters.has(entityType)) {
              activeFilters.add(entityType);
              this.classList.add("btn-primary");
              this.classList.remove("btn-outline-primary");
            } else {
              activeFilters.delete(entityType);
              this.classList.remove("btn-primary");
              this.classList.add("btn-outline-primary");
            }

            filterEntities();
            if (searchInput && typeof searchInput.focus === 'function') {
              searchInput.focus({ preventScroll: true });
            }
          });
        });

        // Tag filter handlers (multi-select, OR). No "All" button needed
        tagButtons.forEach((btn) => {
          btn.addEventListener("click", function () {
            const tid = this.dataset.tagId;
            if (!activeTags.has(tid)) {
              activeTags.add(tid);
              this.classList.add("active", "btn-secondary");
              this.classList.remove("btn-outline-secondary");
            } else {
              activeTags.delete(tid);
              this.classList.remove("active", "btn-secondary");
              this.classList.add("btn-outline-secondary");
            }
            filterEntities();
          });
        });

        const keyboardShortcutTypeMap = {
          KeyT: "table",
          KeyV: "view",
          KeyP: "page",
          KeyR: "trigger",
          KeyM: "module",
          KeyU: "user",
        };

        document.addEventListener("keydown", async (e) => {
          const isFromSearchInput = e.target === searchInput;
          const typingTarget = isTypingTarget(e.target);

          if (e.altKey && !e.ctrlKey && !e.metaKey) {
            const type = keyboardShortcutTypeMap[e.code];
            if (type) {
              e.preventDefault();
              const isExtendedType = EXTENDED_TYPES.includes(type);
              if (
                isExtendedType &&
                typeof isExtendedExpanded !== "undefined" &&
                !isExtendedExpanded &&
                typeof toggleEntityExpanded === "function"
              ) {
                await toggleEntityExpanded(true);
              }
              const btn = filterButtonsByType[type];
              if (btn) {
                btn.click();
                if (searchInput && typeof searchInput.focus === 'function') {
                  searchInput.focus({ preventScroll: true });
                }
              }
              return;
            }
            if (deepSearchToggle && e.code === "KeyS") {
              e.preventDefault();
              deepSearchToggle.checked = !deepSearchToggle.checked;
              filterEntities();
              if (searchInput && typeof searchInput.focus === 'function') {
                searchInput.focus({ preventScroll: true });
              }
            }
            return;
          }
          if (typingTarget && !isFromSearchInput) return;

          const isSelectAllKey = e.key === "a" || e.key === "A";
          if ((e.metaKey || e.ctrlKey) && !e.altKey && isSelectAllKey) {
            const visibleRows = getSelectableVisibleRows();
            if (!visibleRows.length) return;
            e.preventDefault();
            visibleRows.forEach((row) => {
              const key = row.dataset.entityKey;
              if (key) selectedKeys.add(key);
            });
            lastSelectedIndex = visibleRows.length - 1;
            updateSelectionUI();
          }
        });

        if (clearSelectionBtn) {
          clearSelectionBtn.addEventListener('click', () => {
            clearSelection();
            filterEntities();
          });
        }

        if(bulkTagSelect) {
          bulkTagSelect.addEventListener('change', () => updateSelectionUI());
        }

        if (bulkRoleReadSelect) {
          bulkRoleReadSelect.addEventListener('change', () => {
            markSelectChangedByUser(bulkRoleReadSelect);
            updateSelectionUI();
          });
        }

        if (bulkRoleWriteSelect) {
          bulkRoleWriteSelect.addEventListener('change', () => {
            markSelectChangedByUser(bulkRoleWriteSelect);
            updateSelectionUI();
          });
        }

        const doBulkApplyTag = async () => {
          if(!bulkApplyTagBtn || !bulkTagSelect) return;
          const tagId = bulkTagSelect.value;
          if (!tagId) return;
          const items = collectSelectionItems().filter((item) => isTaggableType(item.type));
          if (!items.length) return;
          bulkApplyTagBtn.disabled = true;
          try {
            const res = await fetch('/entities/bulk-apply-tag', {
              method: 'POST',
              headers: {
                "Content-Type": "application/json",
                'CSRF-Token': window._sc_globalCsrf || '',
              },           
              body: JSON.stringify({ tag_id: tagId, items }),
            });
            if (!res.ok) throw new Error(await res.text());
            await res.json();
            const tagName = TAGS_BY_ID[tagId] || '';
            items.forEach((item) => {
              const row = findRowByKey(item.key);
              if (row) updateRowTags(row, tagId, tagName, item.type);
            });
            filterEntities();
          } catch (e) {
            console.error('Failed to apply tag to selected items', e);
            alert("Failed to apply tag to selected items");
          }
          bulkApplyTagBtn.disabled = false;
        };

        if(bulkApplyTagBtn) {
          bulkApplyTagBtn.addEventListener('click', doBulkApplyTag);
        }

        const triggerDownload = (filename, content) => {
          const blob = new Blob([content], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        };

        const doBulkDownloadPack = async () => {
          if (!bulkDownloadPackBtn) return;
          const items = collectSelectionItems()
          // .filter((item) => isDownloadableEntity(item));
          if (!items.length) return;
          bulkDownloadPackBtn.disabled = true;
          try {
            const res = await fetch('/entities/download-pack', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': window._sc_globalCsrf || '',
              },
              body: JSON.stringify({ items }),
            });
            if (!res.ok) throw new Error(await res.text());
            const payload = await res.json();
            if (Array.isArray(payload?.packs)) {
              payload.packs.forEach((pack) => {
                if (pack && pack.name && pack.content) {
                  const content =
                    typeof pack.content === 'string'
                      ? pack.content
                      : JSON.stringify(pack.content, null, 2);
                  triggerDownload(pack.name + '.json', content);
                }
              });
            }
          } catch (e) {
            console.error('Failed to download pack(s)', e);
            alert("Failed to download pack for selected items");
          }
          bulkDownloadPackBtn.disabled = false;
        };

        if (bulkDownloadPackBtn) {
          bulkDownloadPackBtn.addEventListener('click', doBulkDownloadPack);
        }

        if (bulkApplyRoleReadBtn) {
          bulkApplyRoleReadBtn.addEventListener('click', () => doBulkApplyRole('read'));
        }

        if (bulkApplyRoleWriteBtn) {
          bulkApplyRoleWriteBtn.addEventListener('click', () => doBulkApplyRole('write'));
        }

        const collectSelectionItems = () =>
          Array.from(selectedKeys)
            .map((key) => selectionPayloadFromRow(findRowByKey(key)))
            .filter(Boolean);

        const getRoleName = (rid) => {
          if (typeof rid === 'undefined') return '';
          const key = String(rid);
          if (!ROLES_BY_ID) return '';
          return Object.prototype.hasOwnProperty.call(ROLES_BY_ID, key) ? ROLES_BY_ID[key] : '?';
        };

        const toNumberOrUndefined = (val) => {
          if (val === '' || typeof val === 'undefined' || val === null) return undefined;
          const num = Number(val);
          return Number.isNaN(num) ? undefined : num;
        };

        const updateRowAccess = (row, payload) => {
          if (!row) return;
          if (typeof payload.min_role_read !== 'undefined') row.dataset.minRoleRead = String(payload.min_role_read ?? '');
          if (typeof payload.min_role_write !== 'undefined') row.dataset.minRoleWrite = String(payload.min_role_write ?? '');
          if (typeof payload.min_role !== 'undefined') row.dataset.minRole = String(payload.min_role ?? '');
          const cell = row.querySelector('td:nth-child(5)');
          if (cell) {
            const label = (() => {
              if (payload.type === 'table') {
                const ext = row.dataset.external === 'true';
                const rr = toNumberOrUndefined(payload.min_role_read);
                const rw = toNumberOrUndefined(payload.min_role_write);
                if (ext) return getRoleName(rr) + " (read only)";
                if (typeof rr !== 'undefined' && typeof rw !== 'undefined') return getRoleName(rr) + "/" + getRoleName(rw);
                return '';
              }
              const mr = toNumberOrUndefined(payload.min_role);
              return typeof mr !== 'undefined' ? getRoleName(mr) : '';
            })();
            cell.textContent = label;
          }
        };

        const doBulkApplyRole = async (mode) => {
          const isWriteMode = mode === 'write';
          const selectEl = isWriteMode ? bulkRoleWriteSelect : bulkRoleReadSelect;
          const buttonEl = isWriteMode ? bulkApplyRoleWriteBtn : bulkApplyRoleReadBtn;
          if (!selectEl || !buttonEl) return;
          const roleId = selectEl.value;
          if (!roleId) return;
          const items = collectSelectionItems().filter((item) => {
            if (isWriteMode) return item.type === 'table';
            return ['table', 'view', 'page'].includes(item.type);
          });
          if (!items.length) return;
          buttonEl.disabled = true;
          try {
            const res = await fetch('/entities/bulk-set-role', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': window._sc_globalCsrf || '',
              },
              body: JSON.stringify({ items, role_id: roleId, mode }),
            });
            if (!res.ok) throw new Error(await res.text());
            const payload = await res.json();
            const updatedKeys = new Set(payload?.updatedKeys || []);
            const errors = payload?.errors || [];
            if (errors.length) {
              console.error('Failed to set role for some items', errors);
              alert('Failed to set role for some selected items');
            }
            items.forEach((item) => {
              if (updatedKeys.size && !updatedKeys.has(item.key)) return;
              const row = findRowByKey(item.key);
              if (!row) return;
              if (isWriteMode && item.type === 'table') {
                updateRowAccess(row, { type: 'table', min_role_write: Number(roleId), min_role_read: toNumberOrUndefined(row.dataset.minRoleRead) });
              } else if (!isWriteMode) {
                if (item.type === 'table') {
                  updateRowAccess(row, { type: 'table', min_role_read: Number(roleId), min_role_write: toNumberOrUndefined(row.dataset.minRoleWrite) });
                } else if (item.type === 'view') {
                  updateRowAccess(row, { type: 'view', min_role: Number(roleId) });
                } else if (item.type === 'page') {
                  updateRowAccess(row, { type: 'page', min_role: Number(roleId) });
                }
              }
            });
          } catch (e) {
            console.error('Failed to set role for selected items', e);
            alert('Failed to set role for selected items');
          }
          buttonEl.disabled = false;
          updateSelectionUI();
        };

        const formatDeleteError = (err) => {
          const displayType = err?.isPack
            ? "Pack"
            : (() => {
                const t = (err?.type || "").toString();
                if (!t) return "Item";
                return t.charAt(0).toUpperCase() + t.slice(1);
              })();
          const label = err?.name || err?.id || err?.key || "(unknown)";
          const message = err?.message || TXT_DELETE_FAILED || "Failed to delete selected items";
          return displayType + " (" + label + "): " + message;
        };

        const showBulkDeleteErrors = (errs) => {
          if (!errs || !errs.length) return;
          const body = errs
            .map((e) => formatDeleteError(e))
            .join("\\n-----\\n");
          alert(body);
        };

        const removeRowsByKeys = (keysToRemove) => {
          if (!keysToRemove || !keysToRemove.size) return;
          document.querySelectorAll('.entity-row').forEach((row) => {
            if (keysToRemove.has(row.dataset.entityKey)) row.remove();
          });
        };

        const refreshExtendedEntitiesAfterDelete = async () => {
          if (typeof isExtendedExpanded !== 'undefined' && !isExtendedExpanded) return;
          if (typeof loadExtendedEntities !== 'function' || typeof renderExtendedEntityRows !== 'function') return;
          const tbody = document.querySelector('#entities-list tbody');
          if (!tbody) return;
          const shouldLoadAll = typeof window.isModulesFilterExclusive === 'function'
            ? window.isModulesFilterExclusive()
            : false;
          try {
            const extendedEntities = await loadExtendedEntities(shouldLoadAll);
            window.extendedEntities = extendedEntities;
            renderExtendedEntityRows(extendedEntities, tbody);
          } catch (err) {
            console.error('Failed to refresh extended entities after delete:', err);
          }
        };

        if (bulkDeleteBtn) {
          bulkDeleteBtn.addEventListener('click', async () => {
            const items = collectSelectionItems();
            if (!items.length) return;
            const template = TXT_DELETE_SELECTED_CONFIRM || TXT_DELETE_SELECTED_FALLBACK;
            const msg = template.includes('%s')
              ? template.replace('%s', items.length)
              : template;
            if (!window.confirm(msg)) return;
            bulkDeleteBtn.disabled = true;
            try {
              const res = await fetch('/entities/bulk-delete', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'CSRF-Token': window._sc_globalCsrf || '',
                },
                body: JSON.stringify({ items }),
              });
              if (!res.ok) throw new Error(await res.text());
              const payload = await res.json();
              const keysToRemove = new Set(
                (payload.deletedKeys && payload.deletedKeys.length
                  ? payload.deletedKeys
                  : items.map((i) => i.key))
              );
              removeRowsByKeys(keysToRemove);
              if (payload.errors && payload.errors.length) {
                console.error('Bulk delete errors', payload.errors);
                showBulkDeleteErrors(payload.errors);
              }
              clearSelection();
              await refreshExtendedEntitiesAfterDelete();
              filterEntities();
            } catch (e) {
              console.error(e);
              alert(TXT_DELETE_FAILED || 'Failed to delete selected items');
            }
            bulkDeleteBtn.disabled = false;
          });
        }

        if (entitiesTbody) {
          entitiesTbody.addEventListener('click', (e) => {
            const row = e.target.closest('.entity-row');
            if (!row) return;
            if (e.target.closest('a, button, input, select, textarea, label'))
              return;
            if (!isRowSelectable(row)) {
              lastSelectedIndex = null;
              return;
            }
            const visibleRows = getSelectableVisibleRows();
            const index = visibleRows.indexOf(row);
            const key = row.dataset.entityKey;
            if (!key) return;
            const isShift = e.shiftKey;
            const isMeta = e.metaKey || e.ctrlKey;

            if (isShift && lastSelectedIndex !== null && visibleRows[lastSelectedIndex]) {
              selectedKeys.clear();
              const start = Math.min(lastSelectedIndex, index);
              const end = Math.max(lastSelectedIndex, index);
              for (let i = start; i <= end; i++) {
                const rangeKey = visibleRows[i].dataset.entityKey;
                if (rangeKey) selectedKeys.add(rangeKey);
              }
            } else if (isMeta) {
              if (selectedKeys.has(key)) {
                selectedKeys.delete(key);
              } else {
                selectedKeys.add(key);
              }
              lastSelectedIndex = index;
            } else {
              const onlyThisSelected = selectedKeys.size === 1 && selectedKeys.has(key);
              selectedKeys.clear();
              if (!onlyThisSelected) {
                selectedKeys.add(key);
                lastSelectedIndex = index;
              } else {
                lastSelectedIndex = null;
              }
            }
            updateSelectionUI();
          });
        }

        // Init from URL and run first filter
        const { shouldExpandExtended } = initFromUrl();
        if (shouldExpandExtended) {
          toggleEntityExpanded(true);
        } else {
          filterEntities();
        }
        // Focus search on load
        searchInput.focus();
        updateSelectionUI();
      `)
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
              // clientScript,
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
        window.ENTITY_DEEP_SEARCH = ${JSON.stringify(deepSearchIndex)};

        const EXTENDED_ENTITY_TYPES = ["module","user"];
        window.ENTITY_EXTENDED_TYPES = EXTENDED_ENTITY_TYPES;
        let isExtendedExpanded = false;
        let hasLoadedAllModules = false;
        let isLoadingAllModules = false;
        const clearExtendedTypeFilters = () => {
          if (typeof activeFilters === 'undefined') return;
          EXTENDED_ENTITY_TYPES.forEach((type) => {
            if (activeFilters.has(type)) {
              activeFilters.delete(type);
              const btn = document.querySelector('.entity-filter-btn[data-entity-type="' + type + '"]');
              if (btn) {
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-outline-primary');
              }
            }
          });
        };
        // Fetch extended entities via AJAX
        const loadExtendedEntities = async (includeAllModules = false) => {
          try {
            const query = includeAllModules ? '?include_all_modules=1' : '';
            const res = await fetch('/entities/extended' + query);
            const data = await res.json();
            return data.entities || [];
          } catch (e) {
            console.error('Failed to load extended entities:', e);
            return [];
          }
        };

        const renderExtendedEntityRows = (extendedEntities, tbody) => {
          document
            .querySelectorAll('[data-is-extended]')
            .forEach((row) => row.remove());
          extendedEntities.forEach((entity) => {
            const row = createExtendedEntityRow(entity);
            tbody.appendChild(row);
          });
          if (typeof updateSelectionUI === 'function') updateSelectionUI();
        };

        const ensureAllModulesLoaded = async () => {
          if (hasLoadedAllModules || isLoadingAllModules) return;
          if (!isExtendedExpanded) return;
          isLoadingAllModules = true;
          let updated = false;
          try {
            const extendedEntities = await loadExtendedEntities(true);
            window.extendedEntities = extendedEntities;
            const tbody = document.querySelector('#entities-list tbody');
            renderExtendedEntityRows(extendedEntities, tbody);
            hasLoadedAllModules = true;
            updated = true;
          } catch (e) {
            console.error('Failed to load all modules:', e);
          } finally {
            isLoadingAllModules = false;
            if (updated && typeof filterEntities === 'function') filterEntities();
          }
        };

        // Toggle expanded state
        window.toggleEntityExpanded = async (expand) => {
          const moreBtn = document.getElementById('entity-more-btn');
          const lessBtn = document.getElementById('entity-less-btn');
          const extendedButtons = document.querySelectorAll('.entity-extended-btn');
          const tbody = document.querySelector('#entities-list tbody');
          
          if (expand) {
            if (isExtendedExpanded) return;
            extendedButtons.forEach(btn => btn.classList.remove('d-none'));
            moreBtn.classList.add('d-none');
            lessBtn.classList.remove('d-none');
            isExtendedExpanded = true;
            const shouldLoadAll = typeof window.isModulesFilterExclusive === 'function'
              ? window.isModulesFilterExclusive()
              : false;
            // Load extended entities
            const extendedEntities = await loadExtendedEntities(shouldLoadAll);
            window.extendedEntities = extendedEntities;
            renderExtendedEntityRows(extendedEntities, tbody);
            hasLoadedAllModules = shouldLoadAll;
            filterEntities();
          } else {
            if (!isExtendedExpanded) return;
            extendedButtons.forEach(btn => btn.classList.add('d-none'));
            moreBtn.classList.remove('d-none');
            lessBtn.classList.add('d-none');
            isExtendedExpanded = false;
            hasLoadedAllModules = false;
            isLoadingAllModules = false;
            window.extendedEntities = [];
            renderExtendedEntityRows([], tbody);
            clearExtendedTypeFilters();
            // Update filter
            filterEntities();
          }
        };

        // Helper to create entity row for extended entities
        const createExtendedEntityRow = (entity) => {
          const tr = document.createElement('tr');
          tr.className = 'entity-row';
          tr.dataset.entityType = entity.type;
          tr.dataset.entityName = entity.name.toLowerCase();
          if (entity.id) {
            tr.dataset.entityId = entity.id;
          } else {
            tr.dataset.entityId = '';
          }
          tr.dataset.entityLabel = entity.name;
          const key = entity.type + ':' + (entity.type === 'module' ? entity.name : entity.id);
          tr.dataset.entityKey = key;
          let searchable = ((entity.name || '').toLowerCase() + ' ' + entity.type).trim();
          if (entity.metadata) {
            Object.keys(entity.metadata).forEach((key) => {
              const val = entity.metadata[key];
              const shouldSkipDescription =
                entity.type === 'module' && key === 'description';
              const shouldSkipForSearchable =
                entity.type === 'user' && key === 'username';
              if (!shouldSkipDescription && !shouldSkipForSearchable && val && typeof val === 'string') {
                searchable += ' ' + val.toLowerCase();
              }
            });
          }
          tr.dataset.tags = '';
          tr.dataset.isExtended = 'true';
          tr.dataset.installed =
            entity.metadata && entity.metadata.installed === false
              ? 'false'
              : 'true';
          tr.dataset.moduleKind = entity.metadata && entity.metadata.type ? entity.metadata.type : '';

          if (!isRowSelectable(tr)) {
            tr.classList.add('entity-row-selection-disabled');
            tr.setAttribute('aria-disabled', 'true');
          }
          
          // Type badge
          const badges = {
            module: { class: "secondary", icon: "cube", label: "Module" },
            user: { class: "dark", icon: "user", label: "User" },
          };
          const badge = badges[entity.type];
          const typeBadge = document.createElement('td');
          typeBadge.innerHTML = '<span class="badge bg-' + badge.class + ' me-2"><i class="fas fa-' + badge.icon + ' me-1"></i>' + badge.label + '</span>';
          tr.appendChild(typeBadge);

          const hasConfig = entity.metadata && entity.metadata.hasConfig;
          const isInstalled = entity.metadata && entity.metadata.installed;
          
          // Name
          const nameTd = document.createElement('td');
          const isStaticModule = entity.type === 'module' && !hasConfig;
          const nameLink = document.createElement(isStaticModule ? 'span' : 'a');
          if (!isStaticModule) {
            const baseHref = entity.editLink || '#';
            const updatedHref = toRelativeHrefWithOnDone(baseHref);
            nameLink.setAttribute('href', updatedHref || baseHref);
          }
          nameLink.className = 'fw-bold';
          nameLink.textContent = entity.name;
          nameTd.appendChild(nameLink);
          tr.appendChild(nameTd);
          
          // Run cell (info link for modules)
          const runTd = document.createElement('td');
          if (
            entity.type === 'module' &&
            entity.metadata &&
            entity.metadata.type !== 'pack' &&
            entity.viewLink &&
            isInstalled
          ) {
            const infoLink = document.createElement('a');
            infoLink.className = 'link-primary text-decoration-none';
            infoLink.innerHTML = 
            // '<i class="fas fa-info-circle me-1"></i>' +
              (window.TXT_INFO || 'Info');
            const updatedInfoHref = toRelativeHrefWithOnDone(entity.viewLink);
            infoLink.setAttribute('href', updatedInfoHref || entity.viewLink);
            runTd.appendChild(infoLink);
          }
          tr.appendChild(runTd);
          
          // Details cell
          const detailsTd = document.createElement('td');
          let detailsHtml = '';
          if (entity.type === 'user') {
            const disabled = entity.metadata && entity.metadata.disabled;
            const roleId = entity.metadata && entity.metadata.role_id;
            if (Array.isArray(window.ENTITY_ROLES)) {
              const role = window.ENTITY_ROLES.find(function (r) {
                return String(r.id) === String(roleId);
              });
              if (role && role.role) {
                detailsHtml += '<span class="text-muted small me-2">' + role.role + '</span>';
              }
            }
            if (disabled) {
              detailsHtml += '<span class="badge bg-danger me-1">' + (window.TXT_DISABLED || 'Disabled') + '</span>';
              searchable += ' disabled';
            }
          } else if (entity.type === 'module') {
            const version = entity.metadata && entity.metadata.version;
            const hasTheme = entity.metadata && entity.metadata.has_theme;
            const hasAuth = entity.metadata && entity.metadata.has_auth;
            const isReadyForMobile = entity.metadata && entity.metadata.ready_for_mobile;
            const isLocal = entity.metadata && entity.metadata.local;
            const isPack = entity.metadata && entity.metadata.type === 'pack';
            if (version) {
              detailsHtml += '<span class="text-muted small me-2">v' + version + '</span>';
            }
            if (isPack) {
              detailsHtml += '<span class="badge bg-secondary me-1">' + (window.TXT_PACK || 'Pack') + '</span>';
            }
            if (hasTheme) {
              detailsHtml += '<span class="badge bg-secondary me-1">' + (window.TXT_THEME || 'Theme') + '</span>';
              searchable += ' theme';
            }
            if (isLocal) {
              detailsHtml += '<span class="badge bg-secondary me-1">' + (window.TXT_LOCAL || 'Local') + '</span>';
              searchable += ' local';
            } 
            if (isInstalled) {
              detailsHtml += '<span class="badge bg-secondary me-1">' + (window.TXT_INSTALLED || 'Installed') + '</span>';
              searchable += ' installed';
            }
            if (hasAuth) {
              detailsHtml += '<span class="badge bg-secondary me-1">' + (window.TXT_AUTH || 'Authentication') + '</span>';
              searchable += ' authentication auth';
            }
            if (isReadyForMobile) {
              detailsHtml += '<span class="badge bg-secondary me-1">' + (window.TXT_MOBILE || 'Mobile') + '</span>';
              searchable += ' mobile';
            }
          }
          if (detailsHtml) detailsTd.innerHTML = detailsHtml;
          tr.appendChild(detailsTd);
          
          // Access cell (empty for extended entities)
          const accessTd = document.createElement('td');
          tr.appendChild(accessTd);
          
          // Tags cell
          const tagsTd = document.createElement('td');
          tr.appendChild(tagsTd);
          
          // Actions cell (empty for extended entities)
          const actionsTd = document.createElement('td');
          if (entity.actionsHtml) {
            actionsTd.innerHTML = entity.actionsHtml;
            actionsTd
              .querySelectorAll('a')
              .forEach((link) => {
                const href = link.getAttribute('href');
                const updated = toRelativeHrefWithOnDone(href);
                if (updated) link.setAttribute('href', updated);
              });
            actionsTd
              .querySelectorAll('form')
              .forEach((form) => {
                const action = form.getAttribute('action');
                const updated = toRelativeHrefWithOnDone(action);
                if (updated) form.setAttribute('action', updated);
                if (entity.type === 'user') ensureOnDoneHiddenInput(form);
              });
            const dropdownToggle = actionsTd.querySelector('[data-bs-toggle="dropdown"]');
            if (dropdownToggle && window.bootstrap && window.bootstrap.Dropdown) {
              window.bootstrap.Dropdown.getOrCreateInstance(dropdownToggle);
            }
          }
          tr.appendChild(actionsTd);

          tr.dataset.searchable = searchable.trim();
          let deepSearchable = (entity.deepSearchable || searchable).trim();
          if (entity.type === 'module') {
            const description =
              entity.metadata && typeof entity.metadata.description === 'string'
                ? entity.metadata.description.toLowerCase()
                : '';
            if (description && !deepSearchable.includes(description)) {
              deepSearchable = (deepSearchable + ' ' + description).trim();
            }
          } else if (entity.type === 'user' && entity.metadata && typeof entity.metadata.username === 'string') {
            const usernameLower = entity.metadata.username.toLowerCase();
            if (!deepSearchable.includes(usernameLower)) {
              deepSearchable = (deepSearchable + ' ' + usernameLower).trim();
            }
          }
          tr.dataset.deepSearchable = deepSearchable;
          if (window.ENTITY_DEEP_SEARCH) {
            window.ENTITY_DEEP_SEARCH[key] = tr.dataset.deepSearchable;
          }
          return tr;
        };

        ${clientScript.substring(clientScript.indexOf("const searchInput"), clientScript.lastIndexOf("}"))}
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
  error_catcher(async (req, res) => {
    const includeAllModules =
      req.query.include_all_modules === "1" ||
      req.query.include_all_modules === "true";
    const extendedEntities = await getExtendedEntites(req, {
      includeAllModules,
    });
    res.json({
      entities: extendedEntities.map((entity) => ({
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
  error_catcher(async (req, res) => {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length)
      return res.status(400).json({ error: "No items selected" });

    const deletedKeys = [];
    const errors = [];
    const installedPackNames = new Set(
      getState().getConfig("installed_packs", []) || []
    );
    const asNumber = (val) => {
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
            await getState().refresh();
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
      } catch (e) {
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

const idField = (entryType) => {
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
  error_catcher(async (req, res) => {
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
  error_catcher(async (req, res) => {
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
          console.log({ view });
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
      } catch (e) {
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
  error_catcher(async (req, res) => {
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
