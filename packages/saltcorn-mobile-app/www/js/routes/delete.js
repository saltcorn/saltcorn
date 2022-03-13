// post/delete/:name/:id
export const deleteRows = async (context) => {
  const { name, id } = context.params;
  const table = await saltcorn.data.models.Table.findOne({ name });
  try {
    await table.deleteRows({ id });
  } catch (error) {
    console.log("error while deleting");
    console.log(error);
  }
  return "";
};
