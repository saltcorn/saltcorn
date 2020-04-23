const { contract, is, auto_test } = require("contractis");
const { is_plugin_wrap, is_plugin } = require("./contracts");

const auto_test_wrap = wrap => {
  auto_test(contract(is_plugin_wrap, wrap, { n: 5 }));
};

const generate_attributes = attrs => {
  var res = {};
  attrs.forEach(a => {
    if (a.required || is.bool.generate()) {
      const gen = { String: is.str, Integer: is.int, Bool: is.bool }[a.type];
      if (gen) res[a.name] = gen.generate();
    }
  });
  return res;
};

const auto_test_type = t => {
  const fvs = t.fieldviews || {};

  //run edit field views without a value
  Object.values(fvs).forEach(fv => {
    if (fv.isEdit) {
      const attr = generate_attributes(t.attributes);
      is.str(fv.run("foo", undefined, attr, "myclass", true));
      is.str(fv.run("foo", undefined, attr, "myclass", false));
    }
  });
  //find examples, run all fieldview on each example
  const numex = t.generate ? 20 : 200;
  for (let index = 0; index < numex; index++) {
    const x = t.generate ? t.generate() : t.read(is.any.generate());

    const attribs = generate_attributes(t.attributes);
    if (typeof x !== "undefined" && x !== null)
      if ((t.validate && t.validate(attribs)(x)) || !t.validate) {
        Object.values(fvs).forEach(fv => {
          if (fv.isEdit) {
            is.str(fv.run("foo", x, attribs, "myclass", true));
            is.str(fv.run("foo", x, attribs, "myclass", false));
          } else {
            is.str(fv.run(x));
          }
        });
        if (t.readFromFormRecord) t.readFromFormRecord({ akey: x }, "akey");
      }
  }
  if (t.readFromFormRecord) {
    t.readFromFormRecord({}, "akey");
  }

  //todo: try creating a table with this type
};
const auto_test_plugin = plugin => {
  is_plugin(plugin);
  if (plugin.layout) {
    auto_test_wrap(plugin.layout.wrap);
  }
  if (plugin.types) {
    plugin.types.forEach(auto_test_type);
  }
};

module.exports = { auto_test_plugin };
