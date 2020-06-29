//https://stackoverflow.com/a/698386
jQuery.fn.swapWith = function(to) {
  return this.each(function() {
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
  newe.find("[name]").each(function(ix, element) {
    var newnm = element.name.replace("_0", "_" + newix);
    var newid = element.id.replace("_0", "_" + newix);
    $(element)
      .attr("name", newnm)
      .attr("id", newid);
  });
  newe.appendTo($("div.repeats-" + nm));
}
// "e.closest('.form-namespace').find('.coltype').val()==='Field';"
function apply_showif() {
  $("[data-show-if]").each(function(ix, element) {
    var e = $(element);
    var to_show = new Function("e", "return " + e.attr("data-show-if"));
    if (to_show(e)) e.show();
    else e.hide();
  });
  $("[data-calc-options]").each(function(ix, element) {
    var e = $(element);
    var data = JSON.parse(decodeURIComponent(e.attr("data-calc-options")));

    var val = e
      .closest(".form-namespace")
      .find(data[0])
      .val();

    var options = data[1][val];
    var current = e.attr("data-selected");
    //console.log(val, options, current,data)
    e.empty();
    (options || []).forEach(o => {
      if (current === o) e.append($("<option selected>" + o + "</option>"));
      else e.append($("<option>" + o + "</option>"));
    });
    e.change(function(ec) {
      e.attr("data-selected", ec.target.value);
    });
  });
}

function rep_del(e) {
  var myrep = $(e).closest(".form-repeat");
  var ix = myrep.index();
  var parent = myrep.parent();
  parent.children().each(function(childix, element) {
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

$(function() {
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
      $(`input#input${nm}`).val("");
      break;
  }
}

function view_post(viewname, route, data) {
  $.ajax("/view/" + viewname + "/" + route, {
    dataType: "json",
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf
    },
    contentType: "application/json",
    data: JSON.stringify(data)
  });
}
