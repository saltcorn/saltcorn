/*global saltcorn, wrapContents, MobileRequest, */

const getSyncSettingsView = (context) => {
  const content = saltcorn.markup.div(
    { class: "container" },
    saltcorn.markup.div(
      { class: "row" },
      saltcorn.markup.div(
        { class: "col-9" },
        saltcorn.markup.div(
          { class: "fs-6 fw-bold text-decoration-underline" },
          "Upload offline data"
        ),
        saltcorn.markup.div(
          "Upload the data from your last offline session to the server."
        )
      ),
      saltcorn.markup.div(
        { class: "col-3" },
        saltcorn.markup.button(
          {
            class: "btn btn-primary",
            type: "button",
            onClick: "callUploadSync()",
          },
          saltcorn.markup.i({ class: "fas fa-sync" })
        )
      )
    ),
    saltcorn.markup.hr(),
    saltcorn.markup.div(
      { class: "row" },
      saltcorn.markup.div(
        { class: "col-9" },
        saltcorn.markup.div(
          { class: "fs-6 fw-bold text-decoration-underline" },
          "Download server data"
        ),
        saltcorn.markup.div(
          "Download the latest data for your next offline session."
        )
      ),
      saltcorn.markup.div(
        { class: "col-3" },
        saltcorn.markup.button(
          {
            class: "btn btn-primary",
            type: "button",
            onClick: "callDownloadSync()",
          },
          saltcorn.markup.i({ class: "fas fa-sync" })
        )
      )
    ),
    saltcorn.markup.hr()
  );
  return wrapContents(content, "Sync Settings", context, new MobileRequest());
};

// get/sync/ask_overwrite
const getAskOverwriteDialog = (context) => {
  const content = saltcorn.markup.div(
    saltcorn.markup.div(
      { class: "mb-3 h6" },
      "This replaces your offline data."
    ),
    saltcorn.markup.button(
      {
        class: "btn btn-secondary me-2",
        type: "button",
        "data-bs-dismiss": "modal",
      },
      "Close"
    ),
    saltcorn.markup.button(
      {
        class: "btn btn-primary close",
        type: "button",
        onClick: "closeModal(); callDownloadSync(true)",
      },
      "Download anyway"
    )
  );
  return wrapContents(content, "Warning", context, new MobileRequest());
};
