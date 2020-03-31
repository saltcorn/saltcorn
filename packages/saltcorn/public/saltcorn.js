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
    var depends_on_elem = e
      .closest(".form-namespace")
      .find(e.attr("data-show-if"));

    var to_show = depends_on_elem.val() == e.attr("data-show-if-is");
    if (to_show) e.show();
    else e.hide();
  });
}

$(function() {
  $("form").change(apply_showif);
  apply_showif();
});
