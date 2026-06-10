/**
 * Tests for the field help_text / tooltip feature.
 *
 * Uses mkFormContentNoLayout and mkForm directly so we can pass plain
 * field objects without importing AbstractForm (which has a broken type
 * path in the standalone package install).
 */
import { describe, it, expect } from "@jest/globals";
import index from "./index";
const { mkFormContentNoLayout, mkForm } = index;

// ── helpers ────────────────────────────────────────────────────────────────

/** Collapse all whitespace / newlines so HTML comparisons aren't fragile. */
const flat = (s: string) => s.replace(/\s+/g, " ").trim();

/** A minimal form field with no help_text. */
const baseField = (overrides: Record<string, any> = {}) => ({
  name: "email",
  label: "Email",
  input_type: "text" as const,
  form_name: "email",
  required: false,
  attributes: {},
  is_fkey: false,
  ...overrides,
});

/** A minimal form shape accepted by mkForm / mkFormContentNoLayout. */
const baseForm = (fields: any[], overrides: Record<string, any> = {}) => ({
  action: "/",
  fields,
  errors: {},
  values: {},
  formStyle: "vert",
  methodGET: false,
  xhrSubmit: false,
  req: {},
  viewname: "testform",
  ...overrides,
});

// ── tests ──────────────────────────────────────────────────────────────────

describe("help_text tooltip icon", () => {
  it("is NOT rendered when help_text is absent", () => {
    const form = baseForm([baseField()]);
    const html = mkFormContentNoLayout(form);
    expect(html).not.toContain("fa-info-circle");
    expect(html).not.toContain("data-bs-toggle");
  });

  it("is NOT rendered when help_text is an empty string", () => {
    const form = baseForm([baseField({ help_text: "" })]);
    const html = mkFormContentNoLayout(form);
    expect(html).not.toContain("fa-info-circle");
  });

  it("renders a tooltip icon when help_text is set", () => {
    const form = baseForm([baseField({ help_text: "Enter your email address" })]);
    const html = mkFormContentNoLayout(form);
    expect(html).toContain("fa-info-circle");
    expect(html).toContain('data-bs-toggle="tooltip"');
  });

  it("puts the help_text value in the title attribute", () => {
    const form = baseForm([
      baseField({ help_text: "Enter your email address" }),
    ]);
    const html = mkFormContentNoLayout(form);
    expect(html).toContain('title="Enter your email address"');
  });

  it("HTML-escapes special characters in help_text", () => {
    const form = baseForm([
      baseField({ help_text: 'Use format "user@example.com"' }),
    ]);
    const html = mkFormContentNoLayout(form);
    // text_attr escapes double quotes to &#34; or &quot;
    expect(html).not.toContain('title="Use format "user@example.com""');
    expect(html).toContain("title=");
    // The escaped version must appear (exact entity depends on text_attr impl)
    expect(flat(html)).toMatch(/title="Use format (&quot;|&#34;|\\")user@example\.com/);
  });

  it("places the icon inside the label div (next to the label text)", () => {
    const form = baseForm([
      baseField({ help_text: "Tooltip content here" }),
    ]);
    const html = mkFormContentNoLayout(form);
    // The label div should contain both the label text AND the icon
    const labelDivMatch = html.match(
      /<div[^>]*>[\s\S]*?<label[^>]*>Email<\/label>[\s\S]*?fa-info-circle[\s\S]*?<\/div>/
    );
    expect(labelDivMatch).not.toBeNull();
  });

  it("icon appears for a Bool field (checkbox) which uses a different render path", () => {
    const form = baseForm([
      {
        ...baseField(),
        name: "active",
        label: "Active",
        form_name: "active",
        input_type: "checkbox" as const,
        type: { name: "Bool" },
        help_text: "Whether this record is active",
      },
    ]);
    const html = mkFormContentNoLayout(form);
    expect(html).toContain("fa-info-circle");
    expect(html).toContain('title="Whether this record is active"');
  });

  it("does not affect fields without help_text in a multi-field form", () => {
    const form = baseForm([
      baseField({ name: "email", form_name: "email", label: "Email", help_text: "Your email" }),
      baseField({ name: "name",  form_name: "name",  label: "Name"  }), // no help_text
    ]);
    const html = mkFormContentNoLayout(form);
    // Exactly one tooltip icon — for the email field only
    const iconMatches = html.match(/fa-info-circle/g) || [];
    expect(iconMatches.length).toBe(1);
    expect(html).toContain('title="Your email"');
  });

  it("renders correctly via mkForm (full form wrapper)", () => {
    const form = baseForm([
      baseField({ help_text: "Full form test" }),
    ]);
    const html = mkForm(form, "csrf123");
    expect(html).toContain("fa-info-circle");
    expect(html).toContain('title="Full form test"');
    expect(html).toContain('data-bs-placement="right"');
  });
});
