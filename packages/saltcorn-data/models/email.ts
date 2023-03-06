import { createTransport, Transporter } from "nodemailer";
const { getState } = require("../db/state");
import tags from "@saltcorn/markup/tags";
import mjml from "@saltcorn/markup/mjml-tags";
const { link } = tags;
import View from "./view";
import type Table from "./table";
import type File from "./file";
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
  const faCss = link({
    href: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css",
    rel: "stylesheet",
  });
  const mjAttributes = mjml.attributes(
    mjml.section({ "padding-top": "0px", "padding-bottom": "0px" }),
    mjml.text({ "padding-top": "0px", "padding-bottom": "0px" })
  );
  const bodyCfg: any = {};
  if (result.backgroundColor)
    bodyCfg["background-color"] = result.backgroundColor;
  return mjml.mjml(
    mjml.head(mjAttributes + mjml.raw(faCss)) +
      mjml.body(bodyCfg, result.markup)
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

/*
 * internal helper to split 'table.fkey->field' relation
 */
const parseRelationPath = (path: string) => {
  const keyPath = path.split(".");
  const relTable = keyPath[0];
  const help = keyPath[1].split("->");
  const keyField = help[0];
  const relField = help[1];
  return {
    relTable,
    keyField,
    relField,
  };
};

/**
 * prepare an attachements array that can be used with nodemailer
 * @param path path to a field or an aggregation relation
 * @param row row for which the email should be send
 * @param user user sending it, or { role_id: 10 }
 * @returns
 */
const loadAttachments = async (path: string, row: any, user: any) => {
  const _File = (await import("./file")).default;
  const _Table = (await import("./table")).default;
  const allowed = (file: File | null) => {
    return (
      file &&
      (user.role_id <= file.min_role_read ||
        (user.id && user.id === file.user_id))
    );
  };
  const result = [];
  if (path?.indexOf(".") >= 0) {
    const { relTable, keyField, relField } = parseRelationPath(path);
    const relTbl = _Table.findOne({ name: relTable });
    if (!relTbl) return [];
    const relRows = await relTbl.getRows({ [keyField]: row.id });
    for (const row of relRows) {
      if (row[relField]) {
        const file = await _File.findOne(row[relField]);
        if (allowed(file)) result.push({ path: file!.location });
      }
    }
  } else if (row[path]) {
    const file = await _File.findOne(row[path]);
    if (allowed(file)) result.push({ path: file!.location });
  }
  return result;
};

/**
 * look at aggreation relations pointing at 'table' and return File fields
 * @param table
 * @returns
 */
const getFileAggregations = async (table: Table) => {
  const aggRels = await table.get_relation_data(false);
  const result = [];
  for (const { relationTable, relationField } of aggRels) {
    for (const field of relationTable.getFields()) {
      if (field.type === "File")
        result.push(
          `${relationTable.name}.${relationField.name}->${field.name}`
        );
    }
  }
  return result;
};

export = {
  getMailTransport,
  send_verification_email,
  emailMockReqRes,
  viewToEmailHtml,
  viewToMjml,
  loadAttachments,
  getFileAggregations,
};
