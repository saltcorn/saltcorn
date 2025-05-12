import { describe, it, expect } from "@jest/globals";
import helpers from "./helpers";

const {
  select_options,
  radio_group,
  checkbox_group,
  pagination,
  dropdown_checkboxes,
  search_bar,
} = helpers;

describe("select_options", () => {
  it("renders options for a select input", () => {
    const hdr = {
      options: [
        { label: "Option 1", value: "1" },
        { label: "Option 2", value: "2" },
      ],
    };
    const result = select_options("1", hdr);
    expect(result).toContain(
      '<option value="1" selected>Option 1</option>'
    );
    expect(result).toContain(
      '<option value="2">Option 2</option>'
    );
  });

  it("renders options with a neutral label", () => {
    const hdr = {
      options: [
        { label: "Option 1", value: "1" },
        { label: "", value: "" },
      ],
    };
    const result = select_options("", hdr, false, "Select an option");
    expect(result).toContain(
      '<option value="">Select an option</option>'
    );
    expect(result).toContain(
      '<option value="1">Option 1</option>'
    );
  });

  it("selects correct option when value is provided", () => {
    const hdr = { options: [{ value: "1", label: "Option 1" }] };
    const result = select_options("1", hdr, false, "Select");
    expect(result).toContain(
      '<option value="1" selected>Option 1</option>'
    );
  });

  it("sorts options alphabetically", () => {
    const hdr = {
      options: [
        { label: "Banana", value: "banana" },
        { label: "Apple", value: "apple" },
      ],
    };
    const result = select_options("", hdr);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toContain('value="apple"');
    expect(result[1]).toContain('value="banana"');
    expect(result[0]).toContain(">Apple</option>");
    expect(result[1]).toContain(">Banana</option>");
  });
});

describe("radio_group", () => {
  it("renders a group of radio buttons", () => {
    const opts = {
      name: "testRadio",
      options: [
        { label: "Option 1", value: "1" },
        { label: "Option 2", value: "2" },
      ],
      value: "1",
      inline: false,
      form_name: "testRadio",
      onChange: "handleChange()",
      required: true,
    };
    const result = radio_group(opts);
    expect(result).toContain(
      '<input class="form-check-input" type="radio" name="testRadio"'
    );
    expect(result).toContain('value="1" checked');
    expect(result).toContain('value="2"');
    expect(result).toContain(
      '<label class="form-check-label" for="inputtestRadio0">Option 1</label>'
    );
  });

  it("renders inline radio buttons", () => {
    const opts = {
      name: "inlineRadio",
      options: ["Option A", "Option B"],
      value: "Option A",
      inline: true,
      form_name: "inlineRadio",
      onChange: "handleChange()",
      required: false,
    };
    const result = radio_group(opts);
    expect(result).toContain('class="form-check form-check-inline"');
  });
});

describe("checkbox_group", () => {
  it("renders a group of checkboxes", () => {
    const opts = {
      name: "testCheckbox",
      options: [
        { label: "Option 1", value: "1" },
        { label: "Option 2", value: "2" },
      ],
      value: "1",
      inline: false,
      form_name: "testCheckbox",
      onChange: "handleCheckboxChange()",
      required: true,
    };
    const result = checkbox_group(opts);
    expect(result).toContain(
      '<input class="form-check-input" type="checkbox" name="testCheckbox"'
    );
    expect(result).toContain('value="1" checked');
    expect(result).toContain('value="2"');
    expect(result).toContain(
      '<label class="form-check-label" for="inputtestCheckbox0">Option 1</label>'
    );
  });

  it("renders inline checkboxes", () => {
    const opts = {
      name: "inlineCheckbox",
      options: ["Option A", "Option B"],
      value: "Option A",
      inline: true,
      form_name: "inlineCheckbox",
      onChange: "handleCheckboxChange()",
      required: false,
    };
    const result = checkbox_group(opts);
    expect(result).toContain('class="form-check form-check-inline"');
  });
});

