const nodemailer = require("nodemailer");
const { getState } = require("../db/state");
const BootstrapEmail = require("bootstrap-email");
const tmp = require("tmp-promise");
const fs = require("fs").promises;
const { div } = require("@saltcorn/markup/tags");

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

module.exports = {
  getMailTransport,
  transformBootstrapEmail,
};
