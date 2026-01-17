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
const Trigger = require("@saltcorn/data/models/trigger");
const Table = require("@saltcorn/data/models/table");
const { renderForm, post_btn } = require("@saltcorn/markup");
const db = require("@saltcorn/data/db");

const router = new Router();
module.exports = router;

router.use(
  error_catcher(async (req, res, next) => {
    const state = getState();
    const maintenanceModeEnabled = state.getConfig(
      "maintenance_mode_enabled",
      false
    );
    if (maintenanceModeEnabled && (!req.user || req.user.role_id > 1)) {
      res.status(503).send("Page Unavailable: in maintenance mode");
      return;
    }
    next();
  })
);

const notificationSettingsForm = (user) => {
  const fields = [{ name: "notify_email", label: "Email", type: "Bool" }];
  if (getState().getConfig("enable_push_notify", false)) {
    const policyByRole = getState()?.getConfig("push_policy_by_role") || {};
    const pushPolicy = policyByRole[user?.role_id || 100] || "Default on";
    if (!["Always", "Never"].includes(pushPolicy)) {
      fields.push({
        name: "notify_push",
        label: "Push",
        type: "Bool",
      });
    }
  }

  return new Form({
    action: `/notifications/settings`,
    noSubmitButton: true,
    onChange: `saveAndContinue(this)`,
    labelCols: 4,
    fields,
  });
};

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

    const form = notificationSettingsForm(req.user);
    const user = await User.findOne({ id: req.user?.id });
    form.values = {
      notify_email: user?._attributes?.notify_email,
    };

    if (getState().getConfig("enable_push_notify", false)) {
      let notifPushAttr = user?._attributes?.notify_push;
      if (notifPushAttr === undefined) {
        const policyByRole = getState()?.getConfig("push_policy_by_role") || {};
        const pushPolicy = policyByRole[user.role_id || 100] || "Default on";
        if (pushPolicy === "Default on") notifPushAttr = true;
        else if (pushPolicy === "Default off") notifPushAttr = false;
      }
      form.values.notify_push = notifPushAttr;
    }

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
    const form = notificationSettingsForm(req.user);
    form.validate(req.body || {});
    const _attributes = { ...user._attributes, ...form.values };

    // apply push enabled policy if needed
    if (getState().getConfig("enable_push_notify", false)) {
      const policyByRole = getState()?.getConfig("push_policy_by_role") || {};
      const pushPolicy = policyByRole[user.role_id || 100] || "Default on";
      if (pushPolicy === "Always") _attributes.notify_push = true;
      else if (pushPolicy === "Never") _attributes.notify_push = false;
      else if (_attributes.notify_push === undefined) {
        _attributes.notify_push = pushPolicy === "Default on";
      }
    }

    await user.update({ _attributes });
    const pushEnabled = _attributes.notify_push;
    const allSubs = getState().getConfig("push_notification_subscriptions", {});
    const newSubs = { ...allSubs };
    if (!pushEnabled && newSubs[req.user.id]) {
      delete newSubs[req.user.id];
      await getState().setConfig("push_notification_subscriptions", newSubs);
    } else if (pushEnabled && !newSubs[req.user.id]) {
      newSubs[req.user.id] = [];
      await getState().setConfig("push_notification_subscriptions", newSubs);
    }
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

router.post(
  "/share-handler",
  error_catcher(async (req, res) => {
    const role = req.user?.role_id || 100;
    if (role === 100) {
      const msg = req.__("You must be logged in to share");
      if (!req.smr) {
        req.flash("error", msg);
        res.redirect("/auth/login");
      } else res.json({ error: msg });
    } else {
      const receiveShareTriggers = Trigger.find({
        when_trigger: "ReceiveMobileShareData",
      });
      if (receiveShareTriggers.length === 0) {
        const msg = req.__("Sharing not enabled");
        if (!req.smr) {
          req.flash("error", msg);
          res.redirect("/");
        } else res.json({ error: msg });
      } else {
        Trigger.emitEvent("ReceiveMobileShareData", null, req.user, {
          row: req.body || {},
        });
        if (!req.smr) {
          req.flash(
            "success",
            req.__(
              "Shared: %s",
              (req.body || {}).title ||
                (req.body || {}).text ||
                (req.body || {}).url ||
                ""
            )
          );
          res.status(303).redirect("/");
        } else res.json({ success: "ok" });
      }
    }
  })
);

router.post(
  "/subscribe",
  loggedIn,
  error_catcher(async (req, res) => {
    const enabled = getState().getConfig("enable_push_notify", false);
    if (!enabled) {
      res.status(403).json({
        error: req.__("Notifications are not enabled on this server"),
      });
    } else {
      const user = req.user;
      const allSubs = getState().getConfig(
        "push_notification_subscriptions",
        {}
      );
      const userSubs = allSubs[user.id] || [];
      const existingSub = userSubs.find(
        (s) =>
          s.endpoint === req.body.endpoint &&
          s.keys.p256dh === req.body.keys.p256dh &&
          s.keys.auth === req.body.keys.auth
      );
      if (existingSub) {
        res.json({
          success: "ok",
          message: req.__("Already subscribed to notifications"),
        });
      } else {
        userSubs.push({
          type: "web-push",
          endpoint: req.body.endpoint,
          keys: {
            auth: req.body.keys.auth,
            p256dh: req.body.keys.p256dh,
          },
        });
        await getState().setConfig("push_notification_subscriptions", {
          ...allSubs,
          [user.id]: userSubs,
        });
        res.json({
          success: "ok",
          message: req.__("Subscribed to notifications"),
        });
      }
    }
  })
);

