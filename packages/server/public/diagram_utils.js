const entityFilter = {
  showViews: true,
  showPages: true,
  showTables: true,
  showTrigger: true,
};
const tagFilterIds = [];
let tagFilterEnabled = false;

let activePopper = null;

function initMouseOver() {
  cy.on("mouseover", "node", (event) => {
    const node = event.target;
    const cardPopper = node.popper({
      content: () => {
        const popperDiv = document.getElementById(`${node.id()}_popper`);
        if (popperDiv) {
          popperDiv.setAttribute("style", "");
          return popperDiv;
        } else return buildCard(node);
      },
    });
    activePopper = cardPopper;
    const update = () => {
      cardPopper.update();
    };
    node.on("position", update);
    cy.on("pan zoom resize", update);
  });

  cy.on("mouseout", "node", (event) => {
    const node = event.target;
    activePopper.destroy();
    const popperDiv = document.getElementById(`${node.id()}_popper`);
    popperDiv.setAttribute("style", "display: none;");
  });
}

function buildCard(node) {
  const { type, label } = node.data();
  const html = `
    <div class="card" style="width: 18rem;">
      <div class="card-header">
        <h5 class="card-title">${type}</h5>
        <h6 class="card-subtitle text-muted">${label}</h6>
      </div>
      <div class="card-body">
        ${buildTagBadges(node)}
        ${buildCardBody(node)}
        ${type === "page" || type === "view" ? buildPreview(node) : ""}
        ${type === "page" || type === "view" ? buildMinRoleSelect(node) : ""}
      </div>
    </div>
  `;
  const div = document.createElement("div");
  div.id = `${node.id()}_popper`;
  document.body.appendChild(div);
  div.innerHTML = html;
  return div;
}

function buildPreview(node) {
  const { name, type } = node.data();
  const previewId = `preview_${node.id()}`;
  $.ajax(`/${type}/${name}/preview`, {
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    success: (res) => {
      $(`#${previewId}`).html(`
        <div 
          id="preview_wrapper"
          style="min-height: 70px;"
        > 
          ${res}
        </div></div></div>`);
      const previewDiv = $(`#${previewId}`);
      const pos = previewDiv.position();
      const cssBase = `
        position: absolute; top: ${pos.top}px; left: ${pos.left}px;
        width: ${previewDiv.width()}px; height: ${previewDiv.height() + 12}px;`;
      $(`#${previewId}`).after(`
        <div 
          style="${cssBase}
            background-color: black; opacity: 0.1;
            z-index: 10;"
        >
        </div>
        <div style="${cssBase} opacity: 0.5;">
          <h2 class="preview-text fw-bold text-danger">
            Preview
          </h2>
        </div>`);
    },
    error: (res) => {
      console.log("error");
      console.log(res);
    },
  });
  return `
    <div class="my-2" id="${previewId}" style="min-height: 70px;">
      <div style="opacity: 0.5;">
        <h2>
          <span class="fw-bold text-danger">Preview</span>
          <i class="fas fa-spinner fa-spin"></i>
        </h2>
      </div>
    </div>`;
}

function buildMinRoleSelect(node) {
  let { type, objectId, min_role } = node.data();
  min_role = parseInt(min_role);
  const selectId = `_${type}_${objectId}_access_id`;
  return `
    <form 
      action="${type === "view" ? "viewedit" : "pageedit"}/setrole/${objectId}" 
      method="post"
    >
      <div class="row">
        <div class="col-sm-3">
          <label 
            class="form-label"
            for="${selectId}"
          >
            Access
          </label>
        </div>
        <div class="col-sm-7">
          <select
            class="form-select"
            id="${selectId}"
            name="role"
            onchange="setRole(this, '${node.id()}')"
          >
            ${roles.map(
              (role) =>
                `<option 
                value="${role.id}" 
                ${role.id === min_role ? "selected" : ""}
              >
                ${role.role}
              </option>`
            )}
          </select>
        </div>
    </form>`;
}

function setRole(srcElement, nodeId) {
  const form = $(srcElement).closest("form");
  const newRole = parseInt(form.serializeArray()[0].value);
  const node = cy.nodes().find((node) => node.id() === nodeId);
  const { type, objectId } = node.data();
  $.ajax(`/${type}edit/setrole/${objectId}`, {
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    data: { role: newRole },
    success: (res) => {
      node.data().min_role = newRole;
      // TODO disabled alerts, the element conflicts with cy
      console.log(res.responseText);
    },
    error: (res) => {
      // TODO disabled alerts, the element conflicts with cy
      console.log(res.responseText);
    },
  });
}

