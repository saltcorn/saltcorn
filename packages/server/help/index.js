const Table = require("@saltcorn/data/models/table");
const File = require("@saltcorn/data/models/file");
const Handlebars = require("handlebars");
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

//https://gist.github.com/asselin/2762936
Handlebars.registerHelper("$", function (expr) {
  if (arguments.length < 2)
    throw new Error("Handlerbars Helper 'arrayaccess' needs 1 parameter");
  // eslint-disable-next-line
  with (this) {
    return eval(expr);
  }
});

const get_help_markup = async (topic, query) => {
  const context = {};
  if (query.table) {
    context.table = Table.findOne({ name: query.table });
  }
  const mdTemplate = await get_md_file(topic);
  if (!mdTemplate) return { markup: "Topic not found" };
  const template = Handlebars.compile(mdTemplate, {
    allowProtoMethodsByDefault: true,
  });
  const mdTopic = template(context);
  const markup = md.render(mdTopic);
  return { markup };
};

module.exports = { get_help_markup };
