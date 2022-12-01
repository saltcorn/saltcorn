/**
 * @category saltcorn-data
 * @module models/email
 * @subcategory models
 */
import { createTransport, Transporter } from "nodemailer";
const { getState } = require("../db/state");
import tags from "@saltcorn/markup/tags";
import mjml from "@saltcorn/markup/mjml-tags";
const { link } = tags;
import View from "./view";
import { v4 as uuidv4 } from "uuid";
import User from "./user";
import mocks from "../tests/mocks";
import mjml2html from "mjml";
const { mockReqRes } = mocks;

const emailMockReqRes = {
  req: {
    ...mockReqRes.req,
    generate_email: true,
    get_base_url: () => getState().getConfig("base_url"),
  },
  res: mockReqRes.res,
};

/**
 * @returns
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

const viewToMjml = async (view: View, state: any) => {
  const result = await view.run(state, emailMockReqRes);
  const allStyles = result.styles.map((style: any) =>
    mjml.style(`
      .${style.className} {
        ${style.style}
      }
    `)
  );
  const bsCss = link({
    href: "https://stackpath.bootstrapcdn.com/bootswatch/4.5.0/flatly/bootstrap.min.css",
    rel: "stylesheet",
  });
  const faCss = link({
    href: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css",
    rel: "stylesheet",
  });
  const mjAttributes = mjml.attributes(
    mjml.section({ "padding-top": "0px", "padding-bottom": "0px" }),
    mjml.text({ "padding-top": "0px", "padding-bottom": "0px" })
  );
  return mjml.mjml(
    mjml.head(mjAttributes + mjml.raw(bsCss + faCss) + allStyles.join(" ")) +
      mjml.body(result.markup)
  );
};

/**
 * run the view and create email formatted html
 * @param view view to run
 * @param state state params for the view
 * @returns email formatted html
 */
const viewToEmailHtml = async (view: View, state: any) => {
  const mjmlMarkup = await viewToMjml(view, state);
  const html = mjml2html(mjmlMarkup, { minify: true });
  if (html.errors && html.errors.length > 0) {
    html.errors.forEach((e) => {
      //console.error("MJML error: ", e);
    });
  }
  return html.html;
};

/**
 * @param user
 * @param req
 * @param opts
 * @returns true, or an object with an error message
 */
const send_verification_email = async (
  user: User,
  req: any,
  opts?: { new_verification_token?: string }
): Promise<boolean | any> => {
  const verification_view_name = getState().getConfig("verification_view");
  if (verification_view_name) {
    const verification_view = await View.findOne({
      name: verification_view_name,
    });
    if (verification_view) {
      const verification_token = opts?.new_verification_token || uuidv4();
      try {
        await user.update({ verification_token });
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
  viewToMjml,
};