function buildTagBadges(node) {
  const { type, tags, objectId } = node.data();
  return `
  <div 
    id="_${type}_${objectId}_badges_id"
    class="mb-3"
  >
    ${existingTagBadges(node)}    
    <button 
      class="badge bg-primary" 
      data-bs-toggle="dropdown"
      aria-expanded=false
    >  
      <i class="fas fa-plus"></i>
      <i class="fas fa-caret-down"></i>
    </button>
    <div class="dropdown-menu">
      <form id="${type}_${objectId}_options_form">
        <input 
          type="hidden"
          name="objectType"
          value="${type}"
        />
        <input
          type="hidden"
          name="objectId"
          value="${objectId}"
        />
        ${newTagOptions(tags, type, objectId)}
        <button 
          type="button"
          onClick="addToTag(this, '${node.id()}')"
          class="ms-3 mt-2 mb-1 btn btn-warning"
        >
          Add to tags
        </button>
      </form>
    </div>
  </div>
  `;
}

function addToTag(srcButton, nodeId) {
  const form = $(srcButton).closest("form");
  let objectType;
  let objectId;
  const tag_ids = [];
  for (const param of form.serializeArray()) {
    switch (param.name) {
      case "objectType": {
        objectType = param.value;
        break;
      }
      case "objectId": {
        objectId = param.value;
        break;
      }
      case "tagId": {
        tag_ids.push(param.value);
        break;
      }
    }
  }
  if (tag_ids.length > 0) {
    $.ajax(`/tag-entries/add/multiple_tags/${objectType}/${objectId}`, {
      type: "POST",
      headers: {
        "CSRF-Token": _sc_globalCsrf,
      },
      data: { tag_ids },
      success: (res) => {
        const badgesDiv = document.getElementById(
          `_${objectType}_${objectId}_badges_id`
        );
        for (const tag of res.tags) {
          // create new badge
          const tagBadge = document.createElement("div");
          tagBadge.classList.add("badge", "bg-primary");
          tagBadge.innerHTML = `${tag.name} 
            <i 
              class="fas fa-times ms-1"
              onClick="removeObjectFromTag(this, '${objectType}', ${objectId}, 
                ${tag.id}, '${tag.name}', '${nodeId}')"
            ></i>`;
          tagBadge.id = `_${objectType}_badge_${tag.id}_${objectId}`;
          const allChildren = badgesDiv.childNodes;
          badgesDiv.insertBefore(tagBadge, allChildren[allChildren.length - 4]);
          // remove the add option
          const addOptionDiv = document.getElementById(
            `tag_add_div_${tag.id}_${objectType}_${objectId}`
          );
          addOptionDiv.remove();
          // add the tag to the cy node
          const node = cy.nodes().find((node) => node.id() === nodeId);
          node.data().tags.push(tag);
        }
      },
      error: (res) => {
        // TODO disabled alerts, the element conflicts with cy
        console.log(res.responseText);
      },
    });
  }
}

function buildCardBody(node) {
  switch (node.data().type) {
    case "view": {
      return buildViewContent(node);
    }
    case "page": {
      return buildPageContent(node);
    }
    case "table": {
      return buildTableContent(node);
    }
    case "trigger": {
      return buildTriggerContent(node);
    }
  }
}

function buildViewContent(node) {
  const { table, viewtemplate } = node.data();
  return `
    <div class="container mb-2">
      <div class="row">
        <div class="col">${viewtemplate}</div>
        <div class="col">${table}</div>
      </div>
    </div>`;
}

function buildPageContent(node) {
  // TODO
  return `
  `;
}

function buildTableContent(node) {
  const { fields } = node.data();
  return `
    <div class="container">
      ${fields
        .map((field) => {
          return `
            <div class="row">
              <div class="col">${field.name} :</div>
              <div class="col ps-0">${field.typeName}</div>
            </div>`;
        })
        .join("")}
    </div>`;
}

function buildTriggerContent(node) {
  // TODO
  return `
  `;
}

function newTagOptions(existingTags, type, objectId) {
  const existingTagIds = new Set(existingTags.map((tag) => tag.id));
  const newTagOptions = allTags.filter((tag) => !existingTagIds.has(tag.id));
  return newTagOptions
    .map((tag) => {
      const inputId = `tag_add_box_${tag.id}`;
      const divId = `tag_add_div_${tag.id}_${type}_${objectId}`;
      return `
        <div 
          class="ms-3 mt-3 form-check"
          id="${divId}"
        >
          <label 
            class="form-check-label"
            for="${inputId}"
          >
            ${tag.name}
          </label>
          <input
            type="checkbox"
            class="form-check-input"
            id="${inputId}"
            name="tagId"
            value="${tag.id}"
            checked=false
            autocomplete="off"
          />
        </div>
      `;
    })
    .join("");
}

