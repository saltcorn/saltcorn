const search_or_create = {
  type: "Key",
  isEdit: true,
  configFields: async (field) => {
    return [
      // which view to create with
      {
        name: "allow_input",
        label: "Allow input",
        type: "Bool",
      },
      {
        name: "day_only",
        label: "Only day",
        type: "Bool",
        //sublabel: "Do not pick time",
      },
    ];
  },
  run: (nm, v, attrs, cls, reqd, field) => {
    return "BOO";
  },
};
module.exports = { search_or_create };
