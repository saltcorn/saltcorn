// /toggle/:name/:id/:field_name
export const postToggleField = async (context) => {
  const { name, id, field_name } = context.params;
  const table = await saltcorn.data.models.Table.findOne({ name });
  await table.toggleBool(+id, field_name);
  return "";
};
