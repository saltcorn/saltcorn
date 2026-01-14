import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import "./workflow.css";

const StartNode = ({ data }) => {
  console.log({ data });
  return (
    <div className="wf-start-node">
      <div className="wf-start-title">{data.strings.start}</div>
      <div className="wf-start-actions">
        <button
          className="btn btn-sm btn-light"
          onClick={(e) => {
            e.stopPropagation();
            data.onAddInitial();
          }}
        >
          {data.strings.addStep}
        </button>
      </div>
      <Handle id="start" type="source" position={Position.Right} />
    </div>
  );
};

const StepNode = ({ data }) => {
  console.log({ data }, "StepNode data");
  return (
    <div className="wf-node">
      <div className="wf-node__header">
        <div className="wf-node__title">{data.name}</div>
        <div className="wf-node__chips">
          {data.initial_step ? (
            <span className="badge bg-primary">{data.strings.start}</span>
          ) : null}
        </div>
      </div>
      <div className="wf-node__action">{data.action_name}</div>
      {data.actionDescription ? (
        <div className="wf-node__desc">{data.actionDescription}</div>
      ) : null}
      {data.only_if ? (
        <div className="wf-node__meta">
          <span className="wf-label">{data.strings.onlyIf}:</span>{" "}
          {data.only_if}
        </div>
      ) : null}
      {data.next_step ? (
        <div className="wf-node__meta">
          <span className="wf-label">{data.strings.nextStep}:</span>{" "}
          {data.next_step}
        </div>
      ) : null}
      {data.isLoop && data.loop_body_initial_step ? (
        <div className="wf-node__meta">
          <span className="wf-label">{data.strings.loopBody}:</span>{" "}
          {data.loop_body_initial_step}
        </div>
      ) : null}
      <div className="wf-node__footer">
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={(e) => {
            e.stopPropagation();
            data.onEdit(data.id);
          }}
        >
          {data.strings.editStep}
        </button>
        <button
          className="btn btn-sm btn-outline-primary"
          onClick={(e) => {
            e.stopPropagation();
            data.onAddAfter(data.id);
          }}
        >
          {data.strings.addAfter}
        </button>
        {!data.initial_step ? (
          <button
            className="btn btn-sm btn-outline-success"
            onClick={(e) => {
              e.stopPropagation();
              data.onSetStart(data.id);
            }}
          >
            {data.strings.setAsStart}
          </button>
        ) : null}
        {data.next_step ? (
          <button
            className="btn btn-sm btn-outline-warning"
            onClick={(e) => {
              e.stopPropagation();
              data.onClearNext(data.id);
            }}
          >
            {data.strings.nextStep} x
          </button>
        ) : null}
        <button
          className="btn btn-sm btn-outline-danger"
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete(data.id);
          }}
        >
          {data.strings.deleteStep}
        </button>
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle id="main" type="source" position={Position.Right} />
      {data.isLoop ? (
        <Handle id="loop" type="source" position={Position.Bottom} />
      ) : null}
    </div>
  );
};

const nodeTypes = {
  start: StartNode,
  step: StepNode,
};

const buildGraph = (steps, strings, actionExplainers) => {
  const idByName = {};
  const nameById = {};
  steps.forEach((s) => {
    idByName[s.name] = String(s.id);
    nameById[String(s.id)] = s.name;
  });

  const initial = steps.find((s) => s.initial_step);

  const adjacency = new Map();
  steps.forEach((s) => {
    const targets = [];
    if (s.next_step && idByName[s.next_step]) targets.push(idByName[s.next_step]);
    adjacency.set(String(s.id), targets);
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
  sortedRemaining.forEach((id) => {
    maxDepth += 1;
    depths[id] = maxDepth;
  });

  const groupByDepth = new Map();
  steps.forEach((s) => {
    const d = depths[String(s.id)] || 1;
    if (!groupByDepth.has(d)) groupByDepth.set(d, []);
    groupByDepth.get(d).push(String(s.id));
  });
  [...groupByDepth.values()].forEach((arr) => arr.sort());

  const X_STEP = 260;
  const Y_STEP = 160;
  const positions = {};
  [...groupByDepth.entries()].forEach(([d, ids]) => {
    ids.forEach((id, idx) => {
      positions[id] = { x: d * X_STEP, y: idx * Y_STEP };
    });
  });

  const nodes = [
    {
      id: "start",
      type: "start",
      data: { strings },
      position: { x: -180, y: 40 },
    },
    ...steps.map((step, ix) => ({
      id: String(step.id),
      type: "step",
      position: positions[String(step.id)] || {
        x: (ix % 3) * 260,
        y: Math.floor(ix / 3) * 180 + 10,
      },
      data: {
        ...step,
        id: String(step.id),
        loop_body_initial_step: step.configuration?.loop_body_initial_step,
        isLoop: step.action_name === "ForLoop",
        actionDescription: actionExplainers[step.action_name],
        strings,
      },
    })),
  ];

  const edges = [];
  if (initial)
    edges.push({
      id: `e-start-${initial.id}`,
      source: "start",
      target: String(initial.id),
      type: "smoothstep",
      animated: true,
    });

  steps.forEach((step) => {
    if (step.next_step) {
      const targetId = idByName[step.next_step];
      edges.push({
        id: `e-${step.id}-${step.next_step}`,
        source: String(step.id),
        target: targetId || String(step.id),
        type: "smoothstep",
        // animated: true,
        data: { missing: !targetId },
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
          type: "default",
          style: {
            stroke: "#f59f00",
            // strokeDasharray: "6 4"
          },
          label: strings.loopBody,
          markerEnd: "arrowclosed",
          data: { loop: true, missing: !loopId },
        });
      }
    }
  });

  return { nodes, edges, idByName, nameById };
};

const StepModal = ({ modal, innerRef, onClose, submitting, error }) => {
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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [savingModal, setSavingModal] = useState(false);
  const modalRef = useRef(null);

  const strings = data.strings || {};

  const refreshGraph = useCallback(
    (nextSteps) => {
      const {
        nodes: n,
        edges: e,
        idByName: idMap,
        nameById: nameMap,
      } = buildGraph(nextSteps, strings, data.actionExplainers || {});
      setNodes(n);
      setEdges(e);
      setIdByName(idMap);
      setNameById(nameMap);
    },
    [data.actionExplainers, setEdges, setNodes, strings]
  );

  useEffect(() => {
    refreshGraph(steps);
  }, [steps, refreshGraph]);

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
    setError("");
    try {
      const fresh = await fetchJson(data.urls.data);
      setSteps(fresh.steps || []);
      setMessage(strings.refresh);
      setTimeout(() => setMessage(""), 1200);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [data.urls.data, fetchJson, strings.refresh]);

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
        setModal({ title: res.title, body: res.form });
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
    return () => formEl.removeEventListener("submit", submitHandler);
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

  const onAddAfter = useCallback(
    (id) => openStepForm({ after_step: id }),
    [openStepForm]
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
      await fetchJson(`/actions/delete-step/${id}`, {
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
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ animated: true }}
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
      />
    </div>
  );
};

export default WorkflowEditor;
