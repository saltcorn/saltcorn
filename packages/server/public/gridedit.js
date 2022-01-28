/**
 * jsgrid_controller
 * @param table_name -
 * @param vc -
 * @param keyfields -
 * @returns {{deleteItem: (function(*): *), loadData: (function(*=): *), updateItem: (function(*=): *), insertItem: (function(*=): *)}}
 */

/*
function jsgrid_controller(table_name, vc, keyfields) {
  var url = "/api/" + table_name + "/";
  //
  var fixKeys = function (item) {
    keyfields.forEach((kf) => {
      if (kf.type === "Integer") item[kf.name] = +item[kf.name];
    });
    return item;
  };
  var errorHandler = function (prom) {
    return function (request) {
      var errtxt =
        request.responseJSON && request.responseJSON.error
          ? request.responseJSON.error
          : request.responseText;
      $("#jsGridNotify").html(`<div class="alert alert-danger" role="alert">
    ${errtxt}
    <button type="button" class="close" data-dismiss="alert" aria-label="Close">
    <span aria-hidden="true">&times;</span>
  </button>
  </div>`);
      if (prom) prom.reject(errtxt);
    };
  };
  return {
    // load of data
    loadData: function (filter) {
      var data = $.Deferred();
      $.ajax({
        type: "GET",
        url: url + (vc ? "?versioncount=on" : ""),
        data: filter,
        error: errorHandler(data),
      }).done(function (resp) {
        data.resolve(resp.success);
      });
      return data.promise();
    },
    // insert row
    insertItem: function (item) {
      var data = $.Deferred();
      $.ajax({
        type: "POST",
        url: url,
        data: item,
        headers: {
          "CSRF-Token": _sc_globalCsrf,
        },
        error: errorHandler(data),
      }).done(function (resp) {
        item._versions = 1;
        if (resp.success) {
          item.id = resp.success;
          data.resolve(fixKeys(item));
        } else {
          data.resolve();
        }
      });
      return data.promise();
    },
    // update row
    updateItem: function (item) {
      var data = $.Deferred();
      $.ajax({
        type: "POST",
        url: url + item.id,
        data: item,
        headers: {
          "CSRF-Token": _sc_globalCsrf,
        },
        error: errorHandler(data),
      }).done(function (resp) {
        if (item._versions) item._versions = +item._versions + 1;
        data.resolve(fixKeys(item));
      });
      return data.promise();
    },
    // delete row
    deleteItem: function (item) {
      return $.ajax({
        type: "DELETE",
        url: url + item.id,
        data: item, // to process primary keys different from id
        headers: {
          "CSRF-Token": _sc_globalCsrf,
        },
        error: errorHandler(),
      });
    },
  };
}
function DecimalField(config) {
  jsGrid.fields.number.call(this, config);
}
DecimalField.prototype = new jsGrid.fields.number({
  filterValue: function () {
    return this.filterControl.val()
      ? parseFloat(this.filterControl.val() || 0, 10)
      : undefined;
  },

  insertValue: function () {
    return this.insertControl.val()
      ? parseFloat(this.insertControl.val() || 0, 10)
      : undefined;
  },

  editValue: function () {
    return this.editControl.val()
      ? parseFloat(this.editControl.val() || 0, 10)
      : undefined;
  },
});

jsGrid.fields.decimal = jsGrid.DecimalField = DecimalField;

var ColorField = function (config) {
  jsGrid.Field.call(this, config);
};

ColorField.prototype = new jsGrid.Field({
  itemTemplate: function (value) {
    return $("<div>").css({
      display: "inline-block",
      background: value,
      width: "50px",
      height: "20px",
    });
  },

  insertTemplate: function (value) {
    var insertPicker = (this._insertPicker = $("<input>").attr(
      "type",
      "color"
    ));

    return insertPicker;
  },

  editTemplate: function (value) {
    var editPicker = (this._editPicker = $("<input>")
      .attr("type", "color")
      .val(value));

    return editPicker;
  },

  insertValue: function () {
    return this._insertPicker.val();
  },

  editValue: function () {
    return this._editPicker.val();
  },
});

jsGrid.fields.color = ColorField;

var DateField = function (config) {
  jsGrid.Field.call(this, config);
};

DateField.prototype = new jsGrid.Field({
  itemTemplate: function (value) {
    var v = typeof value === "string" && value !== "" ? new Date(value) : value;
    return v && v.toLocaleString ? v.toLocaleString() : v;
  },

  insertTemplate: function (value) {
    var insertPicker = (this._insertPicker = $("<input>").attr("type", "text"));
    setTimeout(function () {
      flatpickr(insertPicker, {
        enableTime: true,
        dateFormat: "Z",
        altInput: true,
        altFormat: "Y-m-d h:i K",
      });
    });
    return insertPicker;
  },

  editTemplate: function (value) {
    var editPicker = (this._editPicker = $("<input>")
      .attr("type", "text")
      .val(value));
    setTimeout(function () {
      flatpickr(editPicker, {
        enableTime: true,
        dateFormat: "Z",
        altInput: true,
        altFormat: "Y-m-d h:i K",
      });
    });
    return editPicker;
  },

  insertValue: function () {
    return this._insertPicker.val();
  },

  editValue: function () {
    return this._editPicker.val();
  },
});

jsGrid.fields.date = DateField;

var HtmlField = function (config) {
  jsGrid.Field.call(this, config);
};
HtmlField.prototype = new jsGrid.Field({
  align: "left",
  itemTemplate: function (value, item) {
    if (value) {
      //return +value+1;
      return value;
    } else return "";
  },
});
jsGrid.fields.html = HtmlField;
*/
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
  window.tabulator_table.addRow({});
}

function delete_tabulator_row(e, cell) {
  const row = cell.getRow().getData();

  $.ajax({
    type: "DELETE",
    url: window.tabulator_api_url + row.id,
    data: row, // to process primary keys different from id
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    success: () => cell.getRow().delete(),
    //error: errorHandler(),
  });
}
