const search_or_create = {
  type: "Key",
  isEdit: true,
  configFields: [
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
  ],
  run: (nm, v, attrs, cls, reqd, field) => {},
};
module.exports = { search_or_create };
