const Router = require("express-promise-router");
const { i, h3, p, a } = require("@saltcorn/markup/tags");
const { setTenant, isAdmin, error_catcher } = require("./utils.js");

const router = new Router();
module.exports = router;

const settingsCard = ({ title, icon, blurb, href }) => ({
  type: "card",
  url: href,
  contents: {
    besides: [i({ class: [icon, "fa-3x fa-fw mr-3"]}), a({ href }, h3(title)) + p(blurb)],
    widths: false,
  },
});

router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    res.sendWrap(req.__("Settings"), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [{ text: req.__("Settings") }],
        },
        settingsCard({
          title: req.__("About application"),
          icon: "fas fa-tools",
          blurb: req.__("Site identity settings, backup, email settings, system control and information"),
          href: "/admin",
        }),
        settingsCard({
          title: req.__("Plugins"),
          icon: "fas fa-plug",
          blurb: req.__("Plugin and pack installation and control"),
          href: "/plugins",
        }),
        settingsCard({
          title: req.__("Users and security"),
          icon: "fas fa-users-cog",
          blurb: req.__("User administration, edit roles, user and security settings, SSL certificates for https encryption"),
          href: "/useradmin",
        }),
        settingsCard({
          title: req.__("Site structure"),
          icon: "fas fa-compass",
          blurb: req.__("Menu, search, languages and tenants"),
          href: "/site-structure",
        }),
        settingsCard({
          title: req.__("Events"),
          icon: "fas fa-calendar-check",
          blurb: req.__("Actions, triggers and crash log"),
          href: "/events",
        }),
      ],
    });
  })
);
