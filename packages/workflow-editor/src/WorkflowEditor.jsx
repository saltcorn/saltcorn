import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  useEdgesState,
  useNodesState,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./workflow.css";

const handleStyle = {
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  border: "2px solid var(--wf-handle-border, #3f3f3f)",
  background: "var(--wf-handle-bg, #fff)",
};

const DEFAULT_NODE_WIDTH = 220;
const DEFAULT_NODE_HEIGHT = 120;
const H_GAP = 80;
const V_GAP = 60;
const ADD_NODE_SIZE = 32;
const ADD_GAP = 32;

const normalizeSize = (size) => {
  if (!size) return null;
  const width = Number(size.width);
  const height = Number(size.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width, height };
};

const getWorkflowSize = (step) =>
  normalizeSize(step?.configuration?.workflow_size);

const StartNode = ({ data }) => (
  <div className="wf-start-node">
    <div className="wf-start-title">{data.strings.start}</div>
    <Handle
      style={handleStyle}
      id="start"
      type="source"
      position={Position.Right}
    />
  </div>
);

const AddNode = ({ data }) => {
  const handleClick = (e) => {
    e.stopPropagation();
    data.onAddAfter?.(data.afterStepId);
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      data.onAddAfter?.(data.afterStepId);
    }
  };
  return (
    <div
      className="wf-add-node"
      role="button"
      tabIndex={0}
      aria-label={data.strings.addStep}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span aria-hidden>+</span>
      <Handle type="target" position={Position.Left} />
    </div>
  );
};

const StepNode = ({ data }) => {
  const summaryLines = Array.isArray(data.actionSummary)
    ? data.actionSummary
    : data.actionSummary
      ? String(data.actionSummary)
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : data.actionDescription
        ? [data.actionDescription]
        : [];

  const handleClick = (e) => {
    if (e.target?.closest(".react-flow__handle")) return;
    e.stopPropagation();
    if (data.onEdit) data.onEdit(data.id);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (data.onEdit) data.onEdit(data.id);
    }
  };

  const isLoopBody = data.inLoopBody;
  const useVerticalHandles =
    isLoopBody && String(data.action_name) !== "ForLoop";
  const targetPosition = useVerticalHandles ? Position.Top : Position.Left;
  const sourcePosition = useVerticalHandles ? Position.Bottom : Position.Right;

  return (
    <div
      className="wf-node"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="wf-node__header">
        <div className="wf-node__title-row">
          <div className="wf-node__title">{data.name}</div>
          <div className="wf-node__action">{data.action_name}</div>
        </div>
      </div>
      {summaryLines.length ? (
        <ul className="wf-node__summary">
          {summaryLines.map((line, ix) => (
            <li key={ix}>{line}</li>
          ))}
        </ul>
      ) : null}
      {data.only_if ? (
        <div className="wf-node__meta">
          <span className="wf-label">{data.strings.onlyIf}:</span>{" "}
          {data.only_if}
        </div>
      ) : null}
      {/* {data.next_step ? (
        <div className="wf-node__meta">
          <span className="wf-label">{data.strings.nextStep}:</span>{" "}
          {data.next_step}
        </div>
      ) : null} */}
      {/* {data.isLoop && data.loop_body_initial_step ? (
        <div className="wf-node__meta">
          <span className="wf-label">{data.strings.loopBody}:</span>{" "}
          {data.loop_body_initial_step}
        </div>
      ) : null} */}
      <Handle style={handleStyle} type="target" position={targetPosition} />
      <Handle
        style={handleStyle}
        id="main"
        type="source"
        position={sourcePosition}
      />
    </div>
  );
};

const nodeTypes = {
  start: StartNode,
  step: StepNode,
  add: AddNode,
};

