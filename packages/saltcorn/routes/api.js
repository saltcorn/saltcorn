const Router = require("express-promise-router");
const db = require("saltcorn-data/db");
const { isAdmin } = require("./utils.js");
const { mkTable, renderForm, link, post_btn } = require("saltcorn-markup");
const State = require("saltcorn-data/db/state");
const Form = require("saltcorn-data/models/form");
const Field = require("saltcorn-data/models/field");
const load_plugins = require("../load_plugins");

const router = new Router();
module.exports = router;