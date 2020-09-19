const { getState } = require("@saltcorn/data/db/state");
const { get_base_url } = require("../routes/utils");

const send_reset_email = async (user, req) => {
  const link = await get_reset_link(user, req);
  console.log(link);
};

const get_reset_link = async (user, req) => {
  const token = await user.getNewResetToken();
  const base = get_base_url(req);
  return `${base}auth/reset?token=${token}&email=${encodeURIComponent(
    user.email
  )}`;
};

module.exports = { send_reset_email };