describe("pagination", () => {
  it("renders pagination with multiple pages", () => {
    const opts = {
      current_page: 2,
      pages: 5,
      get_page_link: (index: number) => `goToPage(${index})`,
    };
    const result = pagination(opts);
    expect(result).toContain(
      '<li class="page-item"><span class="page-link link-style" onclick="goToPage(1)" role="link">1</span></li>'
    );
    expect(result).toContain(
      '<li class="page-item active"><span class="page-link link-style" onclick="goToPage(2)" role="link">2</span></li>'
    );
    expect(result).toContain(
      '<li class="page-item"><span class="page-link link-style" onclick="goToPage(5)" role="link">5</span></li>'
    );
  });

  it("renders pagination with ellipsis", () => {
    const opts = {
      current_page: 10,
      pages: 20,
      get_page_link: (index: number) => `goToPage(${index})`,
      trailing_ellipsis: true,
    };
    const result = pagination(opts);
    expect(result).toContain(
      '<li class="page-item"><span class="page-link">...</span></li>'
    );
    expect(result).toContain(
      '<li class="page-item"><span class="page-link link-style" onclick="goToPage(20)" role="link">20</span></li>'
    );
  });
});

describe("dropdown_checkboxes", () => {
  it("renders dropdown checkboxes correctly", () => {
    const opts = {
      name: "testDropdown",
      options: [
        { label: "Option 1", value: "1" },
        { label: "Option 2", value: "2" },
      ],
      value: ["1"],
      form_name: "testDropdown",
      onChange: "handleDropdownChange()",
      btnClass: "btn-primary",
      btnLabel: "Select Options",
      items: [
        { label: "Option 1", value: "1" },
        { label: "Option 2", value: "2" },
      ],
      checked: { "1": true, "2": false },
    };
    const result = dropdown_checkboxes(opts);
  
    expect(result).toContain('<div class="dropdown">');
    expect(result).toContain('<button class="btn btn-primary dropdown-toggle"');
    expect(result).toContain('>Select Options</button>');
    expect(result).toContain('<ul class="dropdown-menu"');
    expect(result).toContain('<li class="dropdown-item">');
    expect(result).toContain('<div class="form-check">');
    expect(result).toContain(
      '<input class="form-check-input" type="checkbox" value="1" checked onChange="handleDropdownChange()">'
    );
    expect(result).toContain(
      '<input class="form-check-input" type="checkbox" value="2" onChange="handleDropdownChange()">'
    );
    expect(result).toContain(
      '<label class="form-check-label">Option 1</label>'
    );
    expect(result).toContain(
      '<label class="form-check-label">Option 2</label>'
    );
  });

  it("renders dropdown checkboxes correctly", () => {
    const opts = {
      name: "testDropdown",
      options: [
        { label: "Option 1", value: "1" },
        { label: "Option 2", value: "2" },
      ],
      value: "1",
      form_name: "testDropdown",
      onChange: "handleDropdownChange()",
      btnClass: "btn-primary",
      btnLabel: "Select Options",
      items: [
        { label: "Option 1", value: "1" },
        { label: "Option 2", value: "2" },
      ],
      checked: { "1": true, "2": false },
    };
    const result = dropdown_checkboxes(opts);
    expect(result).toContain('<div class="dropdown">');
    expect(result).toContain('<button class="btn btn-primary dropdown-toggle"');
    expect(result).toContain(">Select Options</button>");
    expect(result).toContain('<ul class="dropdown-menu"');

    expect(result).toContain('<li class="dropdown-item">');
    expect(result).toContain('<div class="form-check">');
    expect(result).toContain(
      '<input class="form-check-input" type="checkbox" value="1" checked onChange="handleDropdownChange()">'
    );
    expect(result).toContain(
      '<label class="form-check-label">Option 1</label>'
    );
    expect(result).toContain(
      '<input class="form-check-input" type="checkbox" value="2" onChange="handleDropdownChange()">'
    );
  });

  it("marks correct options as checked", () => {
    const opts = {
      name: "testDropdown",
      options: [
        { label: "Option 1", value: "1" },
        { label: "Option 2", value: "2" },
      ],
      value: "1",
      form_name: "testDropdown",
      onChange: "handleDropdownChange()",
      btnClass: "btn-primary",
      btnLabel: "Select Options",
      items: [
        { label: "Option 1", value: "1" },
        { label: "Option 2", value: "2" },
      ],
      checked: { "1": true, "2": false },
    };
    const result = dropdown_checkboxes(opts);

    expect(result).toContain('value="1" checked');
    expect(result).not.toContain('value="2" checked');
    expect(result).toContain('value="2"');
  });

  it("renders dropdown checkboxes with options", () => {
    const opts = {
      btnClass: "btn-primary",
      btnLabel: "Select Options",
      items: [
        { label: "Option 1", value: "1" },
        { label: "Option 2", value: "2" },
      ],
      checked: { "1": true, "2": false },
      onChange: "handleCheckboxChange()",
    };
    const result = dropdown_checkboxes(opts);
    expect(result).toContain('<div class="dropdown">');
    expect(result).toContain('class="btn btn-primary dropdown-toggle"');
    expect(result).toContain(">Select Options</button>");
    expect(result).toContain('<ul class="dropdown-menu"');
    expect(result).toContain('<input class="form-check-input" type="checkbox"');
    expect(result).toContain('value="1" checked');
    expect(result).toContain('value="2"');
    expect(result).toContain(
      '<label class="form-check-label">Option 1</label>'
    );
    expect(result).toContain(
      '<label class="form-check-label">Option 2</label>'
    );
  });

  it("renders dropdown checkboxes without checked items", () => {
    const opts = {
      btnClass: "btn-secondary",
      btnLabel: "Choose Items",
      items: ["Item A", "Item B"],
      checked: {},
    };
    const result = dropdown_checkboxes(opts);
    expect(result).toContain('<div class="dropdown">');
    expect(result).toContain('class="btn btn-secondary dropdown-toggle"');
    expect(result).toContain(">Choose Items</button>");
    expect(result).toContain('<ul class="dropdown-menu"');
    expect(result).toContain('<input class="form-check-input" type="checkbox"');
    expect(result).toContain('value="Item A"');
    expect(result).toContain('value="Item B"');
    expect(result).toContain('<label class="form-check-label">Item A</label>');
    expect(result).toContain('<label class="form-check-label">Item B</label>');
  });

  it("handles empty items gracefully", () => {
    const opts = {
      btnClass: "btn-outline-primary",
      btnLabel: "No Options",
      items: [],
      checked: {},
    };
    const result = dropdown_checkboxes(opts);
    expect(result).toContain('<div class="dropdown">');
    expect(result).toContain('class="btn btn-outline-primary dropdown-toggle"');
    expect(result).toContain(">No Options</button>");
    expect(result).toContain('<ul class="dropdown-menu"');
    expect(result).not.toContain('<input class="form-check-input"');
  });
});

