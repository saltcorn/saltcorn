const { contract, is } = require("contractis");

const fieldlike = is.obj(
  {
    name: is.str,
    input_type: is.maybe(is.str),
    type: is.maybe(is.or(is.str, is.obj({ name: is.str })))
  },
  o => o.type || o.input_type
);

const is_header = is.obj({ script: is.maybe(is.str) });

const is_menu_item = is.obj({
  label: is.str,
  link: is.maybe(is.str),
  subitems: is.maybe(
    is.array(
      is.obj({
        label: is.str,
        link: is.maybe(is.str)
      })
    )
  )
});

const is_layout_container = is.obj({ type: is.one_of("blank card pageHeader".split(' ')) });

const is_layout = is.obj(
  {
    above: is.maybe(
      is.array(
        is.or(
          is_layout_container,
          is.obj({ besides: is.array(is_layout_container) })
        )
      )
    ),
    besides: is.maybe(
      is.array(
        is.or(
          is_layout_container,
          is.obj({ above: is.array(is_layout_container) })
        )
      )
    )
  },
  l => (l.above && !l.besides) || (!l.above && l.besides)
);

const is_plugin_wrap_arg = is.obj({
  title: is.str,
  body: is.or(is.str, is_layout),
  currentUrl: is.str,
  brand: is.obj({ name: is.str }),
  menu: is.array(
    is.obj({
      section: is.str,
      items: is.array(is_menu_item)
    })
  ),
  alerts: is.array(
    is.obj({
      type: is.one_of(["error", "danger", "success", "warning"]),
      msg: is.or(is.str, is.array(is.str))
    })
  ),
  headers: is.array(is_header)
});

const is_plugin_wrap = is.fun(is_plugin_wrap_arg, is.str);

const is_attribute = is.obj({ name: is.str, type: is.str, required: is.bool });

const is_plugin_type = is.obj({
  name: is.str,
  sql_name: is.str,
  contract: is.maybe(is.fun(is.obj(), is.contract)),
  fieldviews: is.objVals(
    is.obj(
      {
        isEdit: is.bool,
        run: is.or(
          is.fun(is.any, is.str),
          is.fun([is.str, is.any, is.maybe(is.obj()), is.str, is.bool], is.str)
        )
      },
      o => (o.isEdit && o.run.length >= 2) || (!o.isEdit && o.run.length == 1)
    )
  ),
  attributes: is.maybe(is.array(is_attribute)),
  readFromFormRecord: is.maybe(is.fun([is.obj(), is.str], is.any)),
  read: is.fun(is.any, is.any),
  validate: is.maybe(is.fun(is.obj(), is.fun(is.any, is.bool))),
  presets: is.maybe(is.objVals(is.fun([], is.any)))
});

const is_table_query = is.obj({
  joinFields: is.maybe(is.objVals(is.obj({ ref: is.str, target: is.str }))),
  aggregations: is.maybe(
    is.objVals(
      is.obj({
        ref: is.str,
        table: is.str,
        field: is.str,
        aggregate: is.str
      })
    )
  ),
  where: is.maybe(is.obj()),
  limit: is.maybe(is.positive),
  offset: is.maybe(is.positive),
  orderBy: is.maybe(is.str),
  orderDesc: is.maybe(is.bool)
});

const is_viewtemplate = is.obj({
  name: is.str,
  get_state_fields: is.fun([is.posint, is.str, is.any], is.promise(fieldlike)),
  display_state_form: is.maybe(is.or(is.bool, is.fun(is.any, is.bool))),
  configuration_workflow: is.fun([], is.class("Workflow")),
  view_quantity: is.maybe(is.one_of("Many", "ZeroOrOne", "One")),
  initial_config: is.maybe(
    is.fun(is.obj({ table_id: is.posint }), is.promise(is.obj()))
  ),
  run: is.fun(
    [is.posint, is.str, is.any, is.obj(), is.obj()],
    is.promise(is.str)
  )
});

const is_plugin = is.obj({
  sc_plugin_api_version: is.posint,
  headers: is.maybe(is.array(is_header)),
  layout: is.maybe(
    is.obj({
      wrap: is_plugin_wrap
    })
  ),
  types: is.maybe(is.array(is_plugin_type)),
  pages: is.maybe(
    is.objVals(is.obj({ getPage: is.fun([], is.promise(is_layout)) }))
  ),
  viewtemplates: is.maybe(is.array(is_viewtemplate))
});

const is_pack = is.obj({
  tables: is.array(is.obj({ name: is.str, fields: is.array(fieldlike) })),
  views: is.array(
    is.obj({ name: is.str, viewtemplate: is.str, configuration: is.any })
  ),
  plugins: is.array(is.obj({ name: is.str, source: is.str, location: is.str }))
});
const is_column = is.obj({
  type: is.one_of(["Action", "ViewLink", "JoinField", "Aggregation", "Field"])
});
module.exports = {
  is_table_query,
  is_plugin_wrap,
  is_plugin_wrap_arg,
  is_plugin_type,
  is_plugin,
  fieldlike,
  is_viewtemplate,
  is_header,
  is_pack,
  is_column
};
