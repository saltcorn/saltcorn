const {
  div,
  hr,
  form,
  input,
  label,
  i,
  a,
  span,
} = require("@saltcorn/markup/tags");

const restore_backup = (csrf, inner) =>
  form(
    {
      method: "post",
      action: `/admin/restore`,
      encType: "multipart/form-data",
    },
    input({ type: "hidden", name: "_csrf", value: csrf }),
    label({ class: "btn-link", for: "upload_to_restore" }, inner),
    input({
      id: "upload_to_restore",
      class: "d-none",
      name: "file",
      type: "file",
      accept: "application/zip,.zip",
      onchange: "this.form.submit();",
    })
  );

const add_edit_bar = ({ role, title, contents, what, url }) => {
  if (role > 1) return contents;
  const bar = div(
    { class: "alert alert-light d-print-none" },
    title,
    what && span({ class: "ml-1 badge badge-primary" }, what),
    a({ class: "ml-4", href: url }, "Edit&nbsp;", i({ class: "fas fa-edit" }))
  );

  if (contents.above) {
    contents.above.unshift(bar);
    return contents;
  } else return { above: [bar, contents] };
};

const send_settings_page = ({
  req,
  res,
  main_section,
  main_section_href,
  sub_sections,
  active_sub,
  contents,
  no_nav_pills,
}) => {
  const pillCard = no_nav_pills
    ? []
    : [
        {
          type: "card",
          contents: div(
            { class: "d-flex" },
            ul(
              { class: "nav nav-pills plugin-section" },
              sub_sections.map(({ text, href }) =>
                li(
                  { class: "nav-item" },
                  a(
                    {
                      href,
                      class: ["nav-link", active_sub === text && "active"],
                    },
                    req.__(text)
                  )
                )
              )
            )
          ),
        },
      ];
  res.sendWrap(req.__(active_sub), {
    above: [
      {
        type: "breadcrumbs",
        crumbs: [
          { text: req.__("Settings") },
          { text: req.__(main_section), href: main_section_href },
          { text: req.__(active_sub) },
        ],
      },
      ...pillCard,
      contents,
    ],
  });
};

module.exports = { restore_backup, add_edit_bar, send_settings_page };
