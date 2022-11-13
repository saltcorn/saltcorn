import db from "@saltcorn/data/db/index";
import Plugin from "@saltcorn/data/models/plugin";
const {
  getState,
  add_tenant,
  init_multi_tenant,
  restart_tenant,
} = require("@saltcorn/data/db/state");
getState().registerPlugin("base", require("@saltcorn/data/base-plugin"));
import tenant from "../models/tenant";
const {
  create_tenant,
  deleteTenant,
  getAllTenants,
  switchToTenant,
  insertTenant,
  Tenant,
  getAllTenantRows,
  eachTenant,
} = tenant;
import config from "@saltcorn/data/models/config";
const { getConfig } = config;
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

afterAll(db.close);

beforeAll(async () => {
  if (!db.isSQLite) await db.query(`drop schema if exists test10 CASCADE `);
  if (!db.isSQLite) await db.query(`drop schema if exists test11 CASCADE `);
});

describe("Tenant", () => {

  if (!db.isSQLite) {
    it("can create a new tenant", async () => {
      db.enable_multi_tenant();
      await getState().setConfig("base_url", "http://example.com/");
      await switchToTenant(
          await insertTenant("test10", "foo@foo.com", "tenant test10 will be template for test11"),
          "http://test10.example.com/"
      );
      add_tenant("test10");
      await create_tenant({
        t: "test10",
        loadAndSaveNewPlugin(plugin: Plugin): void {
        }, plugin_loader() {
        },
      });
      db.runWithTenant("test10", async () => {
        const ten = db.getTenantSchema();

        expect(ten).toBe("test10");
        // test base url
        const base = await getConfig("base_url");
        expect(base).toBe("http://test10.example.com/");
      });
    });

    it("check tenant list", async () => {
      const tens = await getAllTenants();
      expect(tens).toContain("test10");
      expect(tens).not.toContain("public");
      await init_multi_tenant(() => {}, undefined, tens);
    });

    it("can update template", async () => {
      await Tenant.update("test10",{description:"new description 123"});
      const t = await Tenant.findOne({subdomain:"test10"});
      expect(t?.description).toBe("new description 123")
    });

    it("can create a new tenant with template without description", async () => {
      await getState().setConfig("tenant_template", "test10");

      const tenant_template = getState().getConfig("tenant_template");
      await switchToTenant(
          await insertTenant("test11", undefined, undefined, tenant_template),
          "http://test11.example.com/"
      );
      add_tenant("test11");

      await create_tenant({
        t: "test11",
        loadAndSaveNewPlugin(plugin: Plugin): void {
        }, plugin_loader() {
        },
        tenant_template,
      });
      // check template
      const t = await Tenant.findOne({subdomain: "test11"});
      expect(t?.template).toBe(tenant_template);
    });

    it("can find tenant", async () => {
      const ten = await Tenant.find({subdomain:"test11"});
      expect(ten[0]?.subdomain).toContain("test11");
    });

    it("can get all tenant rows", async () => {
      const tens = await getAllTenantRows();
      expect(tens[0]?.subdomain).toContain("test10");
    });

    it("can run function for each tenant", async () => {
      await eachTenant(async () => {
        const domain = db.getTenantSchema();
        expect(domain).toBeDefined();
      });
    });

    it("can restart a tenant", async () => {
      await db.runWithTenant("test10", async () => {
        await restart_tenant(() => {});
      });
    });

    it("can delete a tenant", async () => {
      db.enable_multi_tenant();
      await deleteTenant("test10");
    });

  } else {
    it("does not support tenants on SQLite", async () => {
      expect(db.isSQLite).toBe(true);
    });
  }
});