describe("search_bar", () => {
  it("renders basic search bar", () => {
    const result = search_bar("search", "", { placeHolder: "Search..." });

    expect(result).toContain('<div class="input-group search-bar"');
    expect(result).toContain('<input type="search"');
    expect(result).toContain('class="form-control search-bar');
    expect(result).toContain('placeholder="Search..."');
    expect(result).toContain('name="search"');
    expect(result).toContain('aria-label="Search"');
    expect(result).toContain(
      '<button class="btn btn-outline-secondary search-bar"'
    );
    expect(result).toContain('<i class="fas fa-search"></i>');
  });

  it("renders a search bar with autofocus", () => {
    const result = search_bar("search", "", { autofocus: true });
    expect(result).toContain(
      '<input type="search" class="form-control search-bar"'
    );
    expect(result).toContain("autofocus");
  });

  it("renders a search bar with badges", () => {
    const badges = [{ text: "Badge 1" }, { text: "Badge 2" }];
    const result = search_bar("search", "", { badges });
    expect(result).toContain('<span class="badge bg-primary">Badge 1</span>');
    expect(result).toContain('<span class="badge bg-primary">Badge 2</span>');
  });

  it("renders a search bar with dropdown", () => {
    const result = search_bar("search", "", {
      has_dropdown: true,
      contents: "Dropdown Content",
    });
    expect(result).toContain(
      '<button class="btn btn-outline-secondary dropdown-toggle search-bar"'
    );
    expect(result).toContain('<div class="dropdown-menu search-bar p-2"');
    expect(result).toContain("Dropdown Content");
  });

  it("renders a search bar with a value", () => {
    const result = search_bar("search", "test value", {});
    expect(result).toContain('value="test value"');
  });

  it("renders a search bar with custom classes", () => {
    const result = search_bar("search", "", {
      hints: {
        searchBar: {
          inputClass: "custom-input",
          containerClass: "custom-container",
        },
      },
    });
    expect(result).toContain(
      '<div class="input-group custom-container search-bar"'
    );
    expect(result).toContain(
      '<input type="search" class="form-control search-bar custom-input"'
    );
  });

  it("renders a search bar with an icon button disabled", () => {
    const result = search_bar("search", "", {
      hints: { searchBar: { iconButton: false, iconClass: "custom-icon" } },
    });
    expect(result).toContain('<i class="fas fa-search custom-icon"></i>');
    expect(result).not.toContain(
      '<button class="btn btn-outline-secondary search-bar"'
    );
  });
});