const findLoopBackLinks = (steps) => {
  const byName = new Map(steps.map((s) => [s.name, s]));
  const loopBacks = {};
  steps
    .filter((s) => s.action_name === "ForLoop")
    .forEach((forStep) => {
      const visited = new Set();
      let cursor = byName.get(forStep.configuration?.loop_body_initial_step);
      let lastStep = null;
      while (cursor && !visited.has(cursor.name)) {
        visited.add(cursor.name);
        lastStep = cursor;
        if (!cursor.next_step || cursor.next_step === forStep.name) break;
        cursor = byName.get(cursor.next_step);
      }
      if (lastStep && !lastStep.next_step) {
        loopBacks[lastStep.name] = forStep.name;
      }
    });
  return loopBacks;
};

const findLoopBodyStepIds = (steps) => {
  const byName = new Map(steps.map((s) => [s.name, s]));
  const loopBodyIds = new Set();
  steps
    .filter((s) => s.action_name === "ForLoop")
    .forEach((loopStep) => {
      const visited = new Set();
      let cursor = byName.get(loopStep.configuration?.loop_body_initial_step);
      while (cursor && !visited.has(cursor.name)) {
        visited.add(cursor.name);
        loopBodyIds.add(String(cursor.id));
        if (!cursor.next_step || cursor.next_step === loopStep.name) break;
        cursor = byName.get(cursor.next_step);
      }
    });
  return loopBodyIds;
};

