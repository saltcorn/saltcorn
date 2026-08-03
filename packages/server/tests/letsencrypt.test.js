/**
 * Tests for Saltcorn's LetsEncrypt/ACME plumbing.
 *
 * These cover what Saltcorn itself is responsible for: the guards on the
 * enable route, the greenlock site configuration it writes, and the config
 * flags that make serve.js take the greenlock path on the next restart. They
 * deliberately stop short of a real certificate: issuance belongs to greenlock
 * and cannot be exercised against a compliant ACME test server, because
 * @root/acme polls for the finished order by re-POSTing the finalize URL,
 * which RFC 8555 only allows while the order is `ready`. Let's Encrypt
 * tolerates it; Pebble answers 403 `orderNotReady` once the order is `valid`.
 *
 * Adding a greenlock site triggers an immediate certificate order, so
 * SALTCORN_ACME_DIRECTORY_URL is pointed at a closed local port for the whole
 * suite. Without it these tests would reach Let's Encrypt production.
 */
import { request } from "../auth/testhelp.js";
import getApp from "../app.js";
import User from "@saltcorn/data/models/user";
import db from "@saltcorn/data/db";
import { getState } from "@saltcorn/data/db/state";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  getAdminLoginCookie,
  toRedirect,
  resetToFixtures,
} from "../auth/testhelp.js";

// never reachable: a certificate order must fail locally rather than leave the
// machine. Port 1 is closed, so the attempt is refused immediately.
const UNREACHABLE_ACME = "https://127.0.0.1:1/dir";

const DOMAIN = "saltcorn-le-test.com";

const greenlockDir = () => join(db.connectObj.file_store, "greenlock.d");
const greenlockConfig = () => {
  const f = join(greenlockDir(), "config.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
};

let priorAcmeUrl;

afterAll(async () => {
  if (priorAcmeUrl === undefined)
    delete process.env.SALTCORN_ACME_DIRECTORY_URL;
  else process.env.SALTCORN_ACME_DIRECTORY_URL = priorAcmeUrl;
  await db.close();
});

beforeAll(async () => {
  priorAcmeUrl = process.env.SALTCORN_ACME_DIRECTORY_URL;
  process.env.SALTCORN_ACME_DIRECTORY_URL = UNREACHABLE_ACME;
  await resetToFixtures();
});

const enableLetsEncrypt = async (host) => {
  const app = await getApp({ disableCsrf: true });
  const loginCookie = await getAdminLoginCookie();
  return await request(app)
    .post("/admin/enable-letsencrypt")
    .set("Cookie", loginCookie)
    .set("Host", host)
    .expect(toRedirect("/useradmin/ssl"));
};

describe("LetsEncrypt enable guards", () => {
  it("refuses to enable without a base URL", async () => {
    await getState().setConfig("base_url", "");
    await enableLetsEncrypt(DOMAIN);

    expect(getState().getConfig("letsencrypt", false)).toBe(false);
    expect(greenlockConfig()).toBe(null);
  });

  it("refuses when the base URL does not match the request hostname", async () => {
    await getState().setConfig("base_url", `https://${DOMAIN}/`);
    // request arrives for a different host than the configured base URL
    await enableLetsEncrypt("someone-else.com");

    expect(getState().getConfig("letsencrypt", false)).toBe(false);
    expect(greenlockConfig()).toBe(null);
  });
});

describe("LetsEncrypt enable", () => {
  it("writes the greenlock site and turns the config on", async () => {
    await getState().setConfig("base_url", `https://${DOMAIN}/`);
    await enableLetsEncrypt(DOMAIN);

    const cfg = greenlockConfig();
    expect(cfg).toBeTruthy();

    // the site greenlock will request a certificate for
    expect(cfg.sites).toHaveLength(1);
    expect(cfg.sites[0].subject).toBe(DOMAIN);
    expect(cfg.sites[0].altnames).toContain(DOMAIN);

    // the subscriber greenlock registers the ACME account against: Saltcorn
    // uses the first admin user, and must have accepted the terms
    const admin = await User.findOne({ role_id: 1 });
    expect(cfg.defaults.subscriberEmail).toBe(admin.email);
    expect(cfg.defaults.agreeToTerms).toBe(true);

    // the override that keeps this test off the public internet
    expect(cfg.defaults.directoryUrl).toBe(UNREACHABLE_ACME);

    // what serve.js reads on the next boot
    expect(getState().getConfig("letsencrypt", false)).toBe(true);
    expect(getState().getConfig("tenant_letsencrypt_sites", [])).toContain(
      DOMAIN
    );
  });

  it("exposes the site to greenlock's own lookup, which serve.js gates on", async () => {
    // serve.js only hands over to greenlock-express when _find({}) is non-empty
    const require = (await import("module")).createRequire(import.meta.url);
    const Greenlock = require("greenlock");
    const greenlock = Greenlock.create({
      packageRoot: join(import.meta.dirname, "..", ".."),
      configDir: greenlockDir(),
      maintainerEmail: "admin@foo.com",
    });
    const sites = await greenlock._find({});
    expect(sites.length).toBeGreaterThan(0);
    expect(sites.map((s) => s.subject)).toContain(DOMAIN);
  });
});
