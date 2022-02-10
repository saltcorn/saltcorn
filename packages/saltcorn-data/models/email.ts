/**
 * @category saltcorn-data
 * @module models/email
 * @subcategory models
 */
import { createTransport, Transporter } from "nodemailer";
const { getState } = require("../db/state");
import tags from "@saltcorn/markup/tags";
import mjml from "@saltcorn/markup/mjml-tags";
const { div } = tags;
import View from "./view";
import { v4 as uuidv4 } from "uuid";
import db from "../db/index";
import User from "./user";
import mocks from "../tests/mocks";
import mjml2html from "mjml";
const { mockReqRes } = mocks;

const emailMockReqRes = {
  req: {
    ...mockReqRes.req,
    generate_email: true,
  },
  res: mockReqRes.res,
};

/**
 * @returns {Transporter}
 */
const getMailTransport = (): Transporter => {
  const port = getState().getConfig("smtp_port");
  const secure = getState().getConfig("smtp_secure", port === 465);
  return createTransport({
    host: getState().getConfig("smtp_host"),
    port,
    secure,
    auth: {
      user: getState().getConfig("smtp_username"),
      pass: getState().getConfig("smtp_password"),
    },
  });
};
const viewToEmailHtml = async (view: any, state: any) => {
  const htmlBs = await view.run(state, emailMockReqRes);
  const html = await mjml2html(mjml.mjml(mjml.body(htmlBs)), {});
  return html.html;
};

/**
 * @param {object} user
 * @param {object} [req]
 * @returns {Promise<object>}
 */
const send_verification_email = async (
  user: User,
  req: any
): Promise<boolean | any> => {
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

        const html = await viewToEmailHtml(verification_view, { id: user.id });
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
            req.__(
              "An email has been sent to %s to verify your address",
              user.email
            )
          );
        return true;
      } catch (e: any) {
        return { error: e.message };
      }
    } else return { error: "Verification form specified but not found" };
  } else {
    return { error: "Verification form not specified" };
  }
};

export = {
  getMailTransport,
  send_verification_email,
  emailMockReqRes,
  viewToEmailHtml,
};