const buildGraph = (
  steps,
  strings,
  actionExplainers,
  { startPosition, addPositions } = {}
) => {
  const idByName = {};
  const nameById = {};
  const sizeById = {};
  steps.forEach((s) => {
    idByName[s.name] = String(s.id);
    nameById[String(s.id)] = s.name;
    const size = getWorkflowSize(s);
    sizeById[String(s.id)] = size || {
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
    };
  });

  const allStepNames = steps.map((s) => s.name).filter(Boolean);

  const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const extractNextStepNames = (rawNextStep) => {
    if (!rawNextStep) return [];
    const trimmed = String(rawNextStep).trim();

    // Simple case: next_step is directly a step name
    if (idByName[trimmed]) return [trimmed];

    // Expression case: find all step names referenced in the expression
    const expr = trimmed;
    const hits = new Set();
    allStepNames.forEach((name) => {
      if (!name) return;
      try {
        const re = new RegExp(`\\b${escapeRegExp(name)}\\b`);
        if (re.test(expr)) hits.add(name);
      } catch (e) {
        // Fallback: simple substring match if regex construction fails
        if (expr.includes(name)) hits.add(name);
      }
    });
    return [...hits];
  };

  const initial = steps.find((s) => s.initial_step);
  const loopBackLinks = findLoopBackLinks(steps);
  const loopBodyIds = findLoopBodyStepIds(steps);

  const adjacency = new Map();
  steps.forEach((s) => {
    const targets = [];
    const nextNames = extractNextStepNames(s.next_step);
    nextNames.forEach((name) => {
      const id = idByName[name];
      if (id) targets.push(id);
    });
    adjacency.set(String(s.id), [...new Set(targets)]);
  });

  const depths = {};
  const queue = [];
  if (initial) {
    depths[String(initial.id)] = 1;
    queue.push(String(initial.id));
  }

  while (queue.length) {
    const current = queue.shift();
    const d = depths[current];
    (adjacency.get(current) || []).forEach((n) => {
      if (depths[n] === undefined) {
        depths[n] = d + 1;
        queue.push(n);
      }
    });
  }

  let maxDepth = Object.values(depths).reduce((m, v) => Math.max(m, v), 0);
  const sortedRemaining = steps
    .map((s) => String(s.id))
    .filter((id) => depths[id] === undefined)
    .sort();
  if (sortedRemaining.length) {
    const orphanDepth = maxDepth + 1;
    sortedRemaining.forEach((id) => {
      depths[id] = orphanDepth;
    });
    maxDepth = orphanDepth;
  }

  const groupByDepth = new Map();
  steps.forEach((s) => {
    const d = depths[String(s.id)] || 1;
    if (!groupByDepth.has(d)) groupByDepth.set(d, []);
    groupByDepth.get(d).push(String(s.id));
  });
  [...groupByDepth.values()].forEach((arr) => arr.sort());

  const positions = {};
  const depthEntries = [...groupByDepth.entries()].sort(([a], [b]) => a - b);
  const depthX = {};
  let xCursor = 0;
  depthEntries.forEach(([d, ids]) => {
    const colWidth = Math.max(
      ...ids.map((id) => sizeById[id]?.width || DEFAULT_NODE_WIDTH)
    );
    depthX[d] = xCursor;
    xCursor += colWidth + H_GAP;
  });
  depthEntries.forEach(([d, ids]) => {
    let yCursor = 0;
    ids.forEach((id) => {
      positions[id] = { x: depthX[d], y: yCursor };
      yCursor += (sizeById[id]?.height || DEFAULT_NODE_HEIGHT) + V_GAP;
    });
  });

  // Nudge ForLoop bodies to be vertical under their loop parent for readability
  const positionOverrides = {};
  steps
    .filter((s) => s.action_name === "ForLoop")
    .forEach((loopStep) => {
      const loopPos =
        loopStep.configuration?.workflow_position ||
        positions[String(loopStep.id)];
      if (!loopPos) return;
      const byName = new Map(steps.map((s) => [s.name, s]));
      const body = [];
      const seen = new Set();
      let cursor = byName.get(loopStep.configuration?.loop_body_initial_step);
      while (cursor && !seen.has(cursor.name)) {
        seen.add(cursor.name);
        body.push(cursor);
        if (!cursor.next_step || cursor.next_step === loopStep.name) break;
        cursor = byName.get(cursor.next_step);
      }

      const loopSize = sizeById[String(loopStep.id)] || {
        width: DEFAULT_NODE_WIDTH,
        height: DEFAULT_NODE_HEIGHT,
      };
      let yCursor = loopPos.y + loopSize.height + V_GAP;

      body.forEach((s) => {
        if (s.configuration?.workflow_position) return; // respect saved positions
        const bodySize = sizeById[String(s.id)] || {
          width: DEFAULT_NODE_WIDTH,
          height: DEFAULT_NODE_HEIGHT,
        };
        positionOverrides[String(s.id)] = {
          x: loopPos.x,
          y: yCursor,
        };
        yCursor += bodySize.height + V_GAP;
      });
    });

  const nodePositions = {};
  const startNodePosition =
    startPosition ||
    (initial
      ? {
          x: positions[String(initial.id)]?.x - 180 || -180,
          y: positions[String(initial.id)]?.y || 40,
        }
      : { x: -180, y: 40 });

  const nodes = [
    {
      id: "start",
      type: "start",
      data: { strings },
      position: startNodePosition,
      draggable: true,
    },
    ...steps.map((step, ix) => {
      return {
        id: String(step.id),
        type: "step",
        position: step.configuration?.workflow_position ||
          positionOverrides[String(step.id)] ||
          positions[String(step.id)] || {
            x: (ix % 3) * 260,
            y: Math.floor(ix / 3) * 180 + 10,
          },
        data: {
          ...step,
          id: String(step.id),
          loop_body_initial_step: step.configuration?.loop_body_initial_step,
          isLoop: step.action_name === "ForLoop",
          inLoopBody: loopBodyIds.has(String(step.id)),
          actionSummary:
            step.summary ||
            (actionExplainers[step.action_name]
              ? [actionExplainers[step.action_name]]
              : []),
          actionDescription: actionExplainers[step.action_name],
          strings,
        },
      };
    }),
  ];

  nodes.forEach((n) => {
    if (n.type === "step") nodePositions[n.id] = n.position;
  });

  const edges = [];
  if (initial)
    edges.push({
      id: `e-start-${initial.id}`,
      source: "start",
      target: String(initial.id),
      type: "smoothstep",
      animated: true,
    });
  else {
    const addId = "add-start";
    edges.push({
      id: "e-start-adder",
      source: "start",
      target: addId,
      type: "bezier",
      animated: false,
      deletable: false,
      style: {
        strokeDasharray: "4 2",
        stroke: "var(--wf-edge-adder, #0d6efd)",
      },
    });
  }

  steps.forEach((step) => {
    if (step.next_step) {
      const nextNames = extractNextStepNames(step.next_step);
      nextNames.forEach((name) => {
        const targetId = idByName[name];
        if (!targetId) return;
        edges.push({
          id: `e-${step.id}-${name}`,
          source: String(step.id),
          target: targetId,
          type: "smoothstep",
          animated: true,
        });
      });
    }
    if (step.action_name === "ForLoop") {
      const loopTarget = step.configuration?.loop_body_initial_step;
      if (loopTarget) {
        const loopId = idByName[loopTarget];
        edges.push({
          id: `loop-${step.id}-${loopTarget}`,
          source: String(step.id),
          target: loopId || String(step.id),
          type: "smoothstep",
          style: {
            stroke: "var(--wf-edge-loop, #f59f00)",
            strokeDasharray: "6 4",
          },
          label: strings.loopBody,
          markerEnd: "arrowclosed",
          data: { loop: true, missing: !loopId },
        });
      }
    }

    if (!step.next_step && loopBackLinks[step.name]) {
      const forLoopName = loopBackLinks[step.name];
      const loopId = idByName[forLoopName];
      if (loopId) {
        edges.push({
          id: `loopback-${step.id}-${forLoopName}`,
          source: String(step.id),
          target: loopId,
          type: "smoothstep",
          style: {
            stroke: "var(--wf-edge-loop, #f59f00)",
            strokeDasharray: "6 4",
          },
          data: { loop: true, loopBack: true },
          markerEnd: "arrowclosed",
          deletable: false,
        });
      }
    }
  });

  const addNodes = [];
  if (!steps.length) {
    const addId = "add-start";
    addNodes.push({
      id: addId,
      type: "add",
      position: addPositions?.[addId] || {
        x: startNodePosition.x + 160,
        y: startNodePosition.y,
      },
      data: { strings, afterStepId: "start" },
      draggable: true,
      selectable: false,
      deletable: false,
    });
  }
  steps.forEach((step) => {
    const hasNextTargets = extractNextStepNames(step.next_step).length > 0;
    if (hasNextTargets || loopBackLinks[step.name]) return;
    const basePos = nodePositions[String(step.id)] || { x: 0, y: 0 };
    const baseSize = sizeById[String(step.id)] || {
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
    };
    const addId = `add-${step.id}`;
    addNodes.push({
      id: addId,
      type: "add",
      position: addPositions?.[addId] || {
        x: basePos.x + baseSize.width + ADD_GAP,
        y: basePos.y + baseSize.height / 2 - ADD_NODE_SIZE / 2,
      },
      data: { strings, afterStepId: String(step.id) },
      draggable: true,
      selectable: false,
      deletable: false,
    });
    edges.push({
      id: `e-${step.id}-adder`,
      source: String(step.id),
      target: addId,
      type: "bezier",
      animated: false,
      deletable: false,
      style: {
        strokeDasharray: "4 2",
        stroke: "var(--wf-edge-adder, #0d6efd)",
      },
    });
  });

  const allNodes = [...nodes, ...addNodes];

  return { nodes: allNodes, edges, idByName, nameById };
};

