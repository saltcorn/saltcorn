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
import { AuthorizationCode } from "simple-oauth2";
import type { Options as MailOpts } from "nodemailer/lib/mailer";

const emailMockReqRes = {
  req: {
    ...mockReqRes.req,
    generate_email: true,
    get_base_url: () => getState().getConfig("base_url"),
  },
  res: mockReqRes.res,
};

type MicosoftGraphTransporter = {
  sendMail: (mail: MailOpts) => Promise<any>;
};

const isMicrosoftGraph = () => {
  const smtpHost = getState().getConfig("smtp_host");
  const apiOption = getState().getConfig("smtp_api_option");
  return smtpHost === "outlook.office365.com" && apiOption === "Graph";
};

/**
 * @returns
 */
const getMailTransport = async (): Promise<
  Transporter | MicosoftGraphTransporter
> => {
  if (isMicrosoftGraph()) return getMicrosoftGraphTransport();
  else {
    const port = getState().getConfig("smtp_port");
    const secure = getState().getConfig("smtp_secure", port === 465);
    const smtp_allow_self_signed = getState().getConfig(
      "smtp_allow_self_signed",
      false
    );
    const username = getState().getConfig("smtp_username");
    const isOauth = getState().getConfig("smtp_auth_method") === "oauth2";

    const transportOptions: any = {
      host: getState().getConfig("smtp_host"),
      port,
      secure,
      auth: username
        ? {
            user: username,
            ...(!isOauth
              ? { pass: getState().getConfig("smtp_password") }
              : { type: "OAuth2", accessToken: await getTokenString() }),
          }
        : undefined,
    };
    if (smtp_allow_self_signed)
      transportOptions.tls = { rejectUnauthorized: false };
    return createTransport(transportOptions);
  }
};

const getMicrosoftGraphTransport = async () => {
  const tokenStr = await getTokenString();
  return {
    sendMail: async (mail: MailOpts) => {
      const graphMail = convertToGraphMail(mail);
      return await sendGraphMail(graphMail, tokenStr);
    },
  };
};

const convertToGraphMail = (mail: MailOpts) => {
  return {
    message: {
      subject: mail.subject,
      body: {
        contentType: mail.html ? "HTML" : "Text",
        content: mail.html ? mail.html : mail.text,
      },
      // semicolon separated list of to addresses
      toRecipients:
        typeof mail.to === "string"
          ? mail.to.split(/[,;]/).map((address: string) => ({
              emailAddress: {
                address,
              },
            }))
          : [],
      // semicolon separated list of cc addresses
      ccRecipients:
        typeof mail.cc === "string"
          ? mail.cc.split(/[,;]/).map((address: string) => ({
              emailAddress: {
                address,
              },
            }))
          : [],
      // semicolon separated list of bcc addresses
      bccRecipients:
        typeof mail.bcc === "string"
          ? mail.bcc.split(/[,;]/).map((address: string) => ({
              emailAddress: {
                address,
              },
            }))
          : [],
    },
    saveToSentItems: true,
  };
};

async function sendGraphMail(mail: any, tokenStr: string, retryCount = 0) {
  const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenStr}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mail),
  });
  if (response.ok) {
    return {
      success: true,
      status: response.status,
      message: "Email sent successfully",
      accepted: mail.message.toRecipients.map(
        (recipient: any) => recipient.emailAddress.address
      ),
    };
  } else {
    const error = await response.json();
    const errorCode = error.error?.code;
    if (errorCode === "ApplicationThrottled" && retryCount < 5) {
      const retryAfterHeader = response.headers.get("Retry-After");
      let waitTime = 0;
      if (retryAfterHeader) {
        waitTime = parseInt(retryAfterHeader, 10) * 1000;
        getState().log(
          5,
          `Graph API throttled. Using Retry-After header: ${waitTime}ms`
        );
      } else {
        waitTime = Math.pow(2, retryCount) * 1000;
        getState().log(`Graph API throttled. Backing off for ${waitTime}ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return sendGraphMail(mail, tokenStr, retryCount + 1);
    }
    throw new Error("Failed to send email: " + JSON.stringify(error));
  }
}

const viewToMjml = async (
  view: View,
  state: any,
  options: { locale?: string } = {}
) => {
  const reqRes = emailMockReqRes;
  if (options?.locale) {
    reqRes.req.getLocale = () => options.locale;
  }
  const result = await view.run(state, reqRes);
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
const viewToEmailHtml = async (
  view: View,
  state: any,
  options: { locale?: string } = {}
) => {
  const mjmlMarkup = await viewToMjml(view, state, options);
  const html = await mjml2html(mjmlMarkup, { minify: true });
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
  req?: any,
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
        await (await getMailTransport()).sendMail(email);
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
 * @param user user sending it, or { role_id: 100 }
 * @returns
 */
const loadAttachments = async (path: string, row: any, user: any) => {
  const _File = (await import("./file")).default;
  const _Table = (await import("./table")).default;
  const allowed = (file: File | null) => {
    const isAllowed =
      file &&
      (user.role_id <= file.min_role_read ||
        (user.id && user.id === file.user_id));
    if (file && !isAllowed) {
      getState().log(
        4,
        `Not authorized to attach file to email: ${file.location} role=${user.role_id}`
      );
    }
    return isAllowed;
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

const getOauth2Client = (
  {
    tokenUrl,
    authorizeUrl,
    clientId,
    clientSecret,
  }: {
    tokenUrl: string;
    authorizeUrl: string;
    clientId: string;
    clientSecret: string;
  } = {
    tokenUrl: getState().getConfig("smtp_token_url"),
    authorizeUrl: getState().getConfig("smtp_authorize_url"),
    clientId: getState().getConfig("smtp_client_id"),
    clientSecret: getState().getConfig("smtp_client_secret"),
  }
) => {
  const url = new URL(tokenUrl);
  const tokenHost = url.origin;
  const tokenPath = url.pathname;
  const authUrl = new URL(authorizeUrl);
  const authHost = authUrl.origin;
  const authPath = authUrl.pathname;
  return new AuthorizationCode({
    client: {
      id: clientId,
      secret: clientSecret,
    },
    auth: {
      tokenHost: tokenHost,
      tokenPath: tokenPath,
      authorizeHost: authHost,
      authorizePath: authPath,
    },
  });
};

const getTokenString = async () => {
  const tokenData = getState().getConfig("smtp_oauth_token_data");
  const client = getOauth2Client();
  let wrapped = client.createToken(tokenData);
  if (wrapped.expired()) {
    const refreshed = await wrapped.refresh();
    const newTokenData = { ...refreshed.token };
    if (!newTokenData.refresh_token && tokenData.refresh_token) {
      newTokenData.refresh_token = tokenData.refresh_token;
    }
    await getState().setConfig("smtp_oauth_token_data", newTokenData);
    wrapped = refreshed;
  }
  return wrapped.token.access_token as string;
};

export = {
  getMailTransport,
  send_verification_email,
  emailMockReqRes,
  viewToEmailHtml,
  viewToMjml,
  loadAttachments,
  getFileAggregations,
  mjml2html,
  getOauth2Client,
  getTokenString,
};
