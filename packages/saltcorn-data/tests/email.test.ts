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
    await email.send_verification_email(user as User, mockReqRes.req, {
      new_verification_token: "newsecrettoken",
    });
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
    <![endif]--><!--[if !mso]><!--><link href="https://fonts.googleapis.com/css?family=Ubuntu:300,400,500,700" rel="stylesheet" type="text/css"><style type="text/css">@import url(https://fonts.googleapis.com/css?family=Ubuntu:300,400,500,700);</style><!--<![endif]--><style type="text/css">@media only screen and (min-width:480px) {
        .mj-column-per-17 { width:17% !important; max-width: 17%; }
.mj-column-per-83 { width:83% !important; max-width: 83%; }
      }</style><style media="screen and (min-width:480px)">.moz-text-html .mj-column-per-17 { width:17% !important; max-width: 17%; }
.moz-text-html .mj-column-per-83 { width:83% !important; max-width: 83%; }</style><style type="text/css"></style><style type="text/css">.group_bece35582674e73605c036ebbd135bfd2129b516 div {
        margin-bottom:1.5rem;
      }.group_bece35582674e73605c036ebbd135bfd2129b516 div {
        margin-bottom:1.5rem;
      }</style><link href="https://stackpath.bootstrapcdn.com/bootswatch/4.5.0/flatly/bootstrap.min.css" rel="stylesheet"></head><body style="word-spacing:normal;"><div><!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" class="group_bece35582674e73605c036ebbd135bfd2129b516-outlook" role="presentation" style="width:600px;" width="600" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]--><div class="group_bece35582674e73605c036ebbd135bfd2129b516" style="margin:0px auto;max-width:600px;"><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;"><tbody><tr><td style="direction:ltr;font-size:0px;padding:0px;text-align:center;"><!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:102px;" ><![endif]--><div class="mj-column-per-17 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"><table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"><tbody><tr><td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;"><div style="font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:13px;line-height:1;text-align:left;color:#000000;"><span>Email</span></div></td></tr></tbody></table></div><!--[if mso | IE]></td><td class="" style="vertical-align:top;width:498px;" ><![endif]--><div class="mj-column-per-83 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"><table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"><tbody><tr><td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;"><div style="font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:13px;line-height:1;text-align:left;color:#000000;"><span>admin@foo.com</span></div></td></tr></tbody></table></div><!--[if mso | IE]></td></tr></table><![endif]--></td></tr></tbody></table></div><!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" class="group_bece35582674e73605c036ebbd135bfd2129b516-outlook" role="presentation" style="width:600px;" width="600" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]--><div class="group_bece35582674e73605c036ebbd135bfd2129b516" style="margin:0px auto;max-width:600px;"><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;"><tbody><tr><td style="direction:ltr;font-size:0px;padding:0px;text-align:center;"><!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:102px;" ><![endif]--><div class="mj-column-per-17 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"><table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"><tbody><tr><td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;"><div style="font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:13px;line-height:1;text-align:left;color:#000000;"><span>Click to verify</span></div></td></tr></tbody></table></div><!--[if mso | IE]></td><td class="" style="vertical-align:top;width:498px;" ><![endif]--><div class="mj-column-per-83 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"><table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"><tbody><tr><td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;"><div style="font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:13px;line-height:1;text-align:left;color:#000000;"><span>/auth/verify?token=newsecrettoken&amp;email=admin%40foo.com</span></div></td></tr></tbody></table></div><!--[if mso | IE]></td></tr></table><![endif]--></td></tr></tbody></table></div><!--[if mso | IE]></td></tr></table><![endif]--></div></body></html>`)
    );
  });
});

