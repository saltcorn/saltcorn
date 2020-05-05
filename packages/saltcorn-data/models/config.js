const db = require("../db");
const { contract, is } = require("contractis");

const getConfig = async (key, def) => {
  const cfg = await db.selectMaybeOne("_sc_config", { key });
  if (cfg) return cfg.value.v;
  else return def;
};

const getAllConfig = async () => {
  const cfgs = await db.select("_sc_config");
  var cfg = {};
  cfgs.forEach(({ key, value }) => {
    cfg[key] = value.v;
  });
  return cfg;
};

const setConfig = async (key, value) => {
  await db.query(
    `insert into _sc_config(key, value) values($1, $2) 
                    on conflict (key) do update set value = $2`,
    [key, {v:value}]
  );
};
module.exports = { getConfig, getAllConfig, setConfig };
