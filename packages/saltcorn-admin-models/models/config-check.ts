const { getState } = require("@saltcorn/data/db/state");
import Table from "@saltcorn/data/models/table";
import View from "@saltcorn/data/models/view";
import File from "@saltcorn/data/models/file";
import Page from "@saltcorn/data/models/page";
import Trigger from "@saltcorn/data/models/trigger";
import mocks from "@saltcorn/data/tests/mocks";

const { chaos_guinea_pig, set_seed } = require("chaos-guinea-pig");

// todo tests for files
// todo tests for tenants
/**
 * Test table
 * @param table
 * @param passes
 * @param errors
 */
const test_table = async (table: Table, passes: string[], errors: string[]) => {
  let hasErrors = false;
  const mkError = (s: string) => {
    errors.push(s);
    hasErrors = true;
  };
  try {
    const fields = await table.getFields();
    for (const field of fields) {
      if (!field.type) {
        mkError(
          `Field ${field.name} in table ${table.name} has no type. Uninstalled plugin?`
        );
        continue;
      }
      if (field.is_fkey && field.type !== "File") {
        const reftable = Table.findOne({ name: field.reftable_name });
        if (!reftable) {
          mkError(
            `Field ${field.name} in table ${table.name} reference table ${field.reftable_name} does not exist`
          );
          continue;
        }
        if (!field.attributes.summary_field) {
          mkError(
            `Field ${field.name} in table ${table.name} has no summary field`
          );
          continue;
        }
        const reftable_fields = await reftable.getFields();
        const summary_field = reftable_fields.find(
          (f) => f.name === field.attributes.summary_field
        );
        if (!summary_field) {
          mkError(
            `Field ${field.name} in table ${table.name} summary field ${field.attributes.summary_field} on does not exist on table ${reftable.name}`
          );
        }
      }
    }
    if (!hasErrors) passes.push(`Table ${table.name} OK`);
  } catch (e: any) {
    errors.push(`Table ${table.name} config: ${e.message}`);
  }
};
/**
 * Test view render
 * @param view
 * @param passes
 * @param errors
 * @param req
 * @param res
 */
const test_view_render = async (
  view: View,
  passes: string[],
  errors: string[],
  req: any,
  res: any
) => {
  try {
    const sfs = await view.get_state_fields();
    let nrenders = 0;
    if (view.table_id && sfs.some((f) => f.primary_key || f.name === "id")) {
      const table = Table.findOne({ id: view.table_id });
      const pk = table!.pk_name;
      const rows = await table!.getRows({}, { orderBy: "RANDOM()", limit: 5 });
      for (const row of rows) {
        nrenders += 1;
        await view.run({ [pk]: row[pk] }, { res, req });
      }
      if (sfs.every((f) => !f.required)) {
        nrenders += 1;
        await view.run({}, { res, req });
      }
    } else {
      nrenders += 1;
      await view.run({}, { res, req });
    }
    passes.push(`View ${view.name} x${nrenders} renders OK`);
  } catch (e: any) {
    errors.push(`View ${view.name} render: ${e.message}`);
  }
};
/**
 * Test view configuration
 * @param view
 * @param passes
 * @param errors
 * @param req
 * @param res
 * @param warnings
 */
const test_view_config = async (
  view: View,
  passes: string[],
  errors: string[],
  req: any,
  res: any,
  warnings: string[]
) => {
  try {
    let hasErrors = false;
    if (view.viewtemplateObj?.configCheck) {
      const errs: any = await view.viewtemplateObj?.configCheck(view);
      if (Array.isArray(errs) && errs.length > 0) {
        hasErrors = true;
        errors.push(...errs);
      } else if (!Array.isArray(errs) && errs?.errors && errs?.warnings) {
        if (errs.errors.length > 0) {
          hasErrors = true;
          errors.push(...errs.errors);
        }
        warnings.push(...errs.warnings);
      }
    }
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
    for (const step of configFlow.steps)
      await configFlow.run(
        {
          table_id: view.table_id,
          exttable_name: view.exttable_name,
          viewname: view.name,
          ...view.configuration,
          stepName: step.name,
        },
        req
      );
    if (!hasErrors) passes.push(`View ${view.name} config OK`);
  } catch (e: any) {
    errors.push(`View ${view.name} config: ${e.message}`);
  }
};
/**
 * Test trigger
 * @param trigger
 * @param passes
 * @param errors
 */
const test_trigger = async (
  trigger: Trigger,
  passes: string[],
  errors: string[]
) => {
  try {
    const action = getState().actions[trigger.action];
    if (!action) {
      errors.push(
        `Trigger ${trigger.name} action not found: ${trigger.action}`
      );
      return;
    }
    if (action.configCheck) {
      const table = trigger.table_id
        ? Table.findOne({ id: trigger.table_id })
        : undefined;
      const errs = await action.configCheck({ table, ...trigger });
      if (errs && Array.isArray(errs) && errs.length > 0) {
        errors.push(...errs);
      } else {
        passes.push(`Trigger ${trigger.name} config OK`);
      }
    }
  } catch (e: any) {
    errors.push(`Trigger ${trigger.name} config: ${e.message}`);
  }
};
/**
 * Run Configuration check
 * @param req
 */
export const runConfigurationCheck = async (
  req: any,
  destructive?: boolean,
  app?: any
) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const passes: string[] = [];
  const res = mocks.mockReqRes.res;

  const tables = await Table.find({});
  for (const table of tables) {
    await test_table(table, passes, errors);
  }

  const pages = await Page.find({});
  for (const page of pages) {
    try {
      await page.run({}, { res, req });
      passes.push(`Page ${page.name} renders OK`);
    } catch (e: any) {
      errors.push(`Page ${page.name}: ${e.message}`);
    }
  }
  const views = await View.find({});
  for (const view of views) {
    await test_view_render(view, passes, errors, req, res);
    await test_view_config(view, passes, errors, req, res, warnings);
  }
  const triggers = Trigger.find({});
  for (const trigger of triggers) {
    await test_trigger(trigger, passes, errors);
  }

  if (destructive) {
    if (!app) throw new Error("Destructive but app not supplied");
    const seed = set_seed();
    try {
      const gcpres = await chaos_guinea_pig(app);
      console.log("GCP Log", gcpres.log);
      passes.push(`Chaos Guinea Pig pass with seed ${seed}`);
    } catch (e: any) {
      errors.push(`Chaos Guinea Pig with seed ${seed}: ${e.message}`);
    }
  }

  return { errors, passes, pass: errors.length === 0, warnings };
};
