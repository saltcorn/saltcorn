import { fileURLToPath as __fileURLToPath } from "url";
import { dirname as __pathDirname } from "path";
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __pathDirname(__filename);
import Table from "@saltcorn/data/models/table";
import View from "@saltcorn/data/models/view";
import File from "@saltcorn/data/models/file";
import _ from "underscore";
import { promises as fs } from "fs";
import MarkdownIt from "markdown-it";
const md = new MarkdownIt();
import moment from "moment";

import { pre } from "@saltcorn/markup/tags";
import path from "path";
import { getState } from "@saltcorn/data/db/state";
import { oneOf } from "@saltcorn/types/generators";
import { configTypes } from "@saltcorn/data/models/config";
const get_md_file = async (topic, isFullPath) => {
  try {
    if (isFullPath) {
      const fileBuf = await fs.readFile(topic);
      return fileBuf.toString();
    } else {
      const fp = File.normalise_in_base(
        path.join(__dirname, "..", "..", "help"),
        `${topic}.tmd`
      );
      if (!fp) return false;
      const fileBuf = await fs.readFile(fp);
      return fileBuf.toString();
    }
  } catch (e) {
    return false;
  }
};

md.renderer.rules.table_open = function (tokens, idx) {
  return '<table class="help-md">';
};

const get_help_markup = async (topic, query, req, isFullPath) => {
  try {
    const context = {
      user: req.user,
      Table,
      View,
      scState: getState(),
      query,
      oneOf,
      moment,
      configTypes,
    };
    const mdTemplate = await get_md_file(topic, isFullPath);
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

export { get_help_markup };
