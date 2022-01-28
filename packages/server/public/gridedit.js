function showHideCol(nm, e) {
  if (e && e.checked) window.tabulator_table.showColumn(nm);
  else window.tabulator_table.hideColumn(nm);
}

function lookupIntToString(cell, formatterParams, onRendered) {
  const val = `${cell.getValue()}`;
  const res = formatterParams.values[val];
  return res;
}

function flatpickerEditor(cell, onRendered, success, cancel) {
  var input = $("<input type='text'/>");

  input.flatpickr({
    enableTime: true,
    dateFormat: "Y-m-d H:i",
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
        console.log("success", dateStr);
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
function add_tabulator_row() {
  window.tabulator_table.addRow({}, true);
}

function delete_tabulator_row(e, cell) {
  const row = cell.getRow().getData();
  if (!row.id) {
    cell.getRow().delete();
    return;
  }
  $.ajax({
    type: "DELETE",
    url: `/api/${window.tabulator_table_name}/${row.id}`,
    data: row, // to process primary keys different from id
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    success: () => cell.getRow().delete(),
    //error: errorHandler(),
  });
}
