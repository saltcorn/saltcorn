const { getState } = require("@saltcorn/data/db/state");
const { get_base_url } = require("../routes/utils");
const send_reset_email = async (user, req) => {
  const token = await user.getNewResetToken();
  const base = get_base_url(req);
  const link = `${base}auth/reset?token=${token}&email=${encodeURIComponent(
    user.email
  )}`;
  console.log(link);
};

module.exports = { send_reset_email };
