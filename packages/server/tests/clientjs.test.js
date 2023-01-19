/**
 * @jest-environment jsdom
 */
const fs = require("fs");
const path = require("path");

const load_script = (fnm) => {
  const srcFile = fs.readFileSync(path.join(__dirname, "..", "public", fnm), {
    encoding: "utf-8",
  });
  const scriptEl = document.createElement("script");
  scriptEl.textContent = srcFile;
  document.body.appendChild(scriptEl);
};

load_script("jquery-3.6.0.min.js");
load_script("saltcorn-common.js");
load_script("saltcorn.js");

test("updateQueryStringParameter", () => {
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
  expect(
    updateQueryStringParameter("/foo", "publisher.publisher->name", "AK")
  ).toBe("/foo?publisher.publisher->name=AK");
  expect(
    updateQueryStringParameter(
      "/foo?publisher.publisher->name=AB",
      "publisher.publisher->name",
      "AK"
    )
  ).toBe("/foo?publisher.publisher->name=AK");
});
//publisher.publisher->name
test("updateQueryStringParameter hash", () => {
  expect(updateQueryStringParameter("/foo#baz", "age", 43)).toBe(
    "/foo?age=43#baz"
  );
  expect(updateQueryStringParameter("/foo?age=44#Baz", "age", 43)).toBe(
    "/foo?age=43#Baz"
  );
  expect(updateQueryStringParameter("/foo?name=Bar#Zap", "age", 43)).toBe(
    "/foo?name=Bar&age=43#Zap"
  );
  expect(removeQueryStringParameter("/foo?age=44#Baz", "age")).toBe("/foo#Baz");
  expect(removeQueryStringParameter("/foo?name=Bar#Baz", "age")).toBe(
    "/foo?name=Bar#Baz"
  );
  expect(removeQueryStringParameter("/foo?name=Bar&age=45#Baz", "age")).toBe(
    "/foo?name=Bar#Baz"
  );
});
test("unique_field_from_rows test", () => {
  $("body").append(`<input id="mkuniq" value="bar"></div>`);
  unique_field_from_rows(
    [{ foo: "bar" }, { foo: "bar0" }],
    "mkuniq",
    "foo",
    false,
    0,
    false,
    "Digits",
    "bar"
  );
  expect($("#mkuniq").val()).toBe("bar1");

  $("body").append(`<input id="mkuniq" value="bar"></div>`);
  unique_field_from_rows(
    [{ foo: "bar" }],
    "mkuniq",
    "foo",
    false,
    9,
    false,
    "Digits",
    "bar"
  );
  expect($("#mkuniq").val()).toBe("bar9");

  $("body").append(`<input id="mkuniq" value="bar"></div>`);
  unique_field_from_rows(
    [{ foo: "bar0" }],
    "mkuniq",
    "foo",
    false,
    9,
    false,
    "Digits",
    "bar"
  );
  expect($("#mkuniq").val()).toBe("bar9");

  $("#mkuniq").val("bar");
  unique_field_from_rows([], "mkuniq", "foo", false, 0, false, "Digits", "bar");
  expect($("#mkuniq").val()).toBe("bar");

  $("body").append(`<input id="mkuniq" value="bar"></div>`);
  unique_field_from_rows(
    [{ foo: "bar" }, { foo: "bar A" }],
    "mkuniq",
    "foo",
    true,
    0,
    false,
    "Uppercase Letters",
    "bar"
  );
  expect($("#mkuniq").val()).toBe("bar B");

  //skips blanks
  $("body").append(`<input id="mkuniq" value="bar"></div>`);
  unique_field_from_rows(
    [{ foo: "bar" }, { foo: "bar0" }, { foo: "bar1" }, { foo: "bar3" }],
    "mkuniq",
    "foo",
    false,
    0,
    false,
    "Digits",
    "bar"
  );
  expect($("#mkuniq").val()).toBe("bar4");
});
