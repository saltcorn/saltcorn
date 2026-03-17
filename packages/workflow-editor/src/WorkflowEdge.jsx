import React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from "@xyflow/react";

const WorkflowEdge = (props) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    source,
    target,
    style,
    markerEnd,
    data = {},
  } = props;

  const handleAddBetween = (event) => {
    event.stopPropagation();
    if (!data || typeof data.onAddBetween !== "function") return;
    data.onAddBetween({ source, target });
  };

  const canInsertBetween = !!data.canInsertBetween;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {canInsertBetween ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan"
          >
            <button
              type="button"
              className="wf-edge-add-button"
              onClick={handleAddBetween}
              aria-label={data.startLabel || "Add step"}
            >
              +
            </button>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
};

export default WorkflowEdge;
