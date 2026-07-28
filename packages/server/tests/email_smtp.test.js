/**
 * End-to-end email tests against an SMTP/IMAP server (GreenMail in a
 * container). Saltcorn sends over SMTP; the test reads the delivered message
 * back over IMAP and asserts on the parsed MIME. Nothing is mocked, so this
 * covers the parts the unit tests cannot: SMTP auth, MIME encoding, headers,
 * attachments, and the delivery side of the routes that send mail.
 *
 * Skipped unless SALTCORN_TEST_SMTP_HOST is set - see tests/mailhelp.js for
 * how to run it locally.
 */
import { request } from "../auth/testhelp.js";
import getApp from "../app.js";
import Table from "@saltcorn/data/models/table";
import Field from "@saltcorn/data/models/field";
import View from "@saltcorn/data/models/view";
import User from "@saltcorn/data/models/user";
import File from "@saltcorn/data/models/file";
import Notification from "@saltcorn/data/models/notification";
import db from "@saltcorn/data/db";
import { getState } from "@saltcorn/data/db/state";
import { getMailTransport } from "@saltcorn/data/models/email";
import { send_verification_email } from "@saltcorn/data/models/email";
import { mockReqRes } from "@saltcorn/data/tests/mocks";
import {
  getAdminLoginCookie,
  toRedirect,
  toSucceed,
  toInclude,
  resetToFixtures,
} from "../auth/testhelp.js";
import {
  mailTestsEnabled,
  configureSmtp,
  resetMailServer,
  waitForMail,
  expectNoMail,
  linkInHtml,
  emailFrom,
} from "./mailhelp.js";

// no mail server for this run (the normal sqlite/postgres/mysql jobs): skip
const describeMail = mailTestsEnabled() ? describe : describe.skip;

const BASE_URL = "http://example.com/";

afterAll(async () => {
  await db.close();
});

beforeAll(async () => {
  if (!mailTestsEnabled()) return;
  await resetToFixtures();
  await configureSmtp();
  await getState().setConfig("base_url", BASE_URL);
});

beforeEach(async () => {
  if (!mailTestsEnabled()) return;
  await resetMailServer();
});

/**
 * A table + Show view used as the body of the send_email action, plus a File
 * field for the attachment case and a Bool field for the confirmation case.
 * Created once, lazily, by the tests that need it.
 */
let contactsTable;
const mkContacts = async () => {
  if (contactsTable) return contactsTable;
  const table = await Table.create("email_contacts");
  await Field.create({ table, name: "name", label: "Name", type: "String" });
  await Field.create({ table, name: "address", label: "Address", type: "String" });
  await Field.create({ table, name: "notes", label: "Notes", type: "String" });
  await Field.create({ table, name: "doc", label: "Doc", type: "File" });
  await Field.create({ table, name: "was_sent", label: "Was sent", type: "Bool" });
  await View.create({
    table_id: table.id,
    name: "email_contact_body",
    viewtemplate: "Show",
    configuration: {
      columns: [
        { type: "Field", field_name: "name" },
        { type: "Field", field_name: "notes" },
      ],
      layout: {
        above: [
          { type: "field", fieldview: "as_text", field_name: "name" },
          { type: "field", fieldview: "as_text", field_name: "notes" },
        ],
      },
    },
    min_role: 100,
  });
  contactsTable = table;
  return table;
};

const runSendEmail = async (configuration, row, table) =>
  await getState().actions.send_email.run({
    row,
    table,
    configuration,
    user: { id: 1, email: "admin@foo.com", role_id: 1 },
    req: mockReqRes.req,
  });

describeMail("Email delivery over SMTP", () => {
  it("delivers a message sent through the mail transport", async () => {
    const transport = await getMailTransport();
    const res = await transport.sendMail({
      from: emailFrom(),
      to: "recipient@foo.com",
      subject: "Transport test",
      html: "<div>Hello <b>World</b></div>",
    });
    expect(res.accepted).toContain("recipient@foo.com");

    const msg = await waitForMail("recipient@foo.com", {
      subject: "Transport test",
    });
    expect(msg.from.value[0].address).toBe(emailFrom());
    expect(msg.to.value[0].address).toBe("recipient@foo.com");
    expect(msg.html).toContain("Hello <b>World</b>");
  });

  it("delivers to cc and bcc without disclosing the bcc address", async () => {
    const transport = await getMailTransport();
    await transport.sendMail({
      from: emailFrom(),
      to: "primary@foo.com",
      cc: "copied@foo.com",
      bcc: "hidden@foo.com",
      subject: "Carbon copies",
      text: "one message, three recipients",
    });

    for (const addr of ["primary@foo.com", "copied@foo.com", "hidden@foo.com"]) {
      const msg = await waitForMail(addr, { subject: "Carbon copies" });
      expect(msg.text).toContain("one message, three recipients");
      expect(msg.cc.value[0].address).toBe("copied@foo.com");
      // bcc recipients must not appear in the delivered headers
      expect(msg.headers.has("bcc")).toBe(false);
    }
  });

  it("encodes non-ascii subjects and bodies", async () => {
    const transport = await getMailTransport();
    await transport.sendMail({
      from: emailFrom(),
      to: "utf8@foo.com",
      subject: "Grüße aus Köln – 日本語",
      text: "Füße, Straße, 日本語",
    });
    const msg = await waitForMail("utf8@foo.com", {
      subject: "Grüße aus Köln – 日本語",
    });
    expect(msg.text).toContain("Füße, Straße, 日本語");
  });
});

