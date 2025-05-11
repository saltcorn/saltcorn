import { describe, it, expect } from "@jest/globals";
import layoutUtils from "./layout_utils";

const {
  alert,
  toast,
  renderTabs,
  navSubItemsIterator,
  rightNavBar,
  leftNavBar,
  innerSections,
} = layoutUtils;

describe("alert", () => {
  it("renders a success alert", () => {
    const result = alert("success", "Operation completed successfully.");
    expect(result).toBe(
      `<div class="alert alert-success alert-dismissible fade show" role="alert"><i class="fas fa-check-circle me-1"></i>Operation completed successfully.<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>`
    );
  });

  it("renders an error alert", () => {
    const result = alert("error", "An error occurred.");
    expect(result).toBe(
      `<div class="alert alert-danger alert-dismissible fade show" role="alert"><i class="fas fa-times-circle me-1"></i>An error occurred.<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>`
    );
  });
});

describe("toast", () => {
  it("renders a success toast", () => {
    const result = toast("success", "Data saved successfully.");
    expect(result).toBe(
      `<div class="toast show" rendered="server-side" type="success" role="alert" ariaLive="assertive" ariaAtomic="true" style="min-width: 350px; max-width: 50vw; width: auto; "><div class="toast-header bg-success text-white py-1"><i class="fas fa-check-circle me-2"></i><strong class="me-auto">success</strong><button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close" style="font-size: 12px;"></button></div><div class="toast-body py-2 fs-6 fw-bold"><strong>Data saved successfully.</strong></div></div>`
    );
  });

  it("renders an error toast", () => {
    const result = toast("error", "Failed to save data.");
    expect(result).toBe(
      `<div class="toast show" rendered="server-side" type="error" role="alert" ariaLive="assertive" ariaAtomic="true" style="min-width: 350px; max-width: 50vw; width: auto; "><div class="toast-header bg-danger text-white py-1"><i class="fas fa-times-circle me-2"></i><strong class="me-auto">error</strong><button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close" style="font-size: 12px;"></button></div><div class="toast-body py-2 fs-6 fw-bold"><strong>Failed to save data.</strong></div></div>`
    );
  });
});

describe("renderTabs", () => {
  it("renders tabs with content", () => {
    const opts = {
      contents: ["Tab 1 Content", "Tab 2 Content"],
      titles: ["Tab 1", "Tab 2"],
      tabsStyle: "Tabs",
      independent: true,
    };
    const result = renderTabs(opts, (content) => content);

    expect(result).toMatch(
      /^<ul role="tablist" id="tab[a-f0-9]+" class="nav nav-tabs"><li class="nav-item" role="presentation"><a class="nav-link active" id="tab[a-f0-9]+link0" data-bs-toggle="tab" href="#Tab1" role="tab" aria-controls="tab[a-f0-9]+tab0" aria-selected="true">Tab 1<\/a><\/li><li class="nav-item" role="presentation"><a class="nav-link" id="tab[a-f0-9]+link1" data-bs-toggle="tab" href="#Tab2" role="tab" aria-controls="tab[a-f0-9]+tab1" aria-selected="false">Tab 2<\/a><\/li><\/ul><div class="tab-content" id="tab[a-f0-9]+content"><div class="tab-pane fade show active" role="tabpanel" id="Tab1" aria-labelledby="tab[a-f0-9]+link0">Tab 1 Content<\/div><div class="tab-pane fade" role="tabpanel" id="Tab2" aria-labelledby="tab[a-f0-9]+link1">Tab 2 Content<\/div><\/div>$/
    );
  });

  it("renders accordion-style tabs", () => {
    const opts = {
      contents: ["Accordion 1 Content", "Accordion 2 Content"],
      titles: ["Accordion 1", "Accordion 2"],
      tabsStyle: "Accordion",
      independent: true,
    };
    const result = renderTabs(opts, (content) => content);

    expect(result).toMatch(
      /^<div class="accordion" id="tab[a-f0-9]+top"><div class="accordion-item"><h2 class="accordion-header" id="tab[a-f0-9]+head0"><button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#tab[a-f0-9]+tab0" aria-expanded="true" aria-controls="tab[a-f0-9]+tab0">Accordion 1<\/button><\/h2><div class="accordion-collapse collapse show" id="tab[a-f0-9]+tab0" aria-labelledby="tab[a-f0-9]+head0"><div class="accordion-body">Accordion 1 Content<\/div><\/div><\/div><div class="accordion-item"><h2 class="accordion-header" id="tab[a-f0-9]+head1"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#tab[a-f0-9]+tab1" aria-expanded="false" aria-controls="tab[a-f0-9]+tab1">Accordion 2<\/button><\/h2><div class="accordion-collapse collapse" id="tab[a-f0-9]+tab1" aria-labelledby="tab[a-f0-9]+head1"><div class="accordion-body">Accordion 2 Content<\/div><\/div><\/div><\/div>$/
    );
  });
});

