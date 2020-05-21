import React from "react";
import { Editor, Frame, Canvas, Selector, useEditor } from "@craftjs/core";
import { Text } from "./elements/Text";
import { Field } from "./elements/Field";
import { TwoSplit } from "./elements/TwoSplit";
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
            <button ref={ref => connectors.create(ref, <TwoSplit />)}>
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
          <td></td>
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
const Builder = ({}) => {
  return (
    <Editor>
      <div className="row">
        <div className="col-sm-9">
          <Frame resolver={(Text, TwoSplit)}>
            <Canvas>
              <Text text="I'm already rendered here" />
            </Canvas>
          </Frame>
        </div>
        <div className="col-sm-3">
          <Toolbox />
          <SettingsPanel />
        </div>
      </div>
    </Editor>
  );
};

export default Builder;