describeMail("send_email action", () => {
  it("sends a view-rendered body to a fixed address", async () => {
    const table = await mkContacts();
    const id = await table.insertRow({
      name: "Ada Lovelace",
      address: "ada@foo.com",
      notes: "first programmer",
    });
    const row = await table.getRow({ id });

    const res = await runSendEmail(
      {
        viewname: "email_contact_body",
        subject: "Fixed address email",
        to_email: "Fixed",
        to_email_fixed: "fixed@foo.com",
      },
      row,
      table
    );
    expect(res.notify).toBe("E-mail sent to fixed@foo.com");

    const msg = await waitForMail("fixed@foo.com", {
      subject: "Fixed address email",
    });
    expect(msg.from.value[0].address).toBe(emailFrom());
    expect(msg.html).toContain("Ada Lovelace");
    expect(msg.html).toContain("first programmer");
    // the body is rendered through mjml
    expect(msg.html).toContain("<!doctype html>");
  });

  it("sends to the address held in a field", async () => {
    const table = await mkContacts();
    const id = await table.insertRow({
      name: "Grace Hopper",
      address: "grace@foo.com",
      notes: "compilers",
    });
    const row = await table.getRow({ id });

    await runSendEmail(
      {
        viewname: "email_contact_body",
        subject: "Field address email",
        to_email: "Field",
        to_email_field: "address",
      },
      row,
      table
    );

    const msg = await waitForMail("grace@foo.com", {
      subject: "Field address email",
    });
    expect(msg.html).toContain("Grace Hopper");
  });

  it("interpolates the subject and the to address", async () => {
    const table = await mkContacts();
    const id = await table.insertRow({
      name: "Alan Turing",
      address: "alan@foo.com",
      notes: "halting",
    });
    const row = await table.getRow({ id });

    await runSendEmail(
      {
        viewname: "email_contact_body",
        subject: "`Hello ${name}`",
        subject_formula: true,
        to_email: "Fixed",
        to_email_fixed: "{{ address }}",
      },
      row,
      table
    );

    const msg = await waitForMail("alan@foo.com", {
      subject: "Hello Alan Turing",
    });
    expect(msg.to.value[0].address).toBe("alan@foo.com");
  });

  it("does not send when the only-if formula is false", async () => {
    const table = await mkContacts();
    const id = await table.insertRow({
      name: "Nobody",
      address: "nobody@foo.com",
      notes: "skip me",
    });
    const row = await table.getRow({ id });

    const res = await runSendEmail(
      {
        viewname: "email_contact_body",
        subject: "Should not arrive",
        to_email: "Fixed",
        to_email_fixed: "nobody@foo.com",
        only_if: "name === 'Somebody'",
      },
      row,
      table
    );
    expect(res).toBeUndefined();
    await expectNoMail("nobody@foo.com");
  });

  it("attaches a file from a File field", async () => {
    const table = await mkContacts();
    const file = await File.findOne({ filename: "magrite.png" });
    expect(file).toBeTruthy();
    const id = await table.insertRow({
      name: "With attachment",
      address: "attach@foo.com",
      notes: "see attached",
      doc: file.path_to_serve,
    });
    const row = await table.getRow({ id });

    await runSendEmail(
      {
        viewname: "email_contact_body",
        subject: "Email with attachment",
        to_email: "Fixed",
        to_email_fixed: "attach@foo.com",
        attachment_path: "doc",
      },
      row,
      table
    );

    const msg = await waitForMail("attach@foo.com", {
      subject: "Email with attachment",
    });
    expect(msg.attachments).toHaveLength(1);
    expect(msg.attachments[0].filename).toBe("magrite.png");
    expect(msg.attachments[0].content.toString()).toBe("cecinestpasunpng");
  });

  it("sets the confirmation field once the message is accepted", async () => {
    const table = await mkContacts();
    const id = await table.insertRow({
      name: "Confirm me",
      address: "confirm@foo.com",
      notes: "confirmation",
    });
    const row = await table.getRow({ id });

    await runSendEmail(
      {
        viewname: "email_contact_body",
        subject: "Confirmed email",
        to_email: "Fixed",
        to_email_fixed: "confirm@foo.com",
        confirm_field: "was_sent",
      },
      row,
      table
    );

    await waitForMail("confirm@foo.com", { subject: "Confirmed email" });
    const updated = await table.getRow({ id });
    expect(updated.was_sent).toBe(true);
  });
});

