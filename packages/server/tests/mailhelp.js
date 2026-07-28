/**
 * Helpers for the SMTP/IMAP integration tests (tests/email_smtp.test.js).
 *
 * These tests talk to a real mail server running in a container - GreenMail,
 * which speaks SMTP, IMAP and POP3 and exposes a small REST API for resetting
 * state. Saltcorn sends through SMTP (nodemailer) and the test reads the
 * delivered message back over IMAP, so the whole send path is exercised
 * end-to-end rather than against a nodemailer mock.
 *
 * The suite is skipped unless SALTCORN_TEST_SMTP_HOST is set, so the normal
 * test runs (which have no mail server) are unaffected. whale-ci sets it in
 * the `email_tests` job; to run locally:
 *
 *   docker run -d --name sc-greenmail -p 3025:3025 -p 3143:3143 -p 8080:8080 \
 *     -e GREENMAIL_OPTS='-Dgreenmail.setup.test.all -Dgreenmail.hostname=0.0.0.0 \
 *        -Dgreenmail.users=saltcorn:scpassword@example.com' \
 *     greenmail/standalone:2.1.8
 *   SALTCORN_TEST_SMTP_HOST=localhost npx saltcorn run-tests server \
 *     -f tests/email_smtp.test.js
 *
 * Mailboxes are created by GreenMail on first delivery, with the login and the
 * password both set to the recipient address - so any address Saltcorn sends to
 * can be read back without provisioning it first.
 *
 * @category server
 * @module tests/mailhelp
 */
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { lookup } from "dns/promises";
import { getState } from "@saltcorn/data/db/state";

const envOr = (key, dflt) => process.env[key] || dflt;

/** SMTP/IMAP server hostname. Unset means: no mail server, skip the suite. */
const mailHost = () => process.env.SALTCORN_TEST_SMTP_HOST;

/** Whether a mail server was configured for this run. */
const mailTestsEnabled = () => !!mailHost();

console.log(
  `Mail tests ${mailTestsEnabled() ? "enabled" : "disabled"} (host: ${mailHost()})`
);

const smtpPort = () => +envOr("SALTCORN_TEST_SMTP_PORT", 3025);
const imapPort = () => +envOr("SALTCORN_TEST_IMAP_PORT", 3143);
const apiPort = () => +envOr("SALTCORN_TEST_MAIL_API_PORT", 8080);
const smtpUser = () => envOr("SALTCORN_TEST_SMTP_USER", "saltcorn");
const smtpPassword = () => envOr("SALTCORN_TEST_SMTP_PASSWORD", "scpassword");

/** The address Saltcorn sends from (the mailbox the SMTP user owns). */
const emailFrom = () =>
  envOr("SALTCORN_TEST_EMAIL_FROM", "saltcorn@example.com");

/**
 * Point Saltcorn's email settings at the containerised SMTP server. Called
 * once per suite, after resetToFixtures() has reset the config table.
 * @returns {Promise<void>}
 */
const configureSmtp = async () => {
  const state = getState();
  await state.setConfig("smtp_host", mailHost());
  await state.setConfig("smtp_port", smtpPort());
  await state.setConfig("smtp_secure", false);
  await state.setConfig("smtp_auth_method", "password");
  await state.setConfig("smtp_username", smtpUser());
  await state.setConfig("smtp_password", smtpPassword());
  await state.setConfig("email_from", emailFrom());
};

/**
 * The URL of the mail server's REST API, addressed by IP.
 *
 * GreenMail serves the API through Grizzly, which rejects a Host header
 * containing an underscore (RFC 3986 does not allow one in a reg-name) by
 * closing the connection - the client sees a bare "fetch failed". The host
 * here is a container hostname taken from the whale-ci step name, and those
 * do contain underscores, so resolve it first and address the API by IP,
 * which always yields a legal Host header. SMTP and IMAP are unaffected:
 * neither protocol sends a Host header.
 *
 * @param {string} path
 * @returns {Promise<string>}
 */
let apiAuthority;
const apiUrl = async (path) => {
  if (!apiAuthority) {
    const { address, family } = await lookup(mailHost());
    apiAuthority = `${family === 6 ? `[${address}]` : address}:${apiPort()}`;
  }
  return `http://${apiAuthority}${path}`;
};

