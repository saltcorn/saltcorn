const renderForm = require("./form");
const mkTable = require("./table");
const tabs = require("./tabs");
const { a, text } = require("./tags");

const link = (href, s) => a({ href: text(href) }, text(s));

const post_btn = (href, s) => `<form action="${text(href)}" method="post">
<button type="submit" class="btn btn-primary">${text(s)}</button></form>`;

module.exports = {
  mkTable,
  renderForm,
  link,
  post_btn,
  tabs
};
