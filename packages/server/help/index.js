const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
const File = require("@saltcorn/data/models/file");
const _ = require("underscore");
const fs = require("fs").promises;
const MarkdownIt = require("markdown-it"),
  md = new MarkdownIt();

const { pre } = require("@saltcorn/markup/tags");
const path = require("path");
const { getState } = require("@saltcorn/data/db/state");
const { oneOf } = require("@saltcorn/types/generators");
const get_md_file = async (topic) => {
  try {
    const fp = path.join(__dirname, `${File.normalise(topic)}.tmd`);
    const fileBuf = await fs.readFile(fp);
    return fileBuf.toString();
  } catch (e) {
    return false;
  }
};

md.renderer.rules.table_open = function (tokens, idx) {
  return '<table class="help-md">';
};

const get_help_markup = async (topic, query, req) => {
  try {
    const context = {
      user: req.user,
      Table,
      View,
      scState: getState(),
      query,
      oneOf,
    };
    const mdTemplate = await get_md_file(topic);
    if (!mdTemplate) return { markup: "Topic not found" };
    const template = _.template(mdTemplate, {
      evaluate: /\{\{#(.+?)\}\}/g,
      interpolate: /\{\{([^#].+?)\}\}/g,
    });
    const mdTopic = template(context);
    const markup = md.render(mdTopic);
    return { markup };
  } catch (e) {
    console.error(e);
    return { markup: pre(e.toString()) };
  }
};

module.exports = { get_help_markup };
