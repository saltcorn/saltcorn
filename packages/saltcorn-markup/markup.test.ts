import { describe, it, expect } from "@jest/globals";
// import tags = require("./tags");
// import mjml = require("./mjml-tags");
import * as tags from "./tags";
import * as mjml from "./mjml-tags";
import tabs from "./tabs";
import mkTable from "./table";

const { a, input, div, ul, text, text_attr, i, hr, genericElement } = tags;

describe("tags", () => {
  it("renders", () => {
    expect(a({ href: "/" }, "Home")).toBe('<a href="/">Home</a>');
    expect(a({ href: "/" }, ["Home", " Sweet", " Home"])).toBe(
      '<a href="/">Home Sweet Home</a>'
    );
    expect(a({ href: "/", class: "centre" }, "Home")).toBe(
      '<a href="/" class="centre">Home</a>'
    );
    expect(input({ type: "text" })).toBe('<input type="text">');
    expect(div(5)).toBe("<div>5</div>");
    expect(div()).toBe("<div></div>");
    expect(div(null)).toBe("<div></div>");
    expect(div("Hello world")).toBe("<div>Hello world</div>");
    expect(div(["Hello world"])).toBe("<div>Hello world</div>");
    expect(i()).toBe("<i></i>");
    expect(hr()).toBe("<hr>");
    expect(div(["hello ", "world"])).toBe("<div>hello world</div>");
    expect(ul({ class: "foo" }, [false, "hello ", "world"])).toBe(
      `<ul class="foo">hello world</ul>`
    );
    expect(ul({ class: "foo" }, [["hello ", "world"]])).toBe(
      `<ul class="foo">hello world</ul>`
    );
    expect(i({ class: "fas fa-plus-square" })).toBe(
      '<i class="fas fa-plus-square"></i>'
    );
    expect(genericElement("div", { class: "foo" }, "Hello")).toBe(
      '<div class="foo">Hello</div>'
    );
  });

  it("class", () => {
    expect(div({ class: "foo" }, 5)).toBe('<div class="foo">5</div>');
    expect(div({ class: false }, 5)).toBe("<div>5</div>");
    expect(div({ class: "foo bar" }, 5)).toBe('<div class="foo bar">5</div>');
    expect(div({ class: ["foo", "bar"] }, 5)).toBe(
      '<div class="foo bar">5</div>'
    );
    expect(div({ class: ["foo", " "] }, 5)).toBe('<div class="foo  ">5</div>');
    expect(input({ class: ["foo", " "] })).toBe('<input class="foo  ">');

    expect(
      div({ class: ["foo bar", "", undefined, null, false, "baz"] }, 5)
    ).toBe('<div class="foo bar baz">5</div>');

    expect(div({ class: [undefined, null, false] }, 5)).toBe("<div>5</div>");
    expect(hr({ class: "foo" })).toBe('<hr class="foo">');
  });
  it("style", () => {
    expect(div({ style: "color:red;border:1px solid black" }, 5)).toBe(
      '<div style="color:red;border:1px solid black">5</div>'
    );
    expect(div({ style: ["color:red", "border:1px solid black"] }, 5)).toBe(
      '<div style="color:red;border:1px solid black">5</div>'
    );
    expect(
      div(
        { style: ["color:red", false, undefined, "border:1px solid black"] },
        5
      )
    ).toBe('<div style="color:red;border:1px solid black">5</div>');
    expect(div({ style: { color: "red", border: "1px solid black" } }, 5)).toBe(
      '<div style="color:red;border:1px solid black">5</div>'
    );

    expect(
      div({ style: { marginRight: "1px", border: "1px solid black" } }, 5)
    ).toBe('<div style="margin-right:1px;border:1px solid black">5</div>');
    //border-top-left-radius
    expect(
      div({ style: { marginRight: "1px", borderTopLeftRadius: "3px" } }, 5)
    ).toBe('<div style="margin-right:1px;border-top-left-radius:3px">5</div>');
    expect(hr({ style: { color: "red" } }, 5)).toBe('<hr style="color:red">');
    expect(hr({ style: {} })).toBe("<hr>");
    expect(hr({ style: null })).toBe("<hr>");
    expect(div({ class: "foo", style: null })).toBe('<div class="foo"></div>');
  });

  it("escaping", () => {
    expect(text("foo")).toBe("foo");
    expect(text_attr('" onMouseOver="alert(1);')).toBe(
      "&quot; onMouseOver=&quot;alert(1);"
    );
    expect(text(1)).toBe("1");
    expect(text(0)).toBe("0");
    expect(text("<script>alert(1);<script>")).toBe(
      "&lt;script&gt;alert(1);&lt;script&gt;"
    );
    expect(text("<p>alert<p>")).toBe("<p>alert<p>");
    expect(text("<kbd>ctrl<kbd>")).toBe("<kbd>ctrl<kbd>");
    expect(text('<span style="color:#2ecc71;">green</span>')).toBe(
      '<span style="color:#2ecc71;">green</span>'
    );
    expect(text('<article style="color:#2ecc71;">green</article>')).toBe(
      "<article>green</article>"
    );
    expect(
      text('<article style="color:#2ecc71;">green</article>', {
        article: ["style"],
      })
    ).toBe('<article style="color:#2ecc71;">green</article>');
    expect(
      text('<progress onclick="foo()">green</progress>', {
        progress: ["onclick"],
      })
    ).toBe('<progress onclick="foo()">green</progress>');
  });
});

