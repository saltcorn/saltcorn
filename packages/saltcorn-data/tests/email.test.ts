/*
  This test is based on the commented out 'BootstrapEmail.spec.js' test
  from 'bootstrap-email'.
 */

import { dirname, join, normalize } from "path";
import { writeFileSync } from "fs";
import email from "../models/email";
import { describe, it, expect, jest } from "@jest/globals";
import View from "../models/view";

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

jest.setTimeout(60 * 1000);

describe("Bootstrap Mail Transformations", () => {
  it("transform to mjml", async () => {
    const v = await View.findOne({ name: "authorshow" });
    const ml = await email.viewToMjml(v, { id: 1 });
    expect(ml).toBe(`<mjml><mj-body>Herman Melville</mj-body></mjml>`);
  });
  it("transform to html", async () => {
    const v = await View.findOne({ name: "authorshow" });
    const html = await email.viewToEmailHtml(v, { id: 1 });
    //writeFileSync("emailout", html);
    expect(trimLines(html)).toBe(
      trimLines(`<!doctype html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><title></title><!--[if !mso]><!-- --><meta http-equiv="X-UA-Compatible" content="IE=edge"><!--<![endif]--><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style type="text/css">#outlook a { padding:0; }
    body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
    table, td { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
    img { border:0;height:auto;line-height:100%; outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
    p { display:block;margin:13px 0; }</style><!--[if mso]>
  <xml>
  <o:OfficeDocumentSettings>
    <o:AllowPNG/>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings>
  </xml>
  <![endif]--><!--[if lte mso 11]>
  <style type="text/css">
    .mj-outlook-group-fix { width:100% !important; }
  </style>
  <![endif]--><style type="text/css"></style></head><body><div></div></body></html>`)
    );
  });

  /* const examplesDir = normalize(join(dirname(BootstrapEmail), "../examples"));
  const inputsDir = join(examplesDir, "input");
  const outputsDir = join(examplesDir, "output");
  const inputFiles = readdirSync(inputsDir).map((file: string) => {
    return readFileSync(join(inputsDir, file)).toString();
  });
  const expectedFiles = readdirSync(outputsDir).map((file: string) => {
    return readFileSync(join(outputsDir, file)).toString();
  });
  it("transform input files and compare with expected files", async () => {
    expect(inputFiles.length).toBe(expectedFiles.length);
    for (let i = 0; i < inputFiles.length; i++) {
      //const mail = await transformBootstrapEmail(inputFiles[i], false);
      //expect(removeBreaks(mail)).toBe(removeBreaks(expectedFiles[i]));
    }
  });*/
});
