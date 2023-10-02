const Table = require("@saltcorn/data/models/table");
const File = require("@saltcorn/data/models/file");
const _ = require("underscore");
const fs = require("fs").promises;
const MarkdownIt = require("markdown-it"),
  md = new MarkdownIt();
const get_md_file = async (topic) => {
  try {
    const fp = require.resolve(`./${File.normalise(topic)}.hmd`);
    const fileBuf = await fs.readFile(fp);
    return fileBuf.toString();
  } catch (e) {
    return false;
  }
};

_.templateSettings = {
  evaluate: /\{\{#(.+?)\}\}/g,
  interpolate: /\{\{=(.+?)\}\}/g,
};

const get_help_markup = async (topic, query) => {
  const context = {};
  if (query.table) {
    context.table = Table.findOne({ name: query.table });
  }
  const mdTemplate = await get_md_file(topic);
  if (!mdTemplate) return { markup: "Topic not found" };
  const template = _.template(mdTemplate);
  const mdTopic = template(context);
  console.log(mdTopic);
  const markup = md.render(mdTopic);
  return { markup };
};

module.exports = { get_help_markup };
