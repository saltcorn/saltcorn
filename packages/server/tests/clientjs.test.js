/**
 * @jest-environment jsdom
 */
const fs = require("fs");
const path = require("path");

// file to test

const load_script = (fnm) => {
  const srcFile = fs.readFileSync(path.join(__dirname, "..", "public", fnm), {
    encoding: "utf-8",
  });
  const scriptEl = document.createElement("script");
  scriptEl.textContent = srcFile;
  document.body.appendChild(scriptEl);
};

test("use jsdom in this test file", () => {
  load_script("jquery-3.6.0.min.js");
  load_script("saltcorn.js");
  const element = document.createElement("div");
  expect(element).not.toBeNull();
  expect(updateQueryStringParameter("/foo", "age", 43)).toBe("/foo?age=43");
  expect(updateQueryStringParameter("/foo?age=44", "age", 43)).toBe(
    "/foo?age=43"
  );
  expect(updateQueryStringParameter("/foo?name=Bar", "age", 43)).toBe(
    "/foo?name=Bar&age=43"
  );
  expect(removeQueryStringParameter("/foo?age=44", "age")).toBe("/foo");
  expect(removeQueryStringParameter("/foo?name=Bar", "age")).toBe(
    "/foo?name=Bar"
  );
  expect(removeQueryStringParameter("/foo?name=Bar&age=45", "age")).toBe(
    "/foo?name=Bar"
  );
});
// /Users/tomn/saltcorn/packages/server/public/jquery-3.6.0.min.js
