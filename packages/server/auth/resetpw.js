/**
 * @category server
 * @module auth/resetpw
 * @subcategory auth
 */
const { getState } = require("@saltcorn/data/db/state");
const {
  getMailTransport,
  viewToEmailHtml,
} = require("@saltcorn/data/models/email");
const { get_base_url } = require("../routes/utils");
const View = require("@saltcorn/data/models/view");

/**
 * @param {string} link
 * @param {object} user
 * @param {object} req
 * @returns {void}
 */
const generate_email = (link, user, req, options) => {
  const subject = options?.creating
    ? req.__(`Welcome to %s`, getState().getConfig("site_name", "Saltcorn"))
    : req.__("Reset password instructions");
  const initial = options?.creating
    ? req.__(
        "We have created an account for you on %s. You can set your new password through this link: ",
        getState().getConfig("site_name", "Saltcorn")
      )
    : options?.from_admin
      ? req.__(
          "We request that you change your password on %s. You can set your new password through this link: ",
          getState().getConfig("site_name", "Saltcorn")
        )
      : req.__(
          "You have requested a link to change your password. You can do this through this link:"
        );
  const base_url = getState().getConfig("base_url", "");
  const final =
    options?.creating && base_url
      ? req.__(
          "Use this link to access the application once you have set your password: %s",
          `<a href="${base_url}">${base_url}</a>`
        )
      : "";
  const finalTxt =
    options?.creating && base_url
      ? req.__(
          "Use this link to access the application once you have set your password: %s",
          base_url
        )
      : "";
  return {
    from: getState().getConfig("email_from"),
    to: user.email,
    subject,
    text: `${req.__("Hi %s", user.email)},

${initial}

${link}

${
  !options?.creating && !options?.from_admin
    ? req.__("If you did not request this, please ignore this email.") + "\n"
    : ""
}
${req.__(
  "Your password will not change until you access the link above and set a new one."
)}

${finalTxt}
`,
    html: `${req.__("Hi %s", user.email)},<br /><br />    
  ${initial}<br />
<br />
<a href="${link}">${req.__("Change my password")}</a><br />
<br />
${
  !options?.creating && !options?.from_admin
    ? req.__("If you did not request this, please ignore this email.") +
      "<br />"
    : ""
}
<br />
${req.__(
  "Your password will not change until you access the link above and set a new one."
)}<br />
${final ? `<br />${final}<br />` : ""}
`,
  };
};

/**
 * @param {object} user
 * @param {object} req
 * @returns {Promise<void>}
 */
const send_reset_email = async (user, req, options = {}) => {
  const link = await get_reset_link(user, req);
  const transporter = getMailTransport();
  const reset_password_email_view_name = getState().getConfig(
    "reset_password_email_view",
    false
  );
  let email;
  if (reset_password_email_view_name) {
    const reset_password_email_view = await View.findOne({
      name: reset_password_email_view_name,
    });
    if (reset_password_email_view) {
      const html = await viewToEmailHtml(reset_password_email_view, {
        id: user.id,
      });
      email = {
        from: getState().getConfig("email_from"),
        to: user.email,
        subject:
          reset_password_email_view.attributes?.page_title ||
          `${req.__("Hi %s", user.email)}`,
        html,
      };
    }
  }
  if (!email) email = generate_email(link, user, req, options);
  await transporter.sendMail(email);
};

/**
 * @param {object} user
 * @param {object} req
 * @returns {Promise<string>}
 */
const get_reset_link = async (user, req) => {
  const token = await user.getNewResetToken();
  const base = get_base_url(req);
  return `${base}auth/reset?token=${token}&email=${encodeURIComponent(
    user.email
  )}`;
};

module.exports = { send_reset_email, get_reset_link, generate_email };
