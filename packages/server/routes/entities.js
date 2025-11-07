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
} = require("@saltcorn/markup/tags");
const { error_catcher, isAdminOrHasConfigMinRole } = require("./utils.js");

/**
 * @type {object}
 * @const
 * @namespace entitiesRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

/**
 * Get all entities with their type and metadata
 */
const getAllEntities = async () => {
  const tables = await Table.find({}, { cached: true });
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
      },
    });
  });

  // Add views
  views.forEach((v) => {
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
        singleton: v.singleton,
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
      },
    });
  });

  // Sort by name
  entities.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
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
    trigger: { class: "warning", icon: "calendar-check", label: "Trigger" },
  };
  const badge = badges[type];
  return span(
    { class: `badge bg-${badge.class} me-2` },
    i({ class: `fas fa-${badge.icon} me-1` }),
    badge.label
  );
};

/**
 * Generate entity row HTML
 */
const entityRow = (entity) => {
  const metadata = [];

  if (entity.type === "table") {
    if (entity.metadata.external)
      metadata.push(span({ class: "badge bg-info me-1" }, "External"));
    if (entity.metadata.versioned)
      metadata.push(span({ class: "badge bg-success me-1" }, "History"));
    if (entity.metadata.ownership_field_id)
      metadata.push(span({ class: "badge bg-primary me-1" }, "Owned"));
  }

  if (entity.type === "view" && entity.metadata.viewtemplate) {
    metadata.push(
      span({ class: "text-muted small" }, entity.metadata.viewtemplate)
    );
  }

  if (entity.type === "trigger") {
    if (entity.metadata.when_trigger) {
      metadata.push(
        span({ class: "text-muted small me-2" }, entity.metadata.when_trigger)
      );
    }
    if (entity.metadata.table_name || entity.metadata.channel) {
      metadata.push(
        span(
          { class: "text-muted small" },
          entity.metadata.table_name || entity.metadata.channel
        )
      );
    }
  }

  // Build searchable string (space-separated values for simple searching)
  const searchableValues = [entity.name.toLowerCase(), entity.type];

  // Add string metadata values
  Object.entries(entity.metadata).forEach(([k, v]) => {
    if (v && typeof v === "string") {
      searchableValues.push(v.toLowerCase());
    }
  });

  return div(
    {
      class: "entity-row p-3 border-bottom hover-highlight",
      "data-entity-type": entity.type,
      "data-entity-name": entity.name.toLowerCase(),
      "data-searchable": searchableValues.join(" "),
    },
    div(
      { class: "d-flex justify-content-between align-items-center" },
      div(
        { class: "flex-grow-1" },
        div(
          { class: "mb-1" },
          entityTypeBadge(entity.type),
          a(
            { href: entity.viewLink, class: "fw-bold entity-name" },
            text(entity.name)
          )
        ),
        metadata.length > 0 && div({ class: "entity-metadata" }, ...metadata)
      ),
      div(
        { class: "btn-group" },
        a(
          { href: entity.viewLink, class: "btn btn-sm btn-outline-secondary" },
          i({ class: "fas fa-eye" })
        ),
        entity.editLink &&
          a(
            {
              href: entity.editLink,
              class: "btn btn-sm btn-outline-secondary",
            },
            i({ class: "fas fa-edit" })
          )
      )
    )
  );
};

/**
 * Main entities list page
 */