describeMail("password reset email", () => {
  it("delivers a reset link that can be used to set a new password", async () => {
    await getState().setConfig("allow_forgot", true);
    const app = await getApp({ disableCsrf: true });

    await request(app)
      .post("/auth/forgot")
      .send("email=staff@foo.com")
      .expect(toRedirect("/auth/login"));

    const msg = await waitForMail("staff@foo.com", {
      subject: "Reset password instructions",
    });
    expect(msg.from.value[0].address).toBe(emailFrom());
    expect(msg.text).toContain("auth/reset?token=");

    const link = linkInHtml(msg.html, "/auth/reset?token=");
    expect(link).toBeTruthy();
    const token = new URL(link).searchParams.get("token");

    // the link renders the reset form
    await request(app)
      .get(link.replace(BASE_URL.replace(/\/$/, ""), ""))
      .expect(toSucceed())
      .expect(toInclude("Enter your new password below"));

    await request(app)
      .post("/auth/reset")
      .send("email=staff@foo.com")
      .send("password=jTf5Rr3wQq8x")
      .send("confirm_password=jTf5Rr3wQq8x")
      .send("token=" + token)
      .expect(toRedirect("/auth/login"));

    await request(app)
      .post("/auth/login/")
      .send("email=staff@foo.com")
      .send("password=jTf5Rr3wQq8x")
      .expect(toRedirect("/"));
  });

  it("sends a welcome email when an admin creates a user", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .post("/useradmin/save")
      .set("Cookie", loginCookie)
      .send("email=newcomer@foo.com")
      .send("role_id=80")
      .send("rnd_password=on")
      .send("send_pwreset_email=on")
      .expect(toRedirect("/useradmin"));

    const msg = await waitForMail("newcomer@foo.com", {
      match: (m) => (m.text || "").includes("auth/reset?token="),
    });
    expect(msg.html).toContain("Change my password");
  });
});

describeMail("verification email", () => {
  it("delivers a link that verifies the address", async () => {
    await View.create({
      name: "verify_email_view",
      viewtemplate: "Show",
      table_id: Table.findOne({ name: "users" }).id,
      configuration: {
        columns: [
          { type: "Field", fieldview: "as_text", field_name: "email" },
          {
            type: "Field",
            fieldview: "as_text",
            field_name: "verification_url",
          },
        ],
        layout: {
          above: [
            { type: "field", fieldview: "as_text", field_name: "email" },
            {
              type: "field",
              fieldview: "as_text",
              field_name: "verification_url",
            },
          ],
        },
      },
      min_role: 100,
    });
    await getState().setConfig("verification_view", "verify_email_view");

    const user = await User.findOne({ email: "user@foo.com" });
    const token = "verifytoken1234567890";
    const res = await send_verification_email(user, undefined, {
      new_verification_token: token,
    });
    expect(res).toBe(true);

    const msg = await waitForMail("user@foo.com", {
      subject: "Please verify your email address",
    });
    expect(msg.html).toContain(token);

    const app = await getApp({ disableCsrf: true });
    await request(app)
      .get(`/auth/verify?token=${token}&email=user%40foo.com`)
      .expect(toRedirect("/"));

    const verified = await User.findOne({ email: "user@foo.com" });
    expect(verified.verified_on).toBeTruthy();
  });
});

describeMail("admin email settings", () => {
  it("sends the test email from the admin page", async () => {
    const app = await getApp({ disableCsrf: true });
    const loginCookie = await getAdminLoginCookie();
    await request(app)
      .get("/admin/send-test-email")
      .set("Cookie", loginCookie)
      .expect(toRedirect("/admin/email"));

    const msg = await waitForMail("admin@foo.com", {
      subject: "Saltcorn test email",
    });
    expect(msg.html).toContain("Hello from Saltcorn");
  });
});

describeMail("notification emails", () => {
  it("emails the user when a notification is created", async () => {
    const user = await User.findOne({ email: "user@foo.com" });
    await user.update({ _attributes: { notify_email: true } });
    await getState().setConfig("mail_throttle_per_user", 0);
    await getState().refresh_config();

    await Notification.create({
      title: "Notification by email",
      body: "something happened",
      link: `${BASE_URL}view/authorlist`,
      created: new Date(),
      user_id: user.id,
    });

    const msg = await waitForMail("user@foo.com", {
      subject: "Notification by email",
    });
    expect(msg.text).toContain("something happened");
    expect(msg.html).toContain(`${BASE_URL}view/authorlist`);
  });
});