describe("navSubItemsIterator", () => {
  it("renders a separator item", () => {
    const item = {
      type: "Separator",
      label: "Separator",
      subitems: [],
      location: "",
      link: "/",
    };
    const result = navSubItemsIterator(item);
    expect(result).toBe('<hr class="mx-3 my-1">');
  });

  it("renders a dropdown with subitems", () => {
    const item = {
      label: "Dropdown",
      subitems: [
        {
          label: "Subitem 1",
          link: "/sub1",
          location: "dropdown",
          subitems: [],
        },
        {
          label: "Subitem 2",
          link: "/sub2",
          location: "dropdown",
          subitems: [],
        },
      ],
      location: "dropdown",
      link: "/dropdown",
    };

    const result = navSubItemsIterator(item);
    expect(result).toBe(
      `<div class="dropdown-item btn-group dropstart"><a type="button" class="dropdown-item dropdown-toggle p-0" data-bs-toggle="dropdown" aria-expanded="false">Dropdown</a><ul class="dropdown-menu"><li><div class="dropdown-item btn-group dropstart"><a type="button" class="dropdown-item dropdown-toggle p-0" data-bs-toggle="dropdown" aria-expanded="false">Subitem 1</a><ul class="dropdown-menu"></ul></div></li><li><div class="dropdown-item btn-group dropstart"><a type="button" class="dropdown-item dropdown-toggle p-0" data-bs-toggle="dropdown" aria-expanded="false">Subitem 2</a><ul class="dropdown-menu"></ul></div></li></ul></div>`
    );
  });
  it("renders a single link item", () => {
    const item = {
      label: "Link",
      link: "/link",
      location: "dropdown",
      subitems: [],
    };
    const result = navSubItemsIterator(item);
    expect(result).toBe(
      '<div class="dropdown-item btn-group dropstart"><a type="button" class="dropdown-item dropdown-toggle p-0" data-bs-toggle="dropdown" aria-expanded="false">Link</a><ul class="dropdown-menu"></ul></div>'
    );
  });

  it("renders a link item with an icon", () => {
    const item = {
      label: "Link",
      link: "/link",
      icon: "fa-icon",
      location: "icon",
      subitems: [],
    };
    const result = navSubItemsIterator(item);
    expect(result).toBe(
      `<div class="dropdown-item btn-group dropstart"><a type="button" class="dropdown-item dropdown-toggle p-0" data-bs-toggle="dropdown" aria-expanded="false">Link</a><ul class="dropdown-menu"></ul></div>`
    );
  });

  it("renders a link item with a tooltip", () => {
    const item = {
      label: "Link",
      link: "/link",
      tooltip: "Tooltip text",
      location: "tooltip",
      subitems: [],
    };
    const result = navSubItemsIterator(item);
    expect(result).toBe(
      `<div class="dropdown-item btn-group dropstart" data-bs-toggle="tooltip" data-bs-placement="top" title="Tooltip text"><a type="button" class="dropdown-item dropdown-toggle p-0" data-bs-toggle="dropdown" aria-expanded="false">Link</a><ul class="dropdown-menu"></ul></div>`
    );
  });
});

describe("rightNavBar", () => {
  it("renders a right navbar with sections", () => {
    const sections = [
      { label: "Home", link: "/", location: "Top", subitems: [] },
      { label: "About", link: "/about", location: "Top", subitems: [] },
    ];
    const result = rightNavBar("/", sections);
    expect(result).toBe(
      `<div class="collapse navbar-collapse" id="navbarResponsive"><ul class="navbar-nav ms-auto my-2 my-lg-0"></ul></div>`
    );
  });

  it("renders a right navbar with active section", () => {
    const sections = [
      { label: "Home", link: "/", location: "Top", subitems: [] },
      { label: "About", link: "/about", location: "Top", subitems: [] },
    ];
    const result = rightNavBar("/about", sections);
    expect(result).toBe(
      `<div class="collapse navbar-collapse" id="navbarResponsive"><ul class="navbar-nav ms-auto my-2 my-lg-0"></ul></div>`
    );
  });

  it("skips sections with 'Mobile Bottom' location", () => {
    const sections = [
      { label: "Home", link: "/", location: "Top", subitems: [] },
      {
        label: "Mobile",
        link: "/mobile",
        location: "Mobile Bottom",
        subitems: [],
      },
    ];
    const result = rightNavBar("/", sections);
    expect(result).not.toContain(
      '<a class="nav-link js-scroll-trigger" href="/mobile">Mobile</a>'
    );
  });
});

describe("leftNavBar", () => {
  it("renders a left navbar with brand name and logo", () => {
    const brand = { name: "TestApp", logo: "/logo.png" };
    const result = leftNavBar(brand);

    expect(result).toEqual([
      '<a class="navbar-brand js-scroll-trigger" href="/">' +
        '<img src="/logo.png" width="30" height="30" class="mx-1 d-inline-block align-top" alt="Logo" loading="lazy">' +
        "TestApp</a>",
      '<button class="navbar-toggler navbar-toggler-right" type="button" data-bs-toggle="collapse" ' +
        'data-bs-target="#navbarResponsive" aria-controls="navbarResponsive" aria-expanded="false" ' +
        'aria-label="Toggle navigation"><span class="navbar-toggler-icon"></span></button>',
    ]);
  });

  it("renders a left navbar without a logo", () => {
    const brand = { name: "TestApp", logo: "" };
    const result = leftNavBar(brand);

    expect(result).toEqual([
      '<a class="navbar-brand js-scroll-trigger" href="/">TestApp</a>',
      '<button class="navbar-toggler navbar-toggler-right" type="button" data-bs-toggle="collapse" ' +
        'data-bs-target="#navbarResponsive" aria-controls="navbarResponsive" aria-expanded="false" ' +
        'aria-label="Toggle navigation"><span class="navbar-toggler-icon"></span></button>',
    ]);
  });

  it("returns an empty array when no brand is provided", () => {
    const result = leftNavBar(undefined);
    expect(result).toEqual([]);
  });
});

describe("innerSections", () => {
  it("returns an empty array when no sections are provided", () => {
    const result = innerSections([]);
    expect(result).toEqual([]);
  });

  it("handles sections without items gracefully", () => {
    const sections = [
      {
        label: "Section 1",
        items: [],
        link: "/section1",
        location: "section 1",
        subitems: [],
      },
      {
        label: "Section 2",
        items: [],
        link: "/section2",
        location: "section 2",
        subitems: [],
      },
    ];
    const result = innerSections(sections);
    expect(result).toEqual([]);
  });
});