router.get(
  "/",
  isAdminOrHasConfigMinRole("min_role_edit_views"),
  error_catcher(async (req, res) => {
    const entities = await getAllEntities();

    const filterToggles = div(
      {
        class: "btn-group mb-3",
        role: "group",
        "aria-label": "Entity type filters",
      },
      button(
        {
          type: "button",
          class: "btn btn-outline-primary active entity-filter-btn",
          "data-entity-type": "table",
        },
        i({ class: "fas fa-table me-1" }),
        "Tables"
      ),
      button(
        {
          type: "button",
          class: "btn btn-outline-success active entity-filter-btn",
          "data-entity-type": "view",
        },
        i({ class: "fas fa-eye me-1" }),
        "Views"
      ),
      button(
        {
          type: "button",
          class: "btn btn-outline-info active entity-filter-btn",
          "data-entity-type": "page",
        },
        i({ class: "fas fa-file me-1" }),
        "Pages"
      ),
      button(
        {
          type: "button",
          class: "btn btn-outline-warning active entity-filter-btn",
          "data-entity-type": "trigger",
        },
        i({ class: "fas fa-zap me-1" }),
        "Triggers"
      )
    );

    const searchBox = div(
      { class: "mb-3" },
      input({
        type: "text",
        class: "form-control form-control-lg",
        id: "entity-search",
        placeholder: "Search entities by name or type...",
        autocomplete: "off",
      })
    );

    const entitiesList = div(
      { id: "entities-list", class: "border rounded" },
      ...entities.map(entityRow)
    );

    const noResultsMessage = div(
      {
        id: "no-results",
        class: "text-center text-muted py-5 d-none",
      },
      div({ class: "h5" }, "No entities found"),
      div("Try adjusting your search or filter options")
    );

    const clientScript = script(
      domReady(`
        const searchInput = document.getElementById("entity-search");
        const entitiesList = document.getElementById("entities-list");
        const noReasults = document.getElementById("no-results");
        const filterButtons = document.querySelectorAll(".entity-filter-btn");
        const entityRows = document.querySelectorAll(".entity-row")

        // Track active filters
        const activeFilters = new Set(["table", "view", "page", "trigger"]);

        // Filter function
        function filterEntities() {
          const searchTerm = searchInput.value.toLowerCase();
          let visibleCount = 0;

          console.log({ entityRows });

          entityRows.forEach((row) => {
            const entityType = row.dataset.entityType;
            const searchableText = row.dataset.searchable;

            // Check if entity type is active
            const typeMatch = activeFilters.has(entityType);

            // Check if search term matches
            let searchMatch = true;
            if (searchTerm) {
              searchMatch = searchableText.includes(searchTerm);
            }

            // Show/hide row
            if (typeMatch && searchMatch) {
              row.style.display = "";
              visibleCount++;
            } else {
              row.style.display = "none";
            }
          });

          // Show/hide no results message
          if (visibleCount === 0) {
            entitiesList.classList.add("d-none");
            noReasults.classList.remove("d-none");
          } else {
            entitiesList.classList.remove("d-none");
            noReasults.classList.add("d-none");
          }
        }

        // Search input handler
        searchInput.addEventListener("input", filterEntities);

        // Filter button handlers
        filterButtons.forEach((btn) => {
          btn.addEventListener("click", function () {
            const entityType = this.dataset.entityType;

            if (activeFilters.has(entityType)) {
              activeFilters.delete(entityType);
              this.classList.remove("active");
            } else {
              activeFilters.add(entityType);
              this.classList.add("active");
            }

            filterEntities();
          });
        });

        // Focus search on load
        searchInput.focus();
      `)
    );

    const styles = `
      <style>
        .entity-row {
          transition: background-color 0.2s;
        }
        .hover-highlight:hover {
          background-color: #f8f9fa;
        }
        .entity-filter-btn {
          transition: all 0.2s;
        }
        .entity-filter-btn:not(.active) {
          opacity: 0.5;
        }
        #entity-search:focus {
          border-color: #0d6efd;
          box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
        }
      </style>
    `;

    res.sendWrap(
      {
        title: req.__("Entities"),
        headers: [{ headerTag: styles }],
      },
      div(
        div(
          { class: "d-flex justify-content-between align-items-center mb-4" },
          div(
            { class: "h3 mb-0" },
            i({ class: "fas fa-list me-2" }),
            req.__("All Entities")
          ),
          div(
            { class: "btn-group" },
            a(
              { href: "/table/new", class: "btn btn-primary" },
              i({ class: "fas fa-plus me-1" }),
              "Table"
            ),
            a(
              { href: "/viewedit/new", class: "btn btn-success" },
              i({ class: "fas fa-plus me-1" }),
              "View"
            ),
            a(
              { href: "/pageedit/new", class: "btn btn-info" },
              i({ class: "fas fa-plus me-1" }),
              "Page"
            ),
            a(
              { href: "/actions/new", class: "btn btn-warning" },
              i({ class: "fas fa-plus me-1" }),
              "Trigger"
            )
          )
        ),
        searchBox,
        filterToggles,
        entitiesList,
        noResultsMessage,
        clientScript
      )
    );
  })
);
