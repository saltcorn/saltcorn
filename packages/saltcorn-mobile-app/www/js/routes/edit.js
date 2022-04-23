// /toggle/:name/:id/:field_name
export const postToggleField = async (context) => {
  const { name, id, field_name } = context.params;
  try {
    const table = await saltcorn.data.models.Table.findOne({ name });
    const state = saltcorn.data.state.getState();
    if (state.localTableIds.indexOf(table.id) >= 0) {
      await table.toggleBool(+id, field_name);
    } else {
      await apiCall({
        method: "POST",
        path: `/edit/toggle/${name}/${id}/${field_name}`,
      });
    }
    const redirect = new URLSearchParams(context.query).get("redirect");
    return { redirect };
  } catch (error) {
    // TODO ch message?
    return null;
  }
};
