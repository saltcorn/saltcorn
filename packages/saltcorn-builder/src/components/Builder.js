import React, { useEffect } from "react";
import { Editor, Frame, Canvas, Selector, useEditor } from "@craftjs/core";
import { Text } from "./elements/Text";
import { Field } from "./elements/Field";
import { JoinField } from "./elements/JoinField";
import { ViewLink } from "./elements/ViewLink";
import { TwoSplit } from "./elements/TwoSplit";
import optionsCtx from "./context";
import { craftToSaltcorn, layoutToNodes } from "./storage";
const { Provider } = optionsCtx;

const Toolbox = () => {
  const { connectors, query } = useEditor();
  return (
    <table>
      <tbody>
        <tr>
          <td>
            <button
              ref={ref => connectors.create(ref, <Text text="Hi world" />)}
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
              ref={ref => connectors.create(ref, <Field name="field_name" />)}
            >
              Field
            </button>
          </td>
          <td><button
              ref={ref => connectors.create(ref, <JoinField name="join_field_name" />)}
            >
              Join
            </button></td>
        </tr>
        <tr>
          <td>
          <button
              ref={ref => connectors.create(ref, <ViewLink name="view_link" />)}
            >
              Link
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
            <Frame resolver={(Text, TwoSplit, JoinField, Field, ViewLink)}>
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