function removeObjectFromTag(src, type, objectId, tagId, tagName, nodeId) {
  $.ajax(`/tag-entries/remove/${type}/${objectId}/${tagId}`, {
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    data: { tag_id: tagId },
    success: (res) => {
      // remove tag badge
      src.parentNode.remove();
      // add option checkbox
      const divId = `tag_add_div_${tagId}_${type}_${objectId}`;
      const inputId = `tag_add_box_${tagId}`;
      const optionsDiv = document.createElement("div");
      optionsDiv.innerHTML = `
        <div 
          class="ms-3 mt-3 form-check"
          id="${divId}"
        >
          <label 
            class="form-check-label"
            for="${inputId}"
          >
            ${tagName}
          </label>
          <input
            type="checkbox"
            class="form-check-input"
            id="${inputId}"
            name="tagId"
            value="${tagId}"
            checked=false
            autocomplete="off"
          />
        </div>
      `;
      const optionsContainer = document.getElementById(
        `${type}_${objectId}_options_form`
      );
      const childNodes = optionsContainer.childNodes;
      const addButton = childNodes[childNodes.length - 2];
      optionsContainer.insertBefore(optionsDiv, addButton);
      // remove tag from cy node
      const node = cy.nodes().find((node) => node.id() === nodeId);
      const { tags } = node.data();
      const index = tags.findIndex((tag) => tag.id === tagId);
      tags.splice(index, 1);
    },
    error: (res) => {
      // TODO disabled alerts, the element conflicts with cy
      console.log(res.responseText);
    },
  });
}

function existingTagBadges(node) {
  const { tags, type, objectId } = node.data();
  return tags
    .map((tag) => {
      return `
        <div 
          class="badge bg-primary"
          id="_${type}_badge_${tag.id}_${objectId}"
        >
          ${tag.name}
          <i 
            class="fas fa-times ms-1"
            onClick="removeObjectFromTag(
              this, '${type}', ${objectId}, 
              ${tag.id}, '${tag.name}', '${node.id()}')"
          >
          </i>
        </div>`;
    })
    .join("");
}

function reloadCy() {
  $.ajax("/diagram/data", {
    dataType: "json",
    type: "GET",
    headers: { "CSRF-Token": _sc_globalCsrf },
    data: !tagFilterEnabled ? entityFilter : { ...entityFilter, tagFilterIds },
  }).done((res) => {
    const cfg = {
      container: document.getElementById("cy"),
      maxZoom: 2,
      wheelSensitivity: 0.3,
      ...res,
    };
    window.cy = cytoscape(cfg);
    initMouseOver();
  });
}

function toggleEntityFilter(type) {
  switch (type) {
    case "views": {
      entityFilter.showViews = !entityFilter.showViews;
      break;
    }
    case "pages": {
      entityFilter.showPages = !entityFilter.showPages;
      break;
    }
    case "tables": {
      entityFilter.showTables = !entityFilter.showTables;
      break;
    }
    case "trigger": {
      entityFilter.showTrigger = !entityFilter.showTrigger;
      break;
    }
  }
}

function toggleTagFilter(id) {
  if (!tagFilterEnabled) enableTagFilter();
  const index = tagFilterIds.indexOf(id);
  if (index > -1) {
    tagFilterIds.splice(index, 1);
  } else {
    tagFilterIds.push(id);
  }
}

function enableTagFilter() {
  tagFilterEnabled = true;
  for (const node of document.querySelectorAll('[id^="tagFilter_box_"]')) {
    node.style = "";
  }
  for (const node of document.querySelectorAll('[id^="tagFilter_label_"]')) {
    node.style = "";
  }
  const box = document.getElementById("noTagsId");
  box.checked = false;
}

function toggleTagFilterMode() {
  if (tagFilterEnabled) {
    tagFilterEnabled = false;
    for (const node of document.querySelectorAll('[id^="tagFilter_box_"]')) {
      node.style = "opacity: 0.5;";
    }
    for (const node of document.querySelectorAll('[id^="tagFilter_label_"]')) {
      node.style = "opacity: 0.5;";
    }
  } else {
    enableTagFilter();
  }
}
