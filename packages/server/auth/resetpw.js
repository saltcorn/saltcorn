const { getState } = require("@saltcorn/data/db/state");
const { getMailTransport } = require("@saltcorn/data/models/config");
const { get_base_url } = require("../routes/utils");

const generate_email = (link, user, req) => ({
  from: getState().getConfig("email_from"),
  to: user.email,
  subject: req.__("Reset password instructions"),
  text: `${req.__("Hi %s", user.email)},

${req.__(
  "You have requested a link to change your password. You can do this through this link:"
)}

${link}

${req.__("If you did not request this, please ignore this email.")}

${req.__(
  "Your password will not change until you access the link above and set a new one."
)}
`,
  html: `${req.__("Hi %s", user.email)},<br />
    
  ${req.__(
    "You have requested a link to change your password. You can do this through this link:"
  )}<br />
<br />
<a href="${link}">${req.__("Change my password")}</a><br />
<br />
${req.__("If you did not request this, please ignore this email.")}<br />
<br />
${req.__(
  "Your password will not change until you access the link above and set a new one."
)}<br />
`,
});
const send_reset_email = async (user, req) => {
  const link = await get_reset_link(user, req);
  const transporter = getMailTransport();
  await transporter.sendMail(generate_email(link, user, req));
};

const get_reset_link = async (user, req) => {
  const token = await user.getNewResetToken();
  const base = get_base_url(req);
  return `${base}auth/reset?token=${token}&email=${encodeURIComponent(
    user.email
  )}`;
};

module.exports = { send_reset_email, get_reset_link, generate_email };
