const { contract, is, auto_test } = require("contractis");
const { is_plugin_wrap, is_plugin } = require("./contracts");
const State = require("./db/state");
const { renderForm } = require("saltcorn-markup");

const auto_test_wrap = wrap => {
  auto_test(contract(is_plugin_wrap, wrap, { n: 5 }));
};

const generate_attributes = attrs => {
  var res = {};
  attrs.forEach(a => {
    if (a.required || is.bool.generate()) {
      const contract = a.type.contract || State.types[a.type].contract;
      const gen = contract.generate;
      if (gen) res[a.name] = gen();
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

  const has_contract = t.contract && t.contract.generate;
  const numex = has_contract ? 20 : 200;
  for (let index = 0; index < numex; index++) {
    const x = has_contract ? t.contract.generate() : t.read(is.any.generate());

    const attribs = generate_attributes(t.attributes);
    if (has_contract || (typeof x !== "undefined" && x !== null))
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
const auto_test_workflow = async (wf, initialCtx) => {
  const step = async (wf, ctx)=>{
    is.obj(ctx)
    const res = await wf.run(ctx);

    if (res.renderForm) {
      is.str(renderForm(res.renderForm));

      const vs=await res.renderForm.generate()
      return await step(wf, vs)
    } else return res
  }
  return await step(wf, initialCtx)
}
const auto_test_viewtemplate = async vt => {
  const wf = vt.configuration_workflow();
  is.class("Workflow")(wf);
  const cfg = await auto_test_workflow(wf, { table_id: 1, viewname: "newview" });

};

const auto_test_plugin = async plugin => {
  is_plugin(plugin);
  State.registerPlugin(plugin);
  if (plugin.layout) {
    auto_test_wrap(plugin.layout.wrap);
  }
  if (plugin.types) {
    plugin.types.forEach(auto_test_type);
  }
  for (const vt of plugin.viewtemplates || []) await auto_test_viewtemplate(vt);

  //is each header reachable
};

module.exports = { auto_test_plugin };