describe("MJML Mail Transformations", () => {
  it("transform simple to mjml", async () => {
    const v = await View.findOne({ name: "authorshow" });
    const ml = await email.viewToMjml(v, { id: 1 });
    expect(ml).toBe(
`<mjml><mj-head><mj-raw>
    <link 
      href="https://stackpath.bootstrapcdn.com/bootswatch/4.5.0/flatly/bootstrap.min.css" 
      rel="stylesheet"
    /></mj-raw></mj-head><mj-body><mj-section padding="0px"><mj-column><mj-text><span>Herman Melville</span></mj-text></mj-column></mj-section></mj-body></mjml>`
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
    <![endif]--><!--[if !mso]><!--><link href="https://fonts.googleapis.com/css?family=Ubuntu:300,400,500,700" rel="stylesheet" type="text/css"><style type="text/css">@import url(https://fonts.googleapis.com/css?family=Ubuntu:300,400,500,700);</style><!--<![endif]--><style type="text/css">@media only screen and (min-width:480px) {
        .mj-column-per-100 { width:100% !important; max-width: 100%; }
      }</style><style media="screen and (min-width:480px)">.moz-text-html .mj-column-per-100 { width:100% !important; max-width: 100%; }</style><style type="text/css"></style><style type="text/css"></style><link href="https://stackpath.bootstrapcdn.com/bootswatch/4.5.0/flatly/bootstrap.min.css" rel="stylesheet"></head><body style="word-spacing:normal;"><div><!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" class="" role="presentation" style="width:600px;" width="600" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]--><div style="margin:0px auto;max-width:600px;"><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;"><tbody><tr><td style="direction:ltr;font-size:0px;padding:0px;text-align:center;"><!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:600px;" ><![endif]--><div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"><table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"><tbody><tr><td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;"><div style="font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:13px;line-height:1;text-align:left;color:#000000;"><span>Herman Melville</span></div></td></tr></tbody></table></div><!--[if mso | IE]></td></tr></table><![endif]--></td></tr></tbody></table></div><!--[if mso | IE]></td></tr></table><![endif]--></div></body></html>`)
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
    <![endif]--><!--[if !mso]><!--><link href="https://fonts.googleapis.com/css?family=Ubuntu:300,400,500,700" rel="stylesheet" type="text/css"><style type="text/css">@import url(https://fonts.googleapis.com/css?family=Ubuntu:300,400,500,700);</style><!--<![endif]--><style type="text/css">@media only screen and (min-width:480px) {
        .mj-column-per-50 { width:50% !important; max-width: 50%; }
      }</style><style media="screen and (min-width:480px)">.moz-text-html .mj-column-per-50 { width:50% !important; max-width: 50%; }</style><style type="text/css"></style><style type="text/css">.group_da39a3ee5e6b4b0d3255bfef95601890afd80709 div {
        
      }.container_f27a1feab32f468fc01f8e1f520194fac57d936d div {
        min-height: 100px;border: 1px solid black;  background-color: #a9a7a7;  
      }</style><link href="https://stackpath.bootstrapcdn.com/bootswatch/4.5.0/flatly/bootstrap.min.css" rel="stylesheet"></head><body style="word-spacing:normal;"><div><!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" class="group_da39a3ee5e6b4b0d3255bfef95601890afd80709-outlook" role="presentation" style="width:600px;" width="600" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]--><div class="group_da39a3ee5e6b4b0d3255bfef95601890afd80709" style="margin:0px auto;max-width:600px;"><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;"><tbody><tr><td style="direction:ltr;font-size:0px;padding:0px;text-align:center;"><!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:300px;" ><![endif]--><div class="mj-column-per-50 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"><table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"><tbody><tr><td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;"><div style="font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:13px;line-height:1;text-align:left;color:#000000;"><span><div class="card mt-4 shadow"><div class="card-body"><mj-text><span><a href="javascript:ajax_modal('/view/authorshow?id=1')">foo it</a></span></mj-text></div></div></span></div></td></tr></tbody></table></div><!--[if mso | IE]></td><td class="" style="vertical-align:top;width:300px;" ><![endif]--><div class="mj-column-per-50 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"><table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"><tbody><tr><td align="left" class="container_f27a1feab32f468fc01f8e1f520194fac57d936d" style="font-size:0px;padding:10px 25px;word-break:break-word;"><div style="font-family:Ubuntu, Helvetica, Arial, sans-serif;font-size:13px;line-height:1;text-align:left;color:#000000;"><mj-text><span><mj-raw><a href="https://countto.com/967">Herman Melville</a></mj-raw></span></mj-text></div></td></tr></tbody></table></div><!--[if mso | IE]></td></tr></table><![endif]--></td></tr></tbody></table></div><!--[if mso | IE]></td></tr></table><![endif]--></div></body></html>`)
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
