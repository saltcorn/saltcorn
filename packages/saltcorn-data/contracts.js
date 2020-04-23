const { contract, is } = require("contractis");

const fieldlike = is.obj({
  name: is.str,
  input_type: is.maybe(is.str),
  type: is.maybe(is.or(is.str, is.obj({ name: is.str })))
});

const is_plugin_wrap_arg = is.obj({
  title: is.str,
  body: is.str,
  menu: is.array(
    is.obj({
      section: is.maybe(is.str),
      items: is.array(is.obj({ label: is.str, link: is.maybe(is.str) }))
    })
  ),
  alerts: is.array(
    is.obj({
      type: is.one_of(["error", "danger", "success"]),
      msg: is.str
    })
  )
});

const is_plugin_wrap = is.fun(is_plugin_wrap_arg, is.str);

const is_plugin_type = is.obj({
  name: is.str,
  sql_name: is.str,
  fieldviews: is.objVals(
    is.obj(
      {
        isEdit: is.bool,
        run: is.or(
          is.fun(is.any, is.str),
          is.fun([is.str, is.any, is.maybe(is.obj()), is.str, is.bool], is.str)
        )
      }
      //o => (o.isEdit && o.run.length >=2) || (!o.isEdit && o.run.length == 1)
    )
  ),
  attributes: is.array(
    is.obj({ name: is.str, type: is.str, required: is.bool })
  ),
  readFromFormRecord: is.maybe(is.fun([is.obj(), is.str], is.any)),
  read: is.fun(is.any, is.any),
  validate: is.fun(is.obj(), is.fun(is.any, is.bool))
});

const is_viewtemplate = is.obj({
  name: is.str,
  get_state_fields: is.fun([is.posint, is.str, is.any], is.promise(fieldlike)),
  display_state_form: is.maybe(is.bool),
  configuration_workflow: is.fun([], is.class("Workflow")),
  view_quantity: is.maybe(is.one_of("Many", "ZeroOrOne", "One")),
  run: is.fun(
    [is.posint, is.str, is.any, is.obj(), is.obj()],
    is.promise(is.str)
  )
});

const is_plugin = is.obj({
  layout: is.maybe(
    is.obj({
      wrap: is_plugin_wrap
    })
  ),
  types: is.maybe(is.array(is_plugin_type)),
  viewtemplates: is.maybe(is.array(is_viewtemplate))
});

module.exports = {
  is_plugin_wrap,
  is_plugin_wrap_arg,
  is_plugin_type,
  is_plugin,
  fieldlike
};
