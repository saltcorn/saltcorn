const State = require("saltcorn-data/db/state");
const db = require("saltcorn-data/db");
const View = require("saltcorn-data/models/view");
const { link, renderForm } = require("saltcorn-markup");

module.exports = async (req, res) => {
    const isAuth = req.isAuthenticated();
    const views = State.views.filter(
      v => v.on_root_page && (isAuth || v.is_public)
    );

    if (views.length === 0)
      res.sendWrap("Hello", "Welcome! you have no defined views");
    else if (views.length === 1) {
      const view = await View.findOne({ name: views[0].name });
      if (!req.isAuthenticated() && !view.is_public) {
        res.sendWrap("Hello", "Welcome! you have no defined views");
      } else {
        const resp = await view.run(req.query);
        const state_form = await view.get_state_form(req.query);

        res.sendWrap(
          `${view.name} view`,
          div(state_form ? renderForm(state_form) : "", resp)
        );
      }
    } else {
      const viewlis = views.map(v => li(link(`/view/${v.name}`, v.name)));
      res.sendWrap("Hello", ul(viewlis));
    }
  }