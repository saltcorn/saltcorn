const { getState } = require("@saltcorn/data/db/state");
import db from "@saltcorn/data/db/index";
import Table from "@saltcorn/data/models/table";
import { instanceOfErrorMsg } from "@saltcorn/types/common_types";
import View from "@saltcorn/data/models/view";
import File from "@saltcorn/data/models/file";
import Role from "@saltcorn/data/models/role";
import Page from "@saltcorn/data/models/page";
import Plugin from "@saltcorn/data/models/plugin";
import mocks from "@saltcorn/data/tests/mocks";

const test_view_render = async (
  view: View,
  passes: string[],
  errors: string[],
  req: any,
  res: any
) => {
  try {
    const sfs = await view.get_state_fields();
    if (view.table_id && sfs.some((f) => f.primary_key || f.name === "id")) {
      const table = Table.findOne({ id: view.table_id });
      const pk = table!.pk_name;
      const rows = await table!.getRows({}, { orderBy: "RANDOM()", limit: 5 });
      for (const row of rows) {
        await view.run({ [pk]: row[pk] }, { res, req });
      }
      if (sfs.every((f) => !f.required)) await view.run({}, { res, req });
    } else {
      await view.run({}, { res, req });
    }
    passes.push(`View ${view.name} renders OK`);
  } catch (e: any) {
    errors.push(`View ${view.name} render: ${e.message}`);
  }
};

const test_view_config = async (
  view: View,
  passes: string[],
  errors: string[],
  req: any,
  res: any
) => {
  try {
    const configFlow = await view.get_config_flow(req);
    await configFlow.run(
      {
        table_id: view.table_id,
        exttable_name: view.exttable_name,
        viewname: view.name,
        ...view.configuration,
      },
      req
    );
    passes.push(`View ${view.name} config OK`);
  } catch (e: any) {
    errors.push(`View ${view.name} config: ${e.message}`);
  }
};

export const runConfigurationCheck = async (req: any) => {
  const errors = [];
  const passes = [];
  const res = mocks.mockReqRes.res;
  //1. show all pages
  const pages = await Page.find({});
  for (const page of pages) {
    try {
      await page.run({}, { res, req });
      passes.push(`Page ${page.name} renders OK`);
    } catch (e: any) {
      errors.push(`Page ${page.name}: ${e.message}`);
    }
  }
  //2. views: show and run cfg editor
  const views = await View.find({});
  for (const view of views) {
    await test_view_render(view, passes, errors, req, res);
    await test_view_config(view, passes, errors, req, res);
  }

  return { errors, passes, pass: errors.length === 0 };
};
