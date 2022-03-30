// /toggle/:name/:id/:field_name
export const postToggleField = async (context) => {
  const { name, id, field_name } = context.params;
  try {
    await apiCall("POST", `/edit/toggle/${name}/${id}/${field_name}`);
    const redirect = new URLSearchParams(context.query).get("redirect");
    return { redirect };
  } catch (error) {
    // TODO ch message?
    return null;
  }
};
