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
} = require("@saltcorn/admin-models/models/pack");

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
        deepSearchIndex[key] = JSON.stringify(pack).toLowerCase();
      } catch (e) {
        console.error(
          `Failed to stringify pack ${pack.name} for deep search index:`,
          e
        );
      }
    };

    for (const entity of entities) {
      const key = (useId = true) =>
        `${entity.type}:${useId ? entity.id : entity.name}`; // Using name for views as some table_less views have undefined ids
      try {
        if (entity.type === "table") {
          const table = Table.findOne({ id: entity.id });
          if (table) addDeepSearch(key(), await table_pack(table));
        } else if (entity.type === "view") {
          const view = View.findOne({ name: entity.name });
          if (view) addDeepSearch(key(false), await view_pack(view));
        } else if (entity.type === "page") {
          const page = Page.findOne({ name: entity.name });
          if (page) addDeepSearch(key(), await page_pack(page));
        } else if (entity.type === "trigger") {
          const trigger = Trigger.findOne({ id: entity.id });
          if (trigger) addDeepSearch(key(), await trigger_pack(trigger));
        }
      } catch (e) {
        console.error(`Failed to build deep search index for ${key()}:`, e);
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
        },
        i({ class: "fas fa-table me-1" }),
        req.__("Tables")
      ),
      button(
        {
          type: "button",
          class: "btn btn-sm btn-outline-primary entity-filter-btn",
          "data-entity-type": "view",
        },
        i({ class: "fas fa-eye me-1" }),
        req.__("Views")
      ),
      button(
        {
          type: "button",
          class: "btn btn-sm btn-outline-primary entity-filter-btn",
          "data-entity-type": "page",
        },
        i({ class: "fas fa-file me-1" }),
        req.__("Pages")
      ),
      button(
        {
          type: "button",
          class: "btn btn-sm btn-outline-primary entity-filter-btn",
          "data-entity-type": "trigger",
        },
        i({ class: "fas fa-play me-1" }),
        req.__("Triggers")
      ),
      button(
        {
          type: "button",
          class:
            "btn btn-sm btn-outline-primary entity-filter-btn entity-extended-btn d-none",
          "data-entity-type": "module",
        },
        i({ class: "fas fa-cube me-1" }),
        req.__("Modules")
      ),
      button(
        {
          type: "button",
          class:
            "btn btn-sm btn-outline-primary entity-filter-btn entity-extended-btn d-none",
          "data-entity-type": "user",
        },
        i({ class: "fas fa-user me-1" }),
        req.__("Users")
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
      { class: "mb-3" },
      div(
        { class: "d-flex align-items-center gap-3 flex-wrap" },
        input({
          type: "text",
          class: "form-control flex-grow-1 w-auto",
          id: "entity-search",
          placeholder: req.__("Search entities by name or type..."),
          autocomplete: "off",
        }),
        div(
          { class: "form-check mb-0" },
          input({
            class: "form-check-input",
            type: "checkbox",
            id: "entity-deep-search",
          }),
          label(
            { class: "form-check-label", for: "entity-deep-search" },
            req.__("Deep search")
          )
        )
      )
    );

    // Tag filter buttons
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
      )
    );

    // One row for type filters and tag filters
    const filtersRow = div(
      {
        class:
          "d-flex flex-wrap align-items-center justify-content-between mb-3 gap-2",
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
      tags.length > 0 ? tagFilterBar : null
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
        entity.type === "view" ? entity.name : entity.id
      }`;
      const tagIds = tagsByEntityKey.get(key) || [];
      const deepSearchable = deepSearchIndex[key];
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
              class: "link-primary text-decoration-none",
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
          "data-entity-key": key,
          "data-searchable": searchableValues.join(" "),
          "data-deep-searchable": deepSearchable || searchableValues.join(" "),
          "data-tags": tagIds.join(" "),
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
                metadata:
                  entity.type === "table"
                    ? {
                        ...entity.metadata,
                        min_role_read: Table.findOne(entity.name)
                          ?.min_role_read,
                        min_role_write: Table.findOne(entity.name)
                          ?.min_role_write,
                      }
                    : {
                        ...entity.metadata,
                        min_role:
                          entity.metadata.min_role ?? entity.metadata.min_role,
                      },
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
        const tagButtons = document.querySelectorAll(".tag-filter-btn");
        const LEGACY_LINK_META = ${JSON.stringify(legacyLinkMeta)};
        const legacyButton = document.getElementById("legacy-entity-link");
        const legacyLabel = legacyButton ? legacyButton.querySelector(".legacy-label") : null;

        const BASE_TYPES = ["table","view","page","trigger"];
        const EXTENDED_TYPES = window.ENTITY_EXTENDED_TYPES || ["module","user"];
        const ALL_TYPES = BASE_TYPES.concat(EXTENDED_TYPES);

        // Track active filters
        const activeFilters = new Set([]);
        const activeTags = new Set([]);
        const isModulesFilterExclusive = () =>
          activeFilters.size === 1 && activeFilters.has("module");
        window.isModulesFilterExclusive = isModulesFilterExclusive;

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
              visibleCount++;
            } else {
              row.style.display = "none";
            }
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
        }

        // Search input handler
        searchInput.addEventListener("input", filterEntities);
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

        // Init from URL and run first filter
        const { shouldExpandExtended } = initFromUrl();
        if (shouldExpandExtended) {
          toggleEntityExpanded(true);
        } else {
          filterEntities();
        }
        // Focus search on load
        searchInput.focus();
      `)
    );

    const styles = `
      <style>
        .entity-row td { vertical-align: middle; }
        .entity-filter-btn { transition: all 0.15s ease-in-out; }
        .tag-filter-btn { transition: all 0.15s ease-in-out; }
        /* Show plus badge only on hover over tag cell */
        td:nth-child(6) .add-tag { visibility: hidden; cursor: pointer; }
        tr:hover td:nth-child(6) .add-tag { visibility: visible; }

        /* Round right corners of More button when it's visible (Less is hidden) */
        #entity-more-btn:not(.d-none) {
          border-top-right-radius: 0.25rem !important;
          border-bottom-right-radius: 0.25rem !important;
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
                { class: "d-flex flex-column gap-2" },
                searchBox,
                filtersRow,
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
          const key = entity.type + ':' + (entity.type === 'module' ? entity.name : entity.id);
          tr.dataset.entityKey = key;
          let searchable = ((entity.name || '').toLowerCase() + ' ' + entity.type).trim();
          if (entity.metadata) {
            Object.keys(entity.metadata).forEach((key) => {
              const val = entity.metadata[key];
              const shouldSkipDescription =
                entity.type === 'module' && key === 'description';
              if (!shouldSkipDescription && val && typeof val === 'string') {
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
