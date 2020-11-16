const { Command, flags } = require("@oclif/command");

class TransformFieldCommand extends Command {
  async run() {
    const db = require("@saltcorn/data/db");
    const Table = require("@saltcorn/data/models/table");
    const { loadAllPlugins } = require("@saltcorn/server/load_plugins");
    const { getState, init_multi_tenant } = require("@saltcorn/data/db/state");

    const {
      get_async_expression_function,
    } = require("@saltcorn/data/models/expression");
    const { args } = this.parse(TransformFieldCommand);
    await loadAllPlugins();
    if (args.tenant && db.is_it_multi_tenant())
      await init_multi_tenant(loadAllPlugins);
    const tenant = args.tenant || db.connectObj.default_schema;
    await db.runWithTenant(tenant, async () => {
      const table = await Table.findOne({ name: args.table });
      const fields = await table.getFields();
      const field = fields.find((f) => f.name === args.field);
      if (!field) {
        console.error("field not found");
        this.exit(1);
      }

      const f = get_async_expression_function(args.expression, fields);
      const rows = await table.getRows();
      for (const row of rows) {
        row[args.field] = await f(row);
        await table.updateRow(row, row.id);
        console.log("updated row", row.id);
      }
    });
    this.exit(0);
  }
}

TransformFieldCommand.args = [
  {
    name: "expression",
    required: true,
    description: "expression to calculate field",
  },
  { name: "field", required: true, description: "field name" },
  { name: "table", required: true, description: "table name" },
  { name: "tenant", required: false, description: "tenant name" },
];

TransformFieldCommand.description = `transform an existing field by applying a calculated expression`;

TransformFieldCommand.flags = {};

module.exports = TransformFieldCommand;