describe("mjml tags", () => {
  it("renders", () => {
    expect(
      mjml.mjml(
        mjml.body(
          mjml.section(
            { "background-color": "#f0f0f0" },
            mjml.text("hello world")
          )
        )
      )
    ).toBe(
      '<mjml><mj-body><mj-section background-color="#f0f0f0"><mj-text>hello world</mj-text></mj-section></mj-body></mjml>'
    );
  });
});

describe("tabs", () => {
  it("renders tabs with single content", () => {
    const result = tabs({
      Tab1: "Content1",
    });
    // expect(result).toContain('<ul class="nav nav-tabs" role="tablist">');
    // expect(result).toContain('<li class="nav-item">');
    // expect(result).toContain('<a class="nav-link active" data-bs-toggle="tab"');
    // expect(result).toContain('href="#Tab3');
    // expect(result).toContain('<div class="tab-pane fade show active"');
    // expect(result).toContain('id="Tab1"');
    // expect(result).toContain("Content1");
    expect(result).toBe(
      `<ul class="nav nav-tabs" role="tablist"><li class="nav-item"><a class="nav-link active" data-bs-toggle="tab" href="#Tab1" id="Tab1-tab" role="tab" aria-controls="home" aria-selected="true">Tab1</a></li></ul><div class="tab-content"><div class="tab-pane fade show active" id="Tab1" role="tabpanel" aria-labelledby="Tab1-tab">Content1</div></div>`
    );
  });

  it("renders tabs with multiple contents", () => {
    const result = tabs({ Tab1: "Content1", Tab2: "Content2" });
    // expect(result).toContain('<ul class="nav nav-tabs" role="tablist">');
    // expect(result).toContain('<li class="nav-item">');
    // expect(result).toContain('<a class="nav-link active" data-bs-toggle="tab"');
    // expect(result).toContain('href="#Tab2"');
    // expect(result).toContain('<div class="tab-pane fade show active"');
    // expect(result).toContain('id="Tab1');
    // expect(result).toContain("Content1");
    // expect(result).toContain('<div class="tab-pane fade"');
    // expect(result).toContain('id="Tab2"');
    // expect(result).toContain("Content2");
    expect(result).toBe(
      `<ul class="nav nav-tabs" role="tablist"><li class="nav-item"><a class="nav-link active" data-bs-toggle="tab" href="#Tab1" id="Tab1-tab" role="tab" aria-controls="home" aria-selected="true">Tab1</a></li><li class="nav-item"><a class="nav-link" data-bs-toggle="tab" href="#Tab2" id="Tab2-tab" role="tab" aria-controls="home" aria-selected="true">Tab2</a></li></ul><div class="tab-content"><div class="tab-pane fade show active" id="Tab1" role="tabpanel" aria-labelledby="Tab1-tab">Content1</div><div class="tab-pane fade" id="Tab2" role="tabpanel" aria-labelledby="Tab2-tab">Content2</div></div>`
    );
  });

  it("renders tabs from an array of entries", () => {
    const result = tabs([
      ["Tab1", "Content1"],
      ["Tab2", "Content2"],
    ]);
    // expect(result).toContain('<ul class="nav nav-tabs" role="tablist">');
    // expect(result).toContain('<li class="nav-item">');
    // expect(result).toContain('<a class="nav-link active" data-bs-toggle="tab"');
    // expect(result).toContain('href="#Tab1"');
    // expect(result).toContain('<a class="nav-link" data-bs-toggle="tab"');
    // expect(result).toContain('href="#Tab2"');
    // expect(result).toContain('<div class="tab-pane fade show active"');
    // expect(result).toContain('id="Tab1"');
    // expect(result).toContain("Content1");
    // expect(result).toContain('<div class="tab-pane fade"');
    // expect(result).toContain('id="Tab2"');
    // expect(result).toContain("Content2");
    expect(result).toBe(
      `<ul class="nav nav-tabs" role="tablist"><li class="nav-item"><a class="nav-link active" data-bs-toggle="tab" href="#Tab1" id="Tab1-tab" role="tab" aria-controls="home" aria-selected="true">Tab1</a></li><li class="nav-item"><a class="nav-link" data-bs-toggle="tab" href="#Tab2" id="Tab2-tab" role="tab" aria-controls="home" aria-selected="true">Tab2</a></li></ul><div class="tab-content"><div class="tab-pane fade show active" id="Tab1" role="tabpanel" aria-labelledby="Tab1-tab">Content1</div><div class="tab-pane fade" id="Tab2" role="tabpanel" aria-labelledby="Tab2-tab">Content2</div></div>`
    );
  });
  it("handles empty tabs gracefully", () => {
    const result = tabs({});
    // expect(result).toContain('<ul class="nav nav-tabs" role="tablist">');
    // expect(result).not.toContain('<li class="nav-item">');
    // expect(result).toContain('<div class="tab-content"></div>');
    expect(result).toBe(
      `<ul class="nav nav-tabs" role="tablist"></ul><div class="tab-content"></div>`
    );
  });
});

