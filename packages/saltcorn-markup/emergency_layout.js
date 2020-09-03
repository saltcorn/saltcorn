const {
  ul,
  li,
  a,
  span,
  hr,
  div,
  text,
  i,
  h6,
  h1,
  p,
  header,
  img,
  footer,
} = require("./tags");
const renderLayout = require("./layout");
const { renderForm, link } = require(".");
const { navbar, alert } = require("./layout_utils");

const renderBody = (title, body, alerts) =>
  renderLayout({
    blockDispatch: {},
    layout:
      typeof body === "string" ? { type: "card", title, contents: body } : body,
    alerts,
  });

const wrap = ({ title, menu, brand, alerts, currentUrl, body, headers }) =>
  navbar(brand, menu, currentUrl) + renderBody(title, body, alerts);

module.exports = wrap;
