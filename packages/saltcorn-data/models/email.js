const nodemailer = require("nodemailer");
const { getState } = require("../db/state");

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
module.exports = {
  getMailTransport,
};
