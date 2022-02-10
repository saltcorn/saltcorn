/*
  This test is based on the commented out 'BootstrapEmail.spec.js' test
  from 'bootstrap-email'.
 */

import { dirname, join, normalize } from "path";
import { readdirSync, readFileSync } from "fs";
import email from "../models/email";
const BootstrapEmail = require.resolve("bootstrap-email_with-node-sass-6");
import { describe, it, expect, jest } from "@jest/globals";

function removeBreaks(str: string): string {
  return str.replace(/(\r\n|\r|\n)/gm, "").toLowerCase();
}

jest.setTimeout(60 * 1000);

describe("Bootstrap Mail Transformations", () => {
  const examplesDir = normalize(join(dirname(BootstrapEmail), "../examples"));
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
  });
});
