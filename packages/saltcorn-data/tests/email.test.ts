/*
  This test is based on the commented out 'BootstrapEmail.spec.js' test
  from 'bootstrap-email'.
 */

import { writeFileSync } from "fs";
import email from "../models/email";
import { describe, it, expect, jest } from "@jest/globals";
import View from "../models/view";
import Table from "../models/table";
import User from "../models/user";
import { createTransport } from "nodemailer";
import mocks from "./mocks";
const { mockReqRes } = mocks;
const { getState } = require("../db/state");
const db = require("../db");

function removeBreaks(str: string): string {
  return str.replace(/(\r\n|\r|\n)/gm, "").toLowerCase();
}

const trimLines = (s: string) =>
  s
    .split("\n")
    .map((s: string) => s.trim())
    .join("\n");

beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

jest.mock("nodemailer");

jest.setTimeout(60 * 1000);

describe("getMailTransport", () => {
  it("returns Transporter", async () => {
    let sentEmail;
    // @ts-ignore
    createTransport.mockReturnValue({
      sendMail: (email: any) => {
        sentEmail = email;
        return;
      },
    });
    const mailTransport = email.getMailTransport();
    mailTransport.sendMail({
      from: "me",
      to: "you",
      subject: "us",
      html: "<div>Hello World</div>",
    });
    expect(createTransport).toHaveBeenCalledTimes(1);
    // @ts-ignore
    expect(sentEmail?.from).toBe("me");
  });
});

describe("send_verification_email", () => {
  it("returns Transporter", async () => {
    let sentEmail;
    // @ts-ignore
    createTransport.mockReturnValue({
      sendMail: (email: any) => {
        sentEmail = email;
        return;
      },
    });
    await View.create({
      name: "verifyview",
      viewtemplate: "Show",
      table_id: 1,
      configuration: {
        layout: {
          above: [
            {
              style: {
                "margin-bottom": "1.5rem",
              },
              widths: [2, 10],
              besides: [
                {
                  type: "blank",
                  contents: "Email",
                  isFormula: {},
                },
                {
                  type: "field",
                  fieldview: "as_text",
                  field_name: "email",
                },
              ],
            },
            {
              style: {
                "margin-bottom": "1.5rem",
              },
              widths: [2, 10],
              besides: [
                {
                  type: "blank",
                  contents: "Click to verify",
                  isFormula: {},
                },
                {
                  type: "field",
                  fieldview: "as_text",
                  field_name: "verification_url",
                },
              ],
            },
          ],
        },
        columns: [
          {
            type: "Field",
            fieldview: "as_text",
            field_name: "email",
          },
          {
            type: "Field",
            fieldview: "as_text",
            field_name: "verification_url",
          },
        ],
      },
      min_role: 10,
    });
    await getState().setConfig("verification_view", "verifyview");
    const user = await User.findOne({ id: 1 });
    await email.send_verification_email(
      user as User,
      mockReqRes.req,
      "newsecrettoken"
    );
    // @ts-ignore
    expect(trimLines(sentEmail?.html)).toBe(
      trimLines(`<!doctype html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><title></title><!--[if !mso]><!--><meta http-equiv="X-UA-Compatible" content="IE=edge"><!--<![endif]--><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style type="text/css">#outlook a { padding:0; }
    body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
    table, td { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
    img { border:0;height:auto;line-height:100%; outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
    p { display:block;margin:13px 0; }</style><!--[if mso]>
  <noscript>
  <xml>
  <o:OfficeDocumentSettings>
    <o:AllowPNG/>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings>
  </xml>
  </noscript>
  <![endif]--><!--[if lte mso 11]>
  <style type="text/css">
    .mj-outlook-group-fix { width:100% !important; }
  </style>
  <![endif]--><!--[if !mso]><!--><link href="https://fonts.googleapis.com/css?family=Ubuntu:300,400,500,700" rel="stylesheet" type="text/css"><style type="text/css">@import url(https://fonts.googleapis.com/css?family=Ubuntu:300,400,500,700);</style><!--<![endif]--><style type="text/css"></style><style type="text/css"></style></head><body style="word-spacing:normal;"><div><div style="font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:13px;line-height:1;text-align:left;color:#000000;"><mj-section style="margin-bottom:1.5rem"><mj-column width="17%"><mj-text>Email</mj-text></mj-column><mj-column width="83%"><mj-text>admin@foo.com</mj-text></mj-column></mj-section></div><div style="font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:13px;line-height:1;text-align:left;color:#000000;"><mj-section style="margin-bottom:1.5rem"><mj-column width="17%"><mj-text>Click to verify</mj-text></mj-column><mj-column width="83%"><mj-text>/auth/verify?token=newsecrettoken&amp;email=admin%40foo.com</mj-text></mj-column></mj-section></div></div></body></html>`)
    );
  });
});

