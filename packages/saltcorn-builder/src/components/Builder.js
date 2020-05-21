import React from "react";
import { Editor, Frame, Canvas, Selector, useEditor } from "@craftjs/core";
import { Text } from "./elements/Text";
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
            <button ref={ref => connectors.create(ref, <TwoSplit/>)}>||</button>
          </td>
        </tr>
      </tbody>
    </table>
  );
};
const Builder = ({}) => {
  return (
    <Editor>
      <div className="row">
        <div className="col-sm-10">
          <Frame resolver={(Text, TwoSplit)}>
            <Canvas>
              <Text text="I'm already rendered here" />
            </Canvas>
          </Frame>
        </div>
        <div className="col-sm-2">
          <Toolbox />
        </div>
      </div>
    </Editor>
  );
};

export default Builder;
