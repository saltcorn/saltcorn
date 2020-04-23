const { contract, is } = require("contractis");

const auto_test_plugin = plugin => {
  is.obj({
    layout: is.maybe(
      is.obj({
        wrap: is.fun(
          is.obj({
            title: is.str,
            body: is.str,
            menu: is.array(
              is.obj({
                section: is.maybe(is.str),
                items: is.array(
                  is.obj({ label: is.str, link: is.maybe(is.str) })
                )
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
        )
      })
    ),
    types: is.maybe(
      is.array(
        is.obj({
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
        })
      )
    )
  })(plugin);
};

module.exports = { auto_test_plugin };
