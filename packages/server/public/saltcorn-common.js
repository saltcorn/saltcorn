function press_store_button(clicked) {
  const width = $(clicked).width();
  $(clicked).html('<i class="fas fa-spinner fa-spin"></i>').width(width);
}

function notifyAlert(note, spin) {
  if (Array.isArray(note)) {
    note.forEach(notifyAlert);
    return;
  }
  var txt, type;
  if (typeof note == "string") {
    txt = note;
    type = "info";
  } else {
    txt = note.text;
    type = note.type;
  }

  $("#alerts-area")
    .append(`<div class="alert alert-${type} alert-dismissible fade show ${
    spin ? "d-flex align-items-center" : ""
  }" role="alert">
  ${txt}
  ${
    spin
      ? `<div class="spinner-border ms-auto" role="status" aria-hidden="true"></div>`
      : `<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close">
  </button>`
  }
</div>`);
}

function common_done(res, isWeb = true) {
  if (res.notify) notifyAlert(res.notify);
  if (res.error) notifyAlert({ type: "danger", text: res.error });
  if (res.eval_js) eval(res.eval_js);
  if (res.reload_page) {
    (isWeb ? location : parent.location).reload(); //TODO notify to cookie if reload or goto
  }
  if (res.download) {
    const dataurl = `data:${
      res.download.mimetype || "application/octet-stream"
    };base64,${res.download.blob}`;
    fetch(dataurl)
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement("a");
        link.href = window.URL.createObjectURL(blob);
        if (res.download.filename) link.download = res.download.filename;
        else link.target = "_blank";
        link.click();
      });
  }
  if (res.goto && !isWeb)
    notifyAlert({
      type: "danger",
      text: "Goto is not supported in a mobile deployment.",
    });
  else if (res.goto) {
    if (res.target === "_blank") window.open(res.goto, "_blank").focus();
    else window.location.href = res.goto;
  }
}

function submitWithEmptyAction(form) {
  var formAction = form.action;
  form.action = "javascript:void(0)";
  form.submit();
  form.action = formAction;
}

function unique_field_from_rows(
  rows,
  id,
  field_name,
  space,
  start,
  always_append,
  char_type,
  value
) {
  const gen_char = (i) => {
    switch (char_type) {
      case "Lowercase Letters":
        return String.fromCharCode("a".charCodeAt(0) + i);
      case "Uppercase Letters":
        return String.fromCharCode("A".charCodeAt(0) + i);
      default:
        return i;
    }
  };
  const vals = rows
    .map((o) => o[field_name])
    .filter((s) => s.startsWith(value));
  if (vals.includes(value) || always_append) {
    for (let i = start || 0; i < vals.length + (start || 0) + 2; i++) {
      const newname = `${value}${space ? " " : ""}${gen_char(i)}`;
      if (!vals.includes(newname)) {
        $("#" + id).val(newname);
        return;
      }
    }
  }
}