describe("table", () => {
  it("renders a basic table", () => {
    const headers = [
      { label: "Name", key: "name" },
      { label: "Age", key: "age" },
    ];
    const rows = [
      { name: "UserName1", age: 25 },
      { name: "UserName2", age: 30 },
    ];
    const result = mkTable(headers, rows);
    // expect(result).toContain('<table class="table table-sm');
    // expect(result).toContain("<thead>");
    // expect(result).toContain("<th>Name</th>");
    // expect(result).toContain("<th>Age</th>");
    // expect(result).toContain("<td>UserName1</td>");
    // expect(result).toContain("<td>25</td>");
    // expect(result).toContain("<td>UserName2</td>");
    // expect(result).toContain("<td>30</td>");
    expect(result).toBe(
      `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Name</th><th>Age</th></tr></thead><tbody><tr><td>UserName1</td><td>25</td></tr><tr><td>UserName2</td><td>30</td></tr></tbody></table></div>`
    );
  });

  it("renders a tramnsposed table", () => {
    const headers = [
      {
        label: "Name",
        key: "name",
      },
      {
        label: "Age",
        key: "age",
      },
    ];
    const rows = [
      { name: "UserName1", age: 25 },
      { name: "UserName2", age: 30 },
    ];
    const result = mkTable(headers, rows, { transpose: true });
    // expect(result).toContain('<table class="table table-sm"');
    // expect(result).toContain("<th>Name</th>");
    // expect(result).toContain("<td>UserName1</td>");
    // expect(result).toContain("<td>UserName2</td>");
    // expect(result).toContain("<th>Age</th>");
    // expect(result).toContain("<td>254</td>");
    // expect(result).toContain("<td>30</td>");
    expect(result).toBe(
      `<div class="table-responsive"><table class="table table-sm"><tbody><tr><th>Name</th><td>UserName1</td><td>UserName2</td></tr><tr><th>Age</th><td>25</td><td>30</td></tr></tbody></table></div>`
    );
  });

  it("renders a transposed table", () => {
    const headers = [
      {
        label: "Name",
        key: "name",
      },
      {
        label: "Age",
        key: "age",
      },
    ];
    const rows = [
      { name: "UserName1", age: 25 },
      { name: "UserName2", age: 30 },
    ];

    const result = mkTable(headers, rows, { transpose: true });
    // expect(result).toContain('<table class="table table-sm');
    // expect(result).toContain("<th>Name</th>");
    // expect(result).toContain("<td>UserName1</td>");
    // expect(result).toContain("<td>UserName2</td>");
    // expect(result).toContain("<th>Age</th>");
    // expect(result).toContain("<td>25</td>");
    // expect(result).toContain("<td>30</td>");
    expect(result).toBe(
      `<div class="table-responsive"><table class="table table-sm"><tbody><tr><th>Name</th><td>UserName1</td><td>UserName2</td></tr><tr><th>Age</th><td>25</td><td>30</td></tr></tbody></table></div>`
    );
  });

  // it("renders a header cell", () => {
  //   const header = { label: "Name", align: "center", width: "100px" };
  //   const result = headerCell(header);
  //   expect(result).toBe(
  //     '<th style="text-align: center;width: 100px;">Name</th>'
  //   );
  // });

  // it("renders a table with groupped rows", () => {
  //   const headers = [
  //     {
  //       label: "Name",
  //       key: "name",
  //     },
  //     {
  //       label: "Age",
  //       key: "age",
  //     },
  //   ];
  //   const groupedRows = {
  //     Group1: [
  //       { name: "UserName1", age: 25 },
  //       { name: "UserName2", age: 30 },
  //     ],
  //     Group2: [{ name: "UserName3", age: 35 }],
  //   };
  //   const result = mkTable(headers, groupedRows, {grouped: true})
  //   expect(result)
  // });

  it("renders a table with pagination", () => {
    const headers = [
      { label: "Name", key: "name" },
      { label: "Age", key: "age" },
    ];
    const rows = [
      { name: "UserName1", age: 25 },
      { name: "UserName2", age: 30 },
    ];
    const paginationOpts = {
      current_page: 1,
      pages: 3,
      get_page_link: (page: number) => `?page=${page}`,
    };
    const result = mkTable(headers, rows, { pagination: paginationOpts });
    // expect(result).toContain('<nav aria-label="pagination">');
    // expect(result).toContain('<a href="?page=2">2</a>');
    expect(result).toBe(
      `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Name</th><th>Age</th></tr></thead><tbody><tr><td>UserName1</td><td>25</td></tr><tr><td>UserName2</td><td>30</td></tr></tbody></table><ul class="pagination"><li class="page-item active"><span class="page-link link-style" onclick="?page=1" role="link">1</span></li><li class="page-item"><span class="page-link link-style" onclick="?page=2" role="link">2</span></li><li class="page-item"><span class="page-link link-style" onclick="?page=3" role="link">3</span></li></ul></div>`
    );
  });
});
