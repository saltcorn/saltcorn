/**
 * @category saltcorn-data
 * @module models/email
 * @subcategory models
 */
import { createTransport, Transporter } from "nodemailer";
const { getState } = require("../db/state");
const BootstrapEmail = require("bootstrap-email_with-node-sass-6"); // no typings available
import { tmpName } from "tmp-promise";
import { writeFile, unlink } from "fs/promises";
import tags from "@saltcorn/markup/tags";
const { div } = tags;
import View from "./view";
import { v4 as uuidv4 } from "uuid";
import db from "../db/index";
import User from "./user";
import mocks from "../tests/mocks";
const { mockReqRes } = mocks;

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

/**
 * @param {string} bsHtml
 * @param {boolean} [container=true] wrap in a container div (used by unit test)
 * @returns {Promise<string>}
 */
const transformBootstrapEmail = async (
  bsHtml: string,
  container: boolean = true
): Promise<string> => {
  const filename = await tmpName();
  const html = container ? div({ class: "container" }, bsHtml) : bsHtml;
  await writeFile(filename, html);

  const template = new BootstrapEmail(filename);
  const email = template.compile();
  await unlink(filename);
  return email;
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
  transformBootstrapEmail,
  send_verification_email,
};
