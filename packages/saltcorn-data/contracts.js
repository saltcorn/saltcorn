const { contract, is } = require("contractis");

const is_plugin_wrap = is.fun(
  is.obj({
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
  }),
  is.str
);

const is_plugin_type = is.obj({
  name: is.str,
  sql_name: is.str,
  fieldviews: is.array(
    is.obj({
      isEdit: is.bool,
      run: is.fun(is.any, is.str)
    })
  ),
  attributes: is.array(
    is.obj({ name: is.str, type: is.str, required: is.bool })
  ),
  read: is.fun(is.any, is.any),
  validate: is.fun(is.obj(), is.fun(is.any, is.bool))
});

const is_plugin = is.obj({
  layout: is.maybe(
    is.obj({
      wrap: plugin_wrap
    })
  ),
  types: is.maybe(is.array(plugin_type))
});

module.exports = { is_plugin_wrap, is_plugin_type, is_plugin };
