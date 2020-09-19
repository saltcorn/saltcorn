const { getState } = require("@saltcorn/data/db/state");
const { get_base_url } = require("../routes/utils");
const nodemailer = require("nodemailer");

const { port, secure } = (() => {
  const port = getState().getConfig("smtp_port");
  const secure = getState().getConfig("smtp_secure", port === 465);
  return { port, secure };
})();

const send_reset_email = async (user, req) => {
  const link = await get_reset_link(user, req);
  const transporter = nodemailer.createTransport({
    host: getState().getConfig("smtp_host"),
    port,
    secure,
    auth: {
      user: getState().getConfig("smtp_username"),
      pass: getState().getConfig("smtp_password"),
    },
  });
  let info = await transporter.sendMail({
    from: getState().getConfig("email_from"), // sender address
    to: user.email, // list of receivers
    subject: "Reset password instructions", // Subject line
    text: `Hi ${user.email},

You have requested a link to change your password. You can do this through this link:

${link}

If you did not request this, please ignore this email.

Your password will not change until you access the link above and set a new one.
`,
    html: `Hi ${user.email},<br />
    
You have requested a link to change your password. You can do this through this link:<br />
<br />
<a href="${link}">Change my password</a><br />
<br />
If you did not request this, please ignore this email.<br />
<br />
Your password will not change until you access the link above and set a new one.<br />
`,
  });
  console.log(link, info);
};

const get_reset_link = async (user, req) => {
  const token = await user.getNewResetToken();
  const base = get_base_url(req);
  return `${base}auth/reset?token=${token}&email=${encodeURIComponent(
    user.email
  )}`;
};

module.exports = { send_reset_email };
