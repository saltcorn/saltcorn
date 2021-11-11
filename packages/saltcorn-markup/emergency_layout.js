/**
 * @category saltcorn-markup
 * @module emergency_layout
 */

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

/**
 * @param {string} title 
 * @param {string|object} body 
 * @param {object[]} alerts 
 * @returns {string}
 */
const renderBody = (title, body, alerts) =>
  renderLayout({
    blockDispatch: {},
    layout:
      typeof body === "string" ? { type: "card", title, contents: body } : body,
    alerts,
  });

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {object} opts.menu
 * @param {object} opts.brand
 * @param {object[]} opts.alerts
 * @param {string} opts.currentUrl
 * @param {string|object} opts.body
 * @param {object[]} opts.headers
 * @returns {string}
 */
const wrap = ({ title, menu, brand, alerts, currentUrl, body, headers }) =>
  navbar(brand, menu, currentUrl) + renderBody(title, body, alerts);

module.exports = wrap;
