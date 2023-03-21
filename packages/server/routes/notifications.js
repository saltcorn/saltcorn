/**
 * @category server
 * @module routes/notifications
 * @subcategory routes
 */

const Router = require("express-promise-router");
const { isAdmin, setTenant, error_catcher, loggedIn } = require("./utils.js");
const Notification = require("@saltcorn/data/models/notification");
const { div, a, i, text, h5, p } = require("@saltcorn/markup/tags");

const router = new Router();
module.exports = router;

router.get(
  "/",
  loggedIn,
  error_catcher(async (req, res) => {
    const nots = await Notification.find(
      { user_id: req.user.id },
      { orderBy: "id", orderDesc: true, limit: 20 }
    );
    await Notification.mark_as_read({
      id: { in: nots.filter((n) => !n.read).map((n) => n.id) },
    });
    const notifyCards = nots.length
      ? nots.map((not) => ({
          type: "card",
          contents: [
            h5(not.title),
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
    res.sendWrap(req.__("Notifications"), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [{ text: req.__("Notifications") }],
        },
        ...notifyCards,
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
    res.set("Cache-Control", "public, max-age=300"); //60*5
    res.json({ success: num_unread });
  })
);