const StepModal = ({
  modal,
  innerRef,
  onClose,
  submitting,
  error,
  data,
  onDelete,
}) => {
  if (!modal) return null;
  return (
    <div className="wf-modal-backdrop">
      <div className="wf-modal">
        <div className="wf-modal__header">
          <div className="wf-modal__title">{modal.title}</div>
          <button className="btn-close" onClick={onClose} aria-label="Close" />
        </div>
        <div
          className="wf-modal__body"
          ref={innerRef}
          dangerouslySetInnerHTML={{ __html: modal.body }}
        />
        {error ? <div className="alert alert-danger m-3">{error}</div> : null}
        <div className="wf-modal__footer">
          <button
            className="btn btn-sm btn-outline-danger"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(modal.stepId);
            }}
          >
            {data.strings.deleteStep}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            className="btn btn-primary"
            onClick={() =>
              innerRef.current
                ?.querySelector("form")
                ?.dispatchEvent(
                  new Event("submit", { cancelable: true, bubbles: true })
                )
            }
            disabled={submitting}
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

const WorkflowEditor = ({ data }) => {
  const [steps, setSteps] = useState(data.steps || []);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, rfOnEdgesChange] = useEdgesState([]);
  const [nameById, setNameById] = useState({});
  const [idByName, setIdByName] = useState({});
  const [startPosition, setStartPosition] = useState(
    data.config?.workflow_start_position || null
  );
  const [addPositions, setAddPositions] = useState({});
  const pendingAddRef = useRef(null);
  const positionDebounceRef = useRef(null);
  const pendingPositionRef = useRef(new Map());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [savingModal, setSavingModal] = useState(false);
  const [savingPositions, setSavingPositions] = useState(false);
  const [sizeSyncing, setSizeSyncing] = useState(false);
  const modalRef = useRef(null);


  const rfInstanceRef = useRef(null);

  const onInit = useCallback((instance) => {
    rfInstanceRef.current = instance;
  }, []);

  const strings = data.strings || {};
  const refreshGraph = useCallback(
    (nextSteps) => {
      const {
        nodes: n,
        edges: e,
        idByName: idMap,
        nameById: nameMap,
      } = buildGraph(nextSteps, strings, data.actionExplainers || {}, {
        startPosition,
        addPositions,
      });
      setNodes(n);
      setEdges(e);
      setIdByName(idMap);
      setNameById(nameMap);
    },
    [
      addPositions,
      data.actionExplainers,
      setEdges,
      setNodes,
      startPosition,
      strings,
    ]
  );

  useEffect(() => {
    refreshGraph(steps);
  }, [steps, refreshGraph]);

  useEffect(() => {
    if (!rfInstanceRef.current) return;

    const currentNodes = rfInstanceRef.current.getNodes();

    // Ensure all step nodes have dimensions
    const stepNodes = currentNodes.filter(
      (n) => n.type === "step" && n.width && n.height
    );
    if (!stepNodes.length) return;

    const stepById = new Map(stepNodes.map((n) => [n.id, n]));
    const updates = [];

    currentNodes.forEach((node) => {
      if (!node.id.startsWith("add-")) return;
      // Respect user-dragged add nodes
      if (addPositions?.[node.id]) return;

      const stepNode = stepById.get(node.id.replace("add-", ""));
      if (!stepNode) return;

      const nextX = stepNode.position.x + stepNode.width + ADD_GAP;

      const nextY =
        stepNode.position.y + stepNode.height / 2 - (node.height || 24) / 2;

      const nextPosition = { x: nextX, y: nextY };

      // Only update if the position actually changed to avoid infinite loops
      if (
        node.position &&
        node.position.x === nextPosition.x &&
        node.position.y === nextPosition.y
      ) {
        return;
      }

      updates.push({
        id: node.id,
        position: nextPosition,
      });
    });

    if (!updates.length) return;

    setNodes((nds) =>
      nds.map((n) => {
        const u = updates.find((x) => x.id === n.id);
        return u ? { ...n, position: u.position } : n;
      })
    );
  }, [nodes, addPositions, setNodes]);

  useLayoutEffect(() => {
    if (sizeSyncing) return;
    if (!rfInstanceRef.current) return;
    const currentNodes = rfInstanceRef.current.getNodes();
    const stepNodes = currentNodes.filter(
      (n) => n.type === "step" && n.width && n.height
    );
    if (!stepNodes.length) return;
    const updates = [];
    stepNodes.forEach((node) => {
      const step = steps.find((s) => String(s.id) === String(node.id));
      if (!step) return;
      const stored = getWorkflowSize(step);
      const width = Math.round(node.width);
      const height = Math.round(node.height);
      if (!stored || stored.width !== width || stored.height !== height) {
        updates.push({ id: node.id, width, height });
      }
    });
    if (updates.length) persistSizes(updates);
  }, [nodes, persistSizes, sizeSyncing, steps]);

  const fetchJson = useCallback(async (url, options = {}) => {
    const baseHeaders = {
      "x-requested-with": "XMLHttpRequest",
    };
    if (!(options.body instanceof FormData) && !options.skipJsonHeader)
      baseHeaders["Content-Type"] = "application/json";
    const res = await fetch(url, {
      ...options,
      headers: { ...baseHeaders, ...(options.headers || {}) },
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      throw new Error(json.error || res.statusText);
    }
    return json;
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setModal(null);
    setError("");
    try {
      const fresh = await fetchJson(data.urls.data);
      setSteps(fresh.steps || []);

      // If a step was just added via an adder node, link it as next_step
      if (pendingAddRef.current) {
        const { afterStepId, prevIds } = pendingAddRef.current;
        const newSteps = (fresh.steps || []).filter(
          (s) => !prevIds.has(String(s.id))
        );
        if (newSteps.length === 1) {
          const newStep = newSteps[0];
          await updateConnection({
            step_id: afterStepId,
            next_step: newStep.name,
          });
        }
        pendingAddRef.current = null;
      }

      setMessage(strings.refresh);
      setTimeout(() => setMessage(""), 1200);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [data.urls.data, fetchJson, strings.refresh]);

  const persistPositions = useCallback(
    async (positions = []) => {
      if (!positions.length) return;
      try {
        setSavingPositions(true);
        await fetchJson(data.urls.positions, {
          method: "POST",
          body: JSON.stringify({ positions }),
          headers: {
            "X-CSRF-Token": data.csrfToken || "",
          },
        });
        // keep local state in sync so refresh uses saved positions
        setSteps((prev) =>
          prev.map((s) => {
            const hit = positions.find((p) => String(p.id) === String(s.id));
            return hit
              ? {
                  ...s,
                  configuration: {
                    ...(s.configuration || {}),
                    workflow_position: { x: hit.x, y: hit.y },
                  },
                }
              : s;
          })
        );
      } catch (e) {
        setError(e.message);
      } finally {
        setSavingPositions(false);
      }
    },
    [data.urls.positions, fetchJson, setSteps]
  );

  const schedulePersistPositions = useCallback(
    (positions = []) => {
      if (!positions.length) return;
      positions.forEach((p) => pendingPositionRef.current.set(String(p.id), p));
      if (positionDebounceRef.current)
        clearTimeout(positionDebounceRef.current);
      positionDebounceRef.current = setTimeout(() => {
        const toSave = Array.from(pendingPositionRef.current.values());
        pendingPositionRef.current.clear();
        positionDebounceRef.current = null;
        persistPositions(toSave);
      }, 300);
    },
    [persistPositions]
  );

  useEffect(() => {
    return () => {
      if (positionDebounceRef.current)
        clearTimeout(positionDebounceRef.current);
    };
  }, []);

  const persistSizes = useCallback(
    async (sizes = []) => {
      if (!sizes.length) return;
      try {
        setSizeSyncing(true);
        await fetchJson(data.urls.sizes, {
          method: "POST",
          body: JSON.stringify({ sizes }),
          headers: {
            "X-CSRF-Token": data.csrfToken || "",
          },
        });
        setSteps((prev) =>
          prev.map((s) => {
            const hit = sizes.find((p) => String(p.id) === String(s.id));
            return hit
              ? {
                  ...s,
                  configuration: {
                    ...(s.configuration || {}),
                    workflow_size: { width: hit.width, height: hit.height },
                  },
                }
              : s;
          })
        );
      } catch (e) {
        setError(e.message);
      } finally {
        setSizeSyncing(false);
      }
    },
    [data.csrfToken, data.urls.sizes, fetchJson, setSteps]
  );

  const openStepForm = useCallback(
    async ({ stepId, initial_step, after_step } = {}) => {
      try {
        setError("");
        const base = `${data.urls.stepForm}${stepId ? `/${stepId}` : ""}`;
        const url = new URL(base, window.location.origin);
        url.searchParams.set("render", "dialog");
        if (initial_step) url.searchParams.set("initial_step", "true");
        if (after_step) url.searchParams.set("after_step", after_step);
        const res = await fetchJson(url.toString());
        setModal({ title: res.title, body: res.form, stepId: stepId || null });
      } catch (e) {
        setError(e.message);
      }
    },
    [data.urls.stepForm, fetchJson]
  );

  const handleModalSubmit = useCallback(
    async (formEl) => {
      if (!formEl) return;
      setSavingModal(true);
      setError("");
      const formData = new FormData(formEl);
      if (!formData.get("_csrf") && data.csrfToken)
        formData.append("_csrf", data.csrfToken);
      const action = formEl.getAttribute("action") || data.urls.stepForm;
      const method = (formEl.getAttribute("method") || "post").toUpperCase();
      const res = await fetch(action, {
        method,
        body: formData,
        headers: { "x-requested-with": "XMLHttpRequest" },
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setModal(null);
      await reload();
    },
    [data.csrfToken, data.urls.stepForm, reload]
  );

  useEffect(() => {
    if (!modal) return undefined;
    const formEl = modalRef.current?.querySelector("form");
    if (!formEl) return undefined;
    // Re-run show-if logic so action-specific fields render correctly
    setTimeout(() => {
      if (typeof window !== "undefined" && window.apply_showif)
        window.apply_showif();
    }, 0);

    const actionSelect = formEl.querySelector('[name="wf_action_name"]');
    const handleActionChange = () => {
      if (typeof window !== "undefined" && window.apply_showif)
        window.apply_showif();
    };
    if (actionSelect)
      actionSelect.addEventListener("change", handleActionChange);

    const submitHandler = async (e) => {
      e.preventDefault();
      try {
        await handleModalSubmit(formEl);
      } catch (err) {
        setError(err.message);
      } finally {
        setSavingModal(false);
      }
    };
    formEl.addEventListener("submit", submitHandler);
    return () => {
      formEl.removeEventListener("submit", submitHandler);
      if (actionSelect)
        actionSelect.removeEventListener("change", handleActionChange);
    };
  }, [handleModalSubmit, modal]);

  const updateConnection = useCallback(
    async (payload) => {
      const body = new URLSearchParams();
      Object.entries({ ...payload, _csrf: data.csrfToken }).forEach(
        ([k, v]) => {
          if (typeof v !== "undefined" && v !== null) body.append(k, v);
        }
      );
      await fetchJson(data.urls.connect, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    },
    [data.csrfToken, data.urls.connect, fetchJson]
  );

  const onConnect = useCallback(
    async (connection) => {
      const loop = connection.sourceHandle === "loop";
      const targetName = nameById[connection.target];
      if (connection.source === "start") {
        const targetId = connection.target;
        await updateConnection({ step_id: targetId, initial_step: true });
        await reload();
        return;
      }
      const stepName = nameById[connection.source];
      if (!stepName) return;
      const payload = {
        step_id: connection.source,
      };
      if (loop) payload.loop_body_step = targetName || "";
      else payload.next_step = targetName || "";
      await updateConnection(payload);
      await reload();
    },
    [idByName, nameById, reload, updateConnection]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      const removed = changes.filter((c) => c.type === "remove");
      if (removed.length) {
        const updates = [];
        removed.forEach((chg) => {
          const edge = edges.find((e) => e.id === chg.id);
          if (!edge) return;
          if (edge.source === "start") {
            updates.push(
              updateConnection({
                step_id: edge.target,
                initial_step: false,
              })
            );
            return;
          }
          if (edge.data?.loop) {
            updates.push(
              updateConnection({ step_id: edge.source, loop_body_step: "" })
            );
          } else {
            updates.push(
              updateConnection({ step_id: edge.source, next_step: "" })
            );
          }
        });
        Promise.all(updates)
          .then(() => reload())
          .catch((e) => setError(e.message));
      }
      rfOnEdgesChange(changes);
    },
    [edges, reload, rfOnEdgesChange, updateConnection]
  );

  const onNodesChangeWrapped = useCallback(
    (changes) => {
      const finishedPositions = changes
        .filter((c) => c.type === "position" && c.position && c.dragging)
        .map((c) => ({ id: c.id, x: c.position.x, y: c.position.y }));

      if (finishedPositions.length) {
        finishedPositions
          .filter((p) => p.id === "start")
          .forEach((p) => setStartPosition({ x: p.x, y: p.y }));

        const addUpdates = finishedPositions.filter((p) =>
          p.id.startsWith("add-")
        );
        if (addUpdates.length) {
          setAddPositions((prev) => {
            const next = { ...prev };
            addUpdates.forEach((p) => {
              next[p.id] = { x: p.x, y: p.y };
            });
            return next;
          });
        }

        const stepPositions = finishedPositions.filter(
          (p) => /^[0-9]+$/.test(p.id) || p.id === "start"
        );
        if (stepPositions.length) schedulePersistPositions(stepPositions);
      }
      onNodesChange(changes);
    },
    [onNodesChange, schedulePersistPositions, setAddPositions, setStartPosition]
  );

  const onAddAfter = useCallback(
    (id) => {
      if (id === "start") {
        openStepForm({ initial_step: true });
        return;
      }
      pendingAddRef.current = {
        afterStepId: id,
        prevIds: new Set(steps.map((s) => String(s.id))),
      };
      openStepForm({ after_step: id });
    },
    [openStepForm, steps]
  );

  const onSetStart = useCallback(
    async (id) => {
      await updateConnection({ step_id: id, initial_step: true });
      await reload();
    },
    [reload, updateConnection]
  );

  const onClearNext = useCallback(
    async (id) => {
      await updateConnection({ step_id: id, next_step: "" });
      await reload();
    },
    [reload, updateConnection]
  );

  const onDelete = useCallback(
    async (id) => {
      if (!window.confirm(strings.confirmDelete)) return;
      const formData = new FormData();
      formData.append("_csrf", data.csrfToken || "");
      await fetchJson(`${data.urls.deleteStep}/${id}`, {
        method: "POST",
        body: formData,
      });
      await reload();
    },
    [data.csrfToken, fetchJson, reload, strings.confirmDelete]
  );

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) =>
        n.type === "start"
          ? {
              ...n,
              data: {
                ...n.data,
                onAddInitial: () => openStepForm({ initial_step: true }),
              },
            }
          : n.type === "add"
            ? {
                ...n,
                data: {
                  ...n.data,
                  onAddAfter: (afterId) => onAddAfter(afterId),
                },
              }
            : {
                ...n,
                data: {
                  ...n.data,
                  onEdit: (id) => openStepForm({ stepId: id }),
                  onAddAfter,
                  onSetStart,
                  onClearNext,
                  onDelete,
                },
              }
      )
    );
  }, [
    onAddAfter,
    onClearNext,
    onDelete,
    onSetStart,
    openStepForm,
    setNodes,
    steps,
  ]);

  const hasSteps = steps.length > 0;

  return (
    <div className="wf-shell">
      <div className="wf-toolbar">
        <div className="wf-toolbar__left">
          <strong>{strings.configure}</strong>
          {message ? (
            <span className="text-success ms-2">{message}</span>
          ) : null}
          {error ? <span className="text-danger ms-2">{error}</span> : null}
          {/* {savingPositions ? (
            <span className="text-muted ms-2">
              {strings.loading || "Saving positions..."}
            </span>
          ) : null} */}
        </div>
        <div className="wf-toolbar__actions">
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={() => openStepForm({ initial_step: !hasSteps })}
          >
            {strings.addStep}
          </button>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={reload}
            disabled={loading}
          >
            {loading ? strings.loading : strings.refresh}
          </button>
          <a className="btn btn-sm btn-outline-info" href={data.urls.runs}>
            {strings.runs}
          </a>
        </div>
      </div>
      {!hasSteps ? <div className="wf-empty">{strings.empty}</div> : null}
      <div className="wf-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChangeWrapped}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onInit={onInit}
          fitView
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ animated: true }}
          colorMode={window._sc_lightmode || "light"}
        >
          <MiniMap pannable zoomable />
          <Controls />
          <Background gap={16} />
        </ReactFlow>
      </div>
      <StepModal
        modal={modal}
        innerRef={modalRef}
        onClose={() => {
          setModal(null);
          setError("");
        }}
        submitting={savingModal}
        error={error && modal ? error : ""}
        data={data}
        onDelete={onDelete}
      />
    </div>
  );
};

export default WorkflowEditor;