/**
 * Delete all messages and restore the configured users. Call at the start of
 * each test so it does not see mail left by an earlier one.
 * @returns {Promise<void>}
 */
const resetMailServer = async () => {
  const url = await apiUrl("/api/service/reset");
  // the container announces itself in its log before the API port is bound,
  // so the first call of a run can arrive too early: retry briefly
  let lastError;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const res = await fetch(url, { method: "POST" });
      if (res.ok) return;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Could not reset mail server at ${url}: ${lastError}`);
};

/**
 * Read a mailbox over IMAP and return the messages, newest last.
 *
 * Each call opens its own connection: the suite polls for delivery, and a
 * fresh SELECT is the simplest way to see messages that arrived since the
 * previous poll.
 *
 * @param {string} address - recipient address; also the IMAP login
 * @param {object} [opts]
 * @param {string} [opts.password] - IMAP password (defaults to the address)
 * @param {string} [opts.mailbox] - mailbox to open, default INBOX
 * @returns {Promise<object[]>} parsed messages (mailparser output)
 */
const readMailbox = async (address, opts = {}) => {
  const client = new ImapFlow({
    host: mailHost(),
    port: imapPort(),
    secure: false,
    auth: { user: address, pass: opts.password || address },
    logger: false,
    // the suite polls, so a connection that cannot be made yet is not fatal
    emitLogs: false,
  });
  // a mailbox only exists once something has been delivered to it
  try {
    await client.connect();
  } catch (e) {
    return [];
  }
  const messages = [];
  let lock;
  try {
    lock = await client.getMailboxLock(opts.mailbox || "INBOX");
    if (client.mailbox.exists > 0)
      for await (const msg of client.fetch("1:*", { source: true }))
        messages.push(await simpleParser(msg.source));
  } finally {
    if (lock) lock.release();
    await client.logout();
  }
  return messages;
};

/**
 * Poll a mailbox until a message matching the predicate arrives.
 *
 * @param {string} address - recipient address
 * @param {object} [opts]
 * @param {string} [opts.subject] - require this exact subject
 * @param {function} [opts.match] - predicate on the parsed message
 * @param {number} [opts.timeout] - ms to wait, default 20000
 * @param {string} [opts.password] - IMAP password (defaults to the address)
 * @returns {Promise<object>} the parsed message
 * @throws if no matching message arrives before the timeout
 */
const waitForMail = async (address, opts = {}) => {
  const timeout = opts.timeout || 20000;
  const deadline = Date.now() + timeout;
  const matches = (msg) =>
    (!opts.subject || msg.subject === opts.subject) &&
    (!opts.match || opts.match(msg));
  let seen = [];
  while (Date.now() < deadline) {
    seen = await readMailbox(address, opts);
    const found = seen.find(matches);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const summary = seen.length
    ? seen.map((m) => JSON.stringify(m.subject)).join(", ")
    : "(mailbox empty)";
  throw new Error(
    `No matching mail for ${address} after ${timeout}ms. In mailbox: ${summary}`
  );
};

/**
 * Assert that no mail is delivered to an address within the given window.
 * Used for the negative cases (unknown address, "only if" formula false).
 *
 * @param {string} address - recipient address
 * @param {number} [waitMs] - how long to watch, default 2000
 * @returns {Promise<void>}
 */
const expectNoMail = async (address, waitMs = 2000) => {
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  const messages = await readMailbox(address);
  if (messages.length)
    throw new Error(
      `Expected no mail for ${address}, got ${messages.length}: ` +
        messages.map((m) => JSON.stringify(m.subject)).join(", ")
    );
};

/**
 * Extract the first href in an HTML body that contains `contains`. Used to
 * follow the links in reset-password and verification emails.
 * @param {string} html
 * @param {string} contains - substring the link must contain
 * @returns {string|null} the URL, HTML entities decoded
 */
const linkInHtml = (html, contains) => {
  for (const m of (html || "").matchAll(/href="([^"]+)"/g)) {
    const url = m[1].replaceAll("&amp;", "&");
    if (url.includes(contains)) return url;
  }
  return null;
};

export {
  mailTestsEnabled,
  mailHost,
  smtpPort,
  imapPort,
  smtpUser,
  smtpPassword,
  emailFrom,
  configureSmtp,
  resetMailServer,
  readMailbox,
  waitForMail,
  expectNoMail,
  linkInHtml,
};