router.post(
  "/mobile-subscribe",
  loggedIn,
  error_catcher(async (req, res) => {
    const { token, deviceId, platform } = req.body || {};
    if (!token) {
      res.status(400).json({
        error: req.__("FCM token is required"),
      });
      return;
    }
    const user = req.user;
    const allSubs = getState().getConfig("push_notification_subscriptions", {});
    let userSubs = allSubs[user.id] || [];
    const existingSub = userSubs.find(
      (s) =>
        s.type === "fcm-push" && s.token === token && s.deviceId === deviceId
    );
    if (existingSub) {
      res.json({
        success: "ok",
        message: req.__("FCM token already uploaded"),
      });
    } else {
      // web based subscriptions and other device subscriptions for this user
      userSubs = userSubs.filter(
        (s) =>
          (s.type !== "fcm-push" && s.type !== "apns-push") ||
          s.deviceId !== deviceId
      );
      userSubs.push({
        type: platform === "android" ? "fcm-push" : "apns-push",
        token: token,
        deviceId: deviceId,
      });
      await getState().setConfig("push_notification_subscriptions", {
        ...allSubs,
        [user.id]: userSubs,
      });
      res.json({
        success: "ok",
        message: req.__("FCM token uploaded"),
      });
    }
  })
);

router.post(
  "/remove-subscription",
  loggedIn,
  error_catcher(async (req, res) => {
    const enabled = getState().getConfig("enable_push_notify", false);
    if (!enabled) {
      res.status(403).json({
        error: req.__("Notifications are not enabled on this server"),
      });
    } else {
      const { subscription } = req.body;
      const user = req.user;
      const oldSubs = getState().getConfig(
        "push_notification_subscriptions",
        {}
      );
      let userSubs = oldSubs[user.id];
      if (userSubs) {
        userSubs = userSubs.filter(
          (s) =>
            s.endpoint !== subscription.endpoint ||
            s.keys.p256dh !== subscription.keys.p256dh ||
            s.keys.auth !== subscription.keys.auth
        );
        await getState().setConfig("push_notification_subscriptions", {
          ...oldSubs,
          [user.id]: userSubs,
        });
      }
      res.json({
        success: "ok",
        message: req.__("Unsubscribed from notifications"),
      });
    }
  })
);

router.post(
  "/mobile-remove-subscription",
  loggedIn,
  error_catcher(async (req, res) => {
    const { token, deviceId } = req.body || {};
    if (!token) {
      res.status(400).json({
        error: req.__("FCM token is required"),
      });
      return;
    }
    const user = req.user;
    const oldSubs = getState().getConfig("push_notification_subscriptions", {});
    let userSubs = oldSubs[user.id];
    if (userSubs) {
      userSubs = userSubs.filter(
        (s) => s.type !== "fcm-push" || s.deviceId !== deviceId
      );
      await getState().setConfig("push_notification_subscriptions", {
        ...oldSubs,
        [user.id]: userSubs,
      });
      res.json({
        success: "ok",
        message: req.__("Unsubscribed from notifications"),
      });
    }
  })
);

router.post(
  "/generate-vapid-keys",
  isAdmin,
  error_catcher(async (req, res) => {
    const enabled = getState().getConfig("enable_push_notify", false);
    if (!enabled) {
      res.status(403).json({
        error: req.__("Notifications are not enabled on this server"),
      });
    } else {
      const webPush = require("web-push");
      const vapidKeys = webPush.generateVAPIDKeys();
      await getState().setConfig("vapid_public_key", vapidKeys.publicKey);
      await getState().setConfig("vapid_private_key", vapidKeys.privateKey);
      const allSubs = getState().setConfig(
        "push_notification_subscriptions",
        {}
      );
      const newSubs = {};
      for (const k of Object.keys(allSubs)) {
        newSubs[k] = [];
      }
      await getState().setConfig("push_notification_subscriptions", newSubs);
      res.json({
        success: "ok",
      });
    }
  })
);

router.get(
  "/manifest.json{:opt_cache_bust}",
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
    const receiveShareTriggers = Trigger.find({
      when_trigger: "ReceiveMobileShareData",
    });
    if (receiveShareTriggers.length > 0) {
      manifest.share_target = {
        action: "/notifications/share-handler",
        method: "POST",
        enctype: "multipart/form-data",
        params: {
          title: "title",
          text: "text",
          url: "url",
        },
      };
    }
    if (Array.isArray(pwa_icons) && pwa_icons.length > 0)
      manifest.icons = pwa_icons.map(({ image, size, maskable }) => ({
        src: /^(?:[a-z]+:)?\/\//i.test(image) ? image : `/files/serve/${image}`,
        type: File.nameToMimeType(image),
        sizes: size ? `${size}x${size}` : "144x144",
        ...(maskable ? { purpose: "maskable" } : {}),
      }));
    else if (site_logo)
      manifest.icons = [
        {
          src: /^(?:[a-z]+:)?\/\//i.test(site_logo)
            ? site_logo
            : `/files/serve/${site_logo}`,
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
