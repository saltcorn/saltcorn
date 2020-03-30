function sortby(k) {
  $('input[name="_sortby"]').val(k);
  $("form.stateForm").submit();
}
function gopage(n) {
  $('input[name="_page"]').val(n);
  $("form.stateForm").submit();
}
