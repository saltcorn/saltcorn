function showHideCol(nm, e) {
  if (e && e.checked) window.tabulator_table.showColumn(nm);
  else window.tabulator_table.hideColumn(nm);
}

function lookupIntToString(cell, formatterParams, onRendered) {
  const cellVal = cell.getValue()
  const val = typeof cellVal === "object" && cellVal !== null
    ? `${cellVal.id}`
    : `${cellVal}`;
  const res = formatterParams.values[val];
  return res;
}
function deleteIcon() {
  //plain text value
  return '<i class="far fa-trash-alt"></i>';
}

function flatpickerEditor(cell, onRendered, success, cancel, editorParams) {
  var input = $("<input type='text'/>");
  const dayOnly = editorParams && editorParams.dayOnly;
  input.flatpickr({
    enableTime: !dayOnly,
    dateFormat: dayOnly ? "Y-m-d" : "Z",
    time_24hr: true,
    locale: "en", // global variable with locale 'en', 'fr', ...
    defaultDate: cell.getValue(),
    onClose: function (selectedDates, dateStr, instance) {
      evt = window.event;
      var isEscape = false;
      if ("key" in evt) {
        isEscape = evt.key === "Escape" || evt.key === "Esc";
      } else {
        isEscape = evt.keyCode === 27;
      }
      if (isEscape) {
        // user hit escape
        cancel();
      } else {
        success(dateStr);
      }
    },
  });

  input.css({
    border: "1px",
    background: "transparent",
    padding: "4px",
    width: "100%",
    "box-sizing": "border-box",
  });

  input.val(cell.getValue());

  var inputBlur = function (e) {
    if (e.target !== input[0]) {
      if ($(e.target).closest(".flatpicker-input").length === 0) {
        $(document).off("mousedown", inputBlur);
      }
    }
  };

  $(document).on("mousedown", inputBlur);

  onRendered(function () {
    input.focus();
  });

  return input[0];
}

function isoDateTimeFormatter(cell, formatterParams, onRendered) {
  const val = cell.getValue();
  if (!val) return "";

  return new Date(val).toLocaleString(window.detected_locale || "en");
}

function isoDateFormatter(cell, formatterParams, onRendered) {
  const val = cell.getValue();
  if (!val) return "";
  if (formatterParams && formatterParams.format)
    return moment(val).format(formatterParams.format);

  return new Date(val).toLocaleDateString(window.detected_locale || "en");
}
function colorFormatter(cell, formatterParams, onRendered) {
  const val = cell.getValue();
  if (!val) return "";

  return $(
    `<div style="height: 15px; width: 30px; background-color: ${val}"></div>`
  )[0];
}

function jsonFormatter(cell, formatterParams, onRendered) {
  const val = cell.getValue();
  if (val === null) return "";
  return JSON.stringify(val, null, 1);
}

function versionsFormatter(cell, formatterParams, onRendered) {
  const value = cell.getValue();
  const row = cell.getRow().getData();
  return $(`<a href="/list/_versions/${window.tabulator_table_name}/${row.id}">
    ${value || 0}&nbsp;<i class="fa-sm fas fa-list"></i></a>`)[0];
}
function colorEditor(cell, onRendered, success, cancel) {
  const editor = document.createElement("input");

  editor.setAttribute("type", "color");
  editor.value = cell.getValue();
  //when the value has been set, trigger the cell to update
  function successFunc() {
    const val = editor.value;
    success(val);
  }

  editor.addEventListener("change", successFunc);
  editor.addEventListener("blur", successFunc);

  //return the editor element
  return editor;
}

function jsonEditor(cell, onRendered, success, cancel) {
  const editor = document.createElement("textarea");

  editor.value = JSON.stringify(cell.getValue());
  //when the value has been set, trigger the cell to update
  function successFunc() {
    const val = editor.value;
    try {
      success(JSON.parse(val));
    } catch (e) {
      if (e) tabulator_show_error(e.message);
      cancel();
    }
  }

  editor.addEventListener("change", successFunc);
  editor.addEventListener("blur", successFunc);

  //return the editor element
  return editor;
}
function add_tabulator_row() {
  window.tabulator_table.addRow({}, true);
}

function delete_tabulator_row(e, cell) {
  const def = cell.getColumn().getDefinition();
  if (def && def.formatterParams && def.formatterParams.confirm) {
    if (!confirm("Are you sure you want to delete this row?")) return;
  }
  const tableName = def?.formatterParams?.tableName || window.tabulator_table_name

  const row = cell.getRow().getData();
  if (!row.id) {
    cell.getRow().delete();
    return;
  }
  $.ajax({
    type: "DELETE",
    url: `/api/${tableName}/${row.id}`,
    data: row, // to process primary keys different from id
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    success: () => cell.getRow().delete(),
    error: tabulator_error_handler,
  });
}

function tabulator_error_handler(request) {
  let errtxt =
    request.responseJSON && request.responseJSON.error
      ? request.responseJSON.error
      : request.responseText;
  if (errtxt) {
    tabulator_show_error(errtxt);
  }
}
function tabulator_show_error(errtxt) {
  $("#jsGridNotify").html(`<div class="alert alert-danger" role="alert">
    ${errtxt}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close">   
  </button>
  </div>`);
}
