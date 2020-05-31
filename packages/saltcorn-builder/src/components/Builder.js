import React, { useEffect, useContext } from "react";
import { Editor, Frame, Canvas, Selector, useEditor } from "@craftjs/core";
import { Text } from "./elements/Text";
import { Field } from "./elements/Field";
import { JoinField } from "./elements/JoinField";
import { LineBreak } from "./elements/LineBreak";
import { ViewLink } from "./elements/ViewLink";
import { TwoSplit } from "./elements/TwoSplit";
import { Action } from "./elements/Action";
import optionsCtx from "./context";
import { craftToSaltcorn, layoutToNodes } from "./storage";
const { Provider } = optionsCtx;

const Toolbox = () => {
  const { connectors, query } = useEditor();
  const options = useContext(optionsCtx);
  const { fields, field_view_options } = options;
  return (
    <table>
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
                  <TwoSplit
                    left={<Text text="Left" />}
                    right={<Text text="Right" />}
                  />
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
                    name={options.parent_field_list[0]}
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
        </tr>
      </tbody>
    </table>
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

  return selected ? (
    <div>
      {selected.settings && React.createElement(selected.settings)}
      {selected.isDeletable && (
        <button
          onClick={() => {
            actions.delete(selected.id);
          }}
        >
          Delete
        </button>
      )}
    </div>
  ) : (
    ""
  );
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
            <Frame
              resolver={(Text, TwoSplit, JoinField, Field, ViewLink, Action)}
            >
              <Canvas>
                <Text text="I was already rendered here" />
              </Canvas>
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