describe("MJML Mail Transformations", () => {
  it("transform simple to mjml", async () => {
    const v = await View.findOne({ name: "authorshow" });
    const ml = await email.viewToMjml(v, { id: 1 });
    expect(ml).toBe(
      `<mjml><mj-body><mj-text>Herman Melville</mj-text></mj-body></mjml>`
    );
  });
  it("transform simple to html", async () => {
    const v = await View.findOne({ name: "authorshow" });
    const html = await email.viewToEmailHtml(v, { id: 1 });
    //writeFileSync("emailout1", trimLines(html));
    expect(trimLines(html)).toBe(
      trimLines(`<!doctype html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><title></title><!--[if !mso]><!--><meta http-equiv="X-UA-Compatible" content="IE=edge"><!--<![endif]--><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style type="text/css">#outlook a { padding:0; }
      body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
      table, td { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
      img { border:0;height:auto;line-height:100%; outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
      p { display:block;margin:13px 0; }</style><!--[if mso]>
      <noscript>
      <xml>
      <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
      </xml>
      </noscript>
      <![endif]--><!--[if lte mso 11]>
      <style type="text/css">
      .mj-outlook-group-fix { width:100% !important; }
      </style>
      <![endif]--><!--[if !mso]><!--><link href="https://fonts.googleapis.com/css?family=Ubuntu:300,400,500,700" rel="stylesheet" type="text/css"><style type="text/css">@import url(https://fonts.googleapis.com/css?family=Ubuntu:300,400,500,700);</style><!--<![endif]--><style type="text/css"></style><style type="text/css"></style></head><body style="word-spacing:normal;"><div><div style="font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:13px;line-height:1;text-align:left;color:#000000;">Herman Melville</div></div></body></html>`)
    );
  });
  it("transform complex to html", async () => {
    const v = await mkView({
      name: "emailview1",
      layout: {
        widths: [6, 6],
        besides: [
          {
            above: [
              null,
              {
                type: "card",
                contents: {
                  type: "view_link",
                  view: "Own:authorshow",
                  minRole: 10,
                  in_modal: true,
                  view_label: "foo it",
                },
                isFormula: {},
              },
            ],
          },
          {
            type: "container",
            bgType: "Color",
            hAlign: "left",
            vAlign: "top",
            bgColor: "#a9a7a7",
            bgFileId: 1,
            contents: {
              url: "'https://countto.com/'+pages",
              text: "author",
              type: "link",
              isFormula: { url: true, text: true },
            },
            imageSize: "contain",
            minHeight: "100",
            textColor: "#ffffff",
            borderStyle: "solid",
            borderWidth: "1",
          },
        ],
      },
      columns: [
        {
          type: "ViewLink",
          view: "Own:authorshow",
          minRole: 10,
          in_modal: true,
        },
      ],
    });
    const html = await email.viewToEmailHtml(v, { id: 1 });
    //writeFileSync("emailout2", html);
    expect(trimLines(html)).toBe(
      trimLines(`<!doctype html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><title></title><!--[if !mso]><!--><meta http-equiv="X-UA-Compatible" content="IE=edge"><!--<![endif]--><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style type="text/css">#outlook a { padding:0; }
      body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
      table, td { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
      img { border:0;height:auto;line-height:100%; outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
      p { display:block;margin:13px 0; }</style><!--[if mso]>
    <noscript>
    <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
    </xml>
    </noscript>
    <![endif]--><!--[if lte mso 11]>
    <style type="text/css">
      .mj-outlook-group-fix { width:100% !important; }
    </style>
    <![endif]--><style type="text/css">@media only screen and (min-width:480px) {
        .mj-column-per-50 { width:50% !important; max-width: 50%; }
      }</style><style media="screen and (min-width:480px)">.moz-text-html .mj-column-per-50 { width:50% !important; max-width: 50%; }</style><style type="text/css"></style><style type="text/css"></style></head><body style="word-spacing:normal;"><div><!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" class="" role="presentation" style="width:600px;" width="600" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]--><div style="margin:0px auto;max-width:600px;"><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;"><tbody><tr><td style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;"><!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:300px;" ><![endif]--><div class="mj-column-per-50 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"><table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"><tbody></tbody></table></div><!--[if mso | IE]></td><td class="" style="vertical-align:top;width:300px;" ><![endif]--><div class="mj-column-per-50 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"><table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"><tbody><tr><td style="font-size:0px;padding:20px 0;word-break:break-word;"><!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" class="" role="presentation" style="width:300px;" width="300" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]--><div style="margin:0px auto;max-width:300px;"><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;"><tbody><tr><td style="direction:ltr;font-size:0px;padding:20px 0;text-align:center;"><!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><![endif]--> <a href="https://countto.com/967">Herman Melville</a><!--[if mso | IE]></tr></table><![endif]--></td></tr></tbody></table></div><!--[if mso | IE]></td></tr></table><![endif]--></td></tr></tbody></table></div><!--[if mso | IE]></td></tr></table><![endif]--></td></tr></tbody></table></div><!--[if mso | IE]></td></tr></table><![endif]--></div></body></html>`)
    );
  });
});

const mkView = async ({ name, ...rest }: any) => {
  const tbl = await Table.findOne({ name: "books" });
  if (!tbl) throw new Error("no such table");
  return await View.create({
    table_id: tbl.id,
    name,
    viewtemplate: "Show",
    configuration: rest,
    min_role: 10,
  });
};
