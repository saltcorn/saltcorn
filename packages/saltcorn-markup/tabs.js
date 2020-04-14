const { a, text, div, ul, li } = require("./tags");

const mkId=str=>text(str.split(' ').join('_'))

const tabs = obj => {
  const entries = Array.isArray(obj) ? obj : Object.entries(obj);
  const lis = entries.map(e =>
    li(
      { class: "nav-item" },
      a(
        {
          class: "nav-link active",
          "data-toggle": "tab",
          href: `#${mkId(e[0])}`,
          id: `${mkId(e[0])}-tab`,
          role: "tab",
          "aria-controls": "home",
          "aria-selected": "true"
        },
        text(e[0])
      )
    )
  );
  const divs = entries.map(e =>
    div(
      {
        class: "tab-pane",
        id: `${mkId(e[0])}`,
        role: "tabpanel",
        "aria-labelledby": `${mkId(e[0])}-tab`
      },
      e[1]
    )
  );
  return (
    ul({ class: "nav nav-tabs", role: "tablist" }, lis) +
    div({ class: "tab-content" }, divs)
  );
};

module.exports = tabs;
