const searchInput = document.getElementById("entity-search");
const entitiesList = document.getElementById("entities-list");
const noReasults = document.getElementById("no-results");
const filterButtons = document.querySelectorAll(".entity-filter-btn");
const entityRows = document.querySelectorAll(".entity-row");

console.log({ entityRows: entityRows });

console.log({ searchInputValue: searchInput.value });

// Track active filters
const activeFilters = new Set(["table", "view", "page", "trigger"]);

// Filter function
function filterEntities() {
  const searchTerm = searchInput.value.toLowerCase();
  let visibleCount = 0;

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
