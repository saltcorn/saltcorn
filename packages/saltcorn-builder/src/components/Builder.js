import React, { useEffect, useContext, Fragment } from "react";
import { Editor, Frame, Canvas, Selector, useEditor } from "@craftjs/core";
import { Text } from "./elements/Text";
import { Field } from "./elements/Field";
import { JoinField } from "./elements/JoinField";
import { Aggregation } from "./elements/Aggregation";
import { LineBreak } from "./elements/LineBreak";
import { ViewLink } from "./elements/ViewLink";
import { TwoSplit } from "./elements/TwoSplit";
import { Action } from "./elements/Action";
import { Empty } from "./elements/Empty";
import optionsCtx from "./context";
import { craftToSaltcorn, layoutToNodes } from "./storage";

const { Provider } = optionsCtx;

const headOr = (xs, def) => (xs && xs.length > 0 ? xs[0] : def);

const Toolbox = () => {
  const { connectors, query } = useEditor();
  const options = useContext(optionsCtx);
  const {
    fields,
    field_view_options,
    child_field_list,
    agg_field_opts
  } = options;
  return (
    <Fragment>
      <h6>Drag to add</h6>
      <table className="mb-3">
        <tbody>
          <tr>
            <td>
              <button
                ref={ref =>
                  connectors.create(
                    ref,
                    <Text text="Hello world" block={false} textStyle={""} />
                  )
                }
              >
                Text
              </button>
            </td>
            <td>
              <button
                ref={ref =>
                  connectors.create(
                    ref,
                    <TwoSplit left={<Empty />} right={<Empty />} />
                  )
                }
              >
                ||
              </button>
            </td>
          </tr>
          <tr>
            <td>
              <button
                ref={ref =>
                  connectors.create(
                    ref,
                    <Field
                      name={fields[0].name}
                      block={false}
                      textStyle={""}
                      fieldview={
                        fields[0].is_fkey
                          ? ""
                          : field_view_options[fields[0].name][0]
                      }
                    />
                  )
                }
              >
                Field
              </button>
            </td>
            <td>
              <button
                ref={ref =>
                  connectors.create(
                    ref,
                    <JoinField
                      name={options.parent_field_list}
                      textStyle={""}
                      block={false}
                    />
                  )
                }
              >
                Join
              </button>
            </td>
          </tr>
          <tr>
            <td>
              <button
                ref={ref =>
                  connectors.create(
                    ref,
                    <ViewLink
                      name={options.link_view_opts[0].name}
                      block={false}
                      minRole={10}
                    />
                  )
                }
              >
                Link
              </button>
            </td>
            <td>
              <button
                ref={ref =>
                  connectors.create(
                    ref,
                    <Action
                      name={options.actions[0]}
                      block={false}
                      minRole={10}
                    />
                  )
                }
              >
                Action
              </button>
            </td>
          </tr>
          <tr>
            <td>
              <button ref={ref => connectors.create(ref, <LineBreak />)}>
                ↵
              </button>
            </td>
            <td>
              <button
                ref={ref =>
                  connectors.create(
                    ref,
                    <Aggregation
                      agg_relation={child_field_list[0]}
                      agg_field={headOr(
                        agg_field_opts[child_field_list[0]],
                        ""
                      )}
                      stat={"Count"}
                      textStyle={""}
                      block={false}
                    />
                  )
                }
              >
                ∑
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </Fragment>
  );
};

const SettingsPanel = () => {
  const { actions, selected } = useEditor((state, query) => {
    const currentNodeId = state.events.selected;
    let selected;

    if (currentNodeId) {
      selected = {
        id: currentNodeId,
        name: state.nodes[currentNodeId].data.name,
        settings:
          state.nodes[currentNodeId].related &&
          state.nodes[currentNodeId].related.settings,
        isDeletable: query.node(currentNodeId).isDeletable()
      };
    }

    return {
      selected
    };
  });

  return <div className="settings-panel">
      <h6>Settings</h6>
      {selected ? <Fragment>
      {selected.settings && React.createElement(selected.settings)}
      {selected.isDeletable && (
        <button
          onClick={() => {
            actions.delete(selected.id);
          }}
        >
          Delete
        </button>
      )}</Fragment> : "No element selected" }
    </div>;
};

const SaveButton = ({ layout }) => {
  const { query, actions } = useEditor(() => {});
  useEffect(() => {
    layoutToNodes(layout, query, actions);
  }, []);
  const onClick = () => {
    const { columns, layout } = craftToSaltcorn(JSON.parse(query.serialize()));
    document
      .querySelector("form#scbuildform input[name=columns]")
      .setAttribute("value", encodeURIComponent(JSON.stringify(columns)));
    document
      .querySelector("form#scbuildform input[name=layout]")
      .setAttribute("value", encodeURIComponent(JSON.stringify(layout)));
    document.getElementById("scbuildform").submit();
  };
  return (
    <button className="btn btn-primary" onClick={onClick}>
      Save
    </button>
  );
};

const Builder = ({ options, layout }) => {
  return (
    <Editor>
      <Provider value={options}>
        <div className="row">
          <div className="col-sm-9">
            <h6>View canvas</h6>
            <Frame
              resolver={{
                Text,
                Empty,
                TwoSplit,
                JoinField,
                Field,
                ViewLink,
                Action
              }}
            >
              <Canvas className="canvas"></Canvas>
            </Frame>
          </div>
          <div className="col-sm-3">
            <Toolbox />
            <SettingsPanel />
          </div>
        </div>
        <SaveButton layout={layout} />
      </Provider>
    </Editor>
  );
};

export default Builder;
