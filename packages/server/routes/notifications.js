/**
 * @category server
 * @module routes/notifications
 * @subcategory routes
 */

const Router = require("express-promise-router");
const { isAdmin, setTenant, error_catcher, loggedIn } = require("./utils.js");
const Notification = require("@saltcorn/data/models/notification");
const { div, a, i, text, h5, p, span } = require("@saltcorn/markup/tags");
const moment = require("moment");
const { getState } = require("@saltcorn/data/db/state");
const Form = require("@saltcorn/data/models/form");
const File = require("@saltcorn/data/models/file");
const User = require("@saltcorn/data/models/user");
const { renderForm, post_btn } = require("@saltcorn/markup");
const db = require("@saltcorn/data/db");

const router = new Router();
module.exports = router;

const notificationSettingsForm = () =>
  new Form({
    action: `/notifications/settings`,
    noSubmitButton: true,
    onChange: `saveAndContinue(this)`,
    labelCols: 4,
    fields: [{ name: "notify_email", label: "Email", type: "Bool" }],
  });

router.get(
  "/",
  loggedIn,
  error_catcher(async (req, res) => {
    const { after } = req.query;
    const where = { user_id: req.user.id };
    if (after) where.id = { lt: after };
    const nots = await Notification.find(where, {
      orderBy: "id",
      orderDesc: true,
      limit: 20,
    });
    const unreads = nots.filter((n) => !n.read);
    if (unreads.length > 0)
      await Notification.mark_as_read(
        !db.isSQLite
          ? {
              id: { in: unreads.map((n) => n.id) },
            }
          : {
              or: unreads.map((n) => ({ id: n.id })),
            }
      );

    const form = notificationSettingsForm();
    const user = await User.findOne({ id: req.user?.id });
    form.values = { notify_email: user?._attributes?.notify_email };
    const notifyCards = nots.length
      ? nots.map((not) => ({
          type: "card",
          class: [!not.read && "unread-notify"],
          id: `notify-${not.id}`,
          contents: [
            div(
              { class: "d-flex" },
              span({ class: "fw-bold" }, not.title),
              span(
                {
                  class: "ms-2 text-muted",
                  title: not.created.toLocaleString(req.getLocale()),
                },
                moment(not.created).fromNow()
              ),
              div(
                { class: "ms-auto" },
                post_btn(
                  `/notifications/delete/${not.id}`,
                  "",
                  req.csrfToken(),
                  {
                    icon: "fas fa-times-circle",
                    klass: "btn-link text-muted text-decoration-none p-0",
                    ajax: true,
                    onClick: `$('#notify-${not.id}').remove()`,
                  }
                )
              )
            ),
            not.body && p(not.body),
            not.link && a({ href: not.link }, "Link"),
          ],
        }))
      : [
          {
            type: "card",
            contents: [h5(req.__("No notifications"))],
          },
        ];
    const pageLinks = div(
      { class: "d-flex mt-3 mb-3" },
      nots.length == 20
        ? div(
            after &&
              a(
                { href: `/notifications`, class: "me-2" },
                "&larr; " + req.__("Newest")
              ),
            a(
              { href: `/notifications?after=${nots[19].id}` },
              req.__("Older") + " &rarr;"
            )
          )
        : div(),
      nots.length > 0 &&
        div(
          { class: "ms-auto" },
          post_btn(
            `/notifications/delete/read`,
            req.__("Delete all read"),
            req.csrfToken(),
            {
              icon: "fas fa-trash",
              klass: "btn-sm btn-danger",
            }
          )
        )
    );
    res.sendWrap(req.__("Notifications"), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [{ text: req.__("Notifications") }],
        },
        {
          widths: [4, 8],
          breakpoint: "md",
          besides: [
            {
              type: "card",
              contents: [
                req.__("Receive notifications by:"),
                renderForm(form, req.csrfToken()),
              ],
            },
            { above: [...notifyCards, pageLinks] },
          ],
        },
      ],
    });
  })
);

router.get(
  "/count-unread",
  loggedIn,
  error_catcher(async (req, res) => {
    const num_unread = await Notification.count({
      user_id: req.user.id,
      read: false,
    });
    res.set("Cache-Control", "public, max-age=60"); // 1 minute
    res.json({ success: num_unread });
  })
);

router.post(
  "/settings",
  loggedIn,
  error_catcher(async (req, res) => {
    const user = await User.findOne({ id: req.user.id });
    const form = notificationSettingsForm();
    form.validate(req.body);
    const _attributes = { ...user._attributes, ...form.values };
    await user.update({ _attributes });
    res.json({ success: "ok" });
  })
);

router.post(
  "/delete/:idlike",
  loggedIn,
  error_catcher(async (req, res) => {
    const { idlike } = req.params;
    if (idlike == "read") {
      await Notification.deleteRead(req.user.id);
    } else {
      const id = +idlike;
      const notif = await Notification.findOne({ id });
      if (notif?.user_id == req.user?.id) await notif.delete();
    }
    if (req.xhr) res.json({ success: "ok" });
    else res.redirect("/notifications");
  })
);

router.get(
  "/manifest.json:opt_cache_bust?",
  error_catcher(async (req, res) => {
    const { pretty } = req.query;
    const state = getState();
    const manifest = {
      name: state.getConfig("site_name"),
      start_url: "/",
      display: state.getConfig("pwa_display", "browser"),
    };
    const site_logo = state.getConfig("site_logo_id");
    const pwa_icons = state.getConfig("pwa_icons");
    if (Array.isArray(pwa_icons) && pwa_icons.length > 0)
      manifest.icons = pwa_icons.map(({ image, size, maskable }) => ({
        src: `/files/serve/${image}`,
        type: File.nameToMimeType(site_logo),
        sizes: size ? `${size}x${size}` : "144x144",
        ...(maskable ? { purpose: "maskable" } : {}),
      }));
    else if (site_logo)
      manifest.icons = [
        {
          src: `/files/serve/${site_logo}`,
          type: File.nameToMimeType(site_logo),
          sizes: "144x144",
        },
      ];
    if (state.getConfig("pwa_set_colors", false)) {
      manifest.theme_color = state.getConfig("pwa_theme_color", "black");
      manifest.background_color = state.getConfig(
        "pwa_background_color",
        "red"
      );
    }
    if (!pretty) res.json(manifest);
    else {
      const prettyJson = JSON.stringify(manifest, null, 2);
      res.setHeader("Content-Type", "application/json");
      res.send(prettyJson);
    }
  })
);
