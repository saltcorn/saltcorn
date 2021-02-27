const nodemailer = require("nodemailer");
const { getState } = require("../db/state");
const BootstrapEmail = require("bootstrap-email");
const tmp = require("tmp-promise");
const fs = require("fs").promises;
const { div } = require("@saltcorn/markup/tags");
const View = require("./view");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { mockReqRes } = require("../tests/mocks");

const getMailTransport = () => {
  const port = getState().getConfig("smtp_port");
  const secure = getState().getConfig("smtp_secure", port === 465);
  return nodemailer.createTransport({
    host: getState().getConfig("smtp_host"),
    port,
    secure,
    auth: {
      user: getState().getConfig("smtp_username"),
      pass: getState().getConfig("smtp_password"),
    },
  });
};

const transformBootstrapEmail = async (bsHtml) => {
  const filename = await tmp.tmpName();
  await fs.writeFile(filename, div({ class: "container" }, bsHtml));

  const template = new BootstrapEmail(filename);
  const email = template.compile();
  await fs.unlink(filename);
  return email;
};

const send_verification_email = async (user, req) => {
  const verification_view_name = getState().getConfig("verification_view");
  if (verification_view_name) {
    const verification_view = await View.findOne({
      name: verification_view_name,
    });
    if (verification_view) {
      const verification_token = uuidv4();
      try {
        await db.update("users", { verification_token }, user.id);
        user.verification_token = verification_token;
        const htmlBs = await verification_view.run({ id: user.id }, mockReqRes);
        const html = await transformBootstrapEmail(htmlBs);
        const email = {
          from: getState().getConfig("email_from"),
          to: user.email,
          subject: "Please verify your email address",
          html,
        };
        await getMailTransport().sendMail(email);
        if (req)
          req.flash(
            "success",
            req.__("An email has been sent to %s to verify your address", user.email)
          );
        return true;
      } catch (e) {
        return { error: e.message };
      }
    } else return { error: "Verification form specified but not found" };
  } else {
    return { error: "Verification form not specified" };
  }
};

module.exports = {
  getMailTransport,
  transformBootstrapEmail,
  send_verification_email,
};
