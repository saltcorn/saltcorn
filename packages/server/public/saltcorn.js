//https://stackoverflow.com/a/698386
jQuery.fn.swapWith = function (to) {
  return this.each(function () {
    var copy_to = $(to).clone(true);
    var copy_from = $(this).clone(true);
    $(to).replaceWith(copy_from);
    $(this).replaceWith(copy_to);
  });
};

function sortby(k) {
  $('input[name="_sortby"]').val(k);
  $("form.stateForm").submit();
}
function gopage(n) {
  $('input[name="_page"]').val(n);
  $("form.stateForm").submit();
}
function add_repeater(nm) {
  var es = $("div.form-repeat.repeat-" + nm);
  var e = es.first();
  var newix = es.length;
  var newe = $(e).clone();
  newe.find("[name]").each(function (ix, element) {
    var newnm = element.name.replace("_0", "_" + newix);
    var newid = element.id.replace("_0", "_" + newix);
    $(element).attr("name", newnm).attr("id", newid);
  });
  newe.appendTo($("div.repeats-" + nm));
}
// "e.closest('.form-namespace').find('.coltype').val()==='Field';"
function apply_showif() {
  $("[data-show-if]").each(function (ix, element) {
    var e = $(element);
    var to_show = new Function("e", "return " + e.attr("data-show-if"));
    if (to_show(e)) e.show();
    else e.hide();
  });
  $("[data-calc-options]").each(function (ix, element) {
    var e = $(element);
    var data = JSON.parse(decodeURIComponent(e.attr("data-calc-options")));

    var val = e.closest(".form-namespace").find(data[0]).val();

    var options = data[1][val];
    var current = e.attr("data-selected");
    //console.log(val, options, current,data)
    e.empty();
    (options || []).forEach((o) => {
      if (current === o) e.append($("<option selected>" + o + "</option>"));
      else e.append($("<option>" + o + "</option>"));
    });
    e.change(function (ec) {
      e.attr("data-selected", ec.target.value);
    });
  });
}

function rep_del(e) {
  var myrep = $(e).closest(".form-repeat");
  var ix = myrep.index();
  var parent = myrep.parent();
  parent.children().each(function (childix, element) {
    if (childix > ix) {
      reindex(element, childix, childix - 1);
    }
  });
  myrep.remove();
}

function reindex(element, oldix, newix) {
  $(element).html(
    $(element)
      .html()
      .split("_" + oldix)
      .join("_" + newix)
  );
}

function rep_up(e) {
  var myrep = $(e).closest(".form-repeat");
  var ix = myrep.index();
  var parent = myrep.parent();
  if (ix > 0) {
    var swap_with = parent.children(".form-repeat").eq(ix - 1);
    reindex(myrep, ix, ix - 1);
    reindex(swap_with, ix - 1, ix);
    $(myrep).swapWith(swap_with);
  }
}

function rep_down(e) {
  var myrep = $(e).closest(".form-repeat");
  var ix = myrep.index();
  var parent = myrep.parent();
  var nchildren = parent.children(".form-repeat").length;
  if (ix < nchildren - 1) {
    var swap_with = parent.children(".form-repeat").eq(ix + 1);
    reindex(myrep, ix, ix + 1);
    reindex(swap_with, ix + 1, ix);
    $(myrep).swapWith(swap_with);
  }
}

$(function () {
  $("form").change(apply_showif);
  apply_showif();
});

//https://stackoverflow.com/a/6021027
function updateQueryStringParameter(uri, key, value) {
  var re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
  var separator = uri.indexOf("?") !== -1 ? "&" : "?";
  if (uri.match(re)) {
    return uri.replace(re, "$1" + key + "=" + value + "$2");
  } else {
    return uri + separator + key + "=" + value;
  }
}

function removeQueryStringParameter(uri, key) {
  var re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
  var separator = uri.indexOf("?") !== -1 ? "&" : "?";
  if (uri.match(re)) {
    uri = uri.replace(re, "$1" + "$2");
  }
  if (uri[uri.length - 1] === "?" || uri[uri.length - 1] === "&")
    uri = uri.substring(0, uri.length - 1);
  return uri;
}

function select_id(id) {
  window.location.href = updateQueryStringParameter(
    window.location.href,
    "id",
    id
  );
}

function set_state_field(key, value) {
  window.location.href = updateQueryStringParameter(
    window.location.href,
    key,
    value
  );
}
function unset_state_field(key) {
  window.location.href = removeQueryStringParameter(window.location.href, key);
}
function href_to(href) {
  window.location.href = href;
}

function tristateClick(nm) {
  var current = $(`button#trib${nm}`).html();
  switch (current) {
    case "?":
      $(`button#trib${nm}`).html("T");
      $(`input#input${nm}`).val("on");
      break;
    case "T":
      $(`button#trib${nm}`).html("F");
      $(`input#input${nm}`).val("off");
      break;
    default:
      $(`button#trib${nm}`).html("?");
      $(`input#input${nm}`).val("?");
      break;
  }
}

function view_post(viewname, route, data, onDone) {
  $.ajax("/view/" + viewname + "/" + route, {
    dataType: "json",
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    contentType: "application/json",
    data: JSON.stringify(data),
  }).done(onDone);
}
var logged_errors = [];
function globalErrorCatcher(message, source, lineno, colno, error) {
  if (logged_errors.includes(message)) return;
  logged_errors.push(message);
  var data = { message, stack: (error && error.stack) || "" };
  $.ajax("/crashlog/", {
    dataType: "json",
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    contentType: "application/json",
    data: JSON.stringify(data),
  });
}

function press_store_button(clicked) {
  $(clicked).html('<i class="fas fa-spinner fa-spin"></i>');
}

function ajax_modal(url) {
  if ($("#scmodal").length === 0) {
    $("body").append(`<div id="scmodal", class="modal" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Modal title</h5>
          <button type="button" class="close" data-dismiss="modal" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="modal-body">
          <p>Modal body text goes here.</p>
        </div>
      </div>
    </div>
  </div>`);
  }
  $.ajax(url, {
    success: function (res, textStatus, request) {
      var title = request.getResponseHeader("Page-Title");
      if (title) $("#scmodal .modal-title").html(title);
      $("#scmodal .modal-body").html(res);
      $("#scmodal").modal();
    },
  });
}
function ajaxSubmitForm(e) {
  var form = $(e).closest("form");
  var url = form.attr("action");
  var form_data = form.serialize();
  $.ajax(url, {
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    data: form_data,
    success: function () {
      $("#scmodal").modal("hide");
      location.reload();
    },
    error: function (request) {
      var title = request.getResponseHeader("Page-Title");
      if (title) $("#scmodal .modal-title").html(title);
      var body = request.responseText;
      if (body) $("#scmodal .modal-body").html(body);
    },
  });

  return false;
}
function ajax_post_btn(e, reload_on_done, reload_delay) {
  var form = $(e).closest("form");
  var url = form.attr("action");
  var form_data = form.serialize();
  $.ajax(url, {
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    data: form_data,
    success: function () {
      if (reload_on_done) location.reload();
    },
    complete: function () {
      if (reload_delay)
        setTimeout(function () {
          location.reload();
        }, reload_delay);
    },
  });

  return false;
}
