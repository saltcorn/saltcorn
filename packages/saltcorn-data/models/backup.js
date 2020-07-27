const { contract, is } = require("contractis");
const { getState } = require("../db/state");
const Table = require("./table");
const View = require("./view");
const Field = require("./field");
const Plugin = require("./plugin");
const Page = require("./page");
const {
    table_pack,
    view_pack,
    plugin_pack,
    page_pack,
    install_pack,
  } = require("./pack");

  const {asyncMap}=require("../utils")

const create_backup = async ()=>{
    const tables=await asyncMap(await Table.find({}), async t=>await table_pack(t.name))
    const views=await asyncMap(await View.find({}), async v=>(await view_pack(v.name)))
    const plugins=await asyncMap(await Plugin.find({}), async v=>(await plugin_pack(v.name)))
    const pages=await asyncMap(await Page.find({}), async v=>(await page_pack(v.name)))
    var pack = { tables, views, plugins, pages };
}
  
  module.exports={create_backup}