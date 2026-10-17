// No DB needed: State is built in memory and workers are fakes
import { State } from "@saltcorn/data/db/state";
import {
  isSocketEventMsg,
  forwardPrimarySocketEmits,
} from "../socket_forwarding.js";

const fakeWorker = () => {
  const sent = [];
  return { sent, send: (msg) => sent.push(msg) };
};

const setup = () => {
  const state = new State("public");
  state.hasJoinedLogSockets = true;
  state.hasJoinedDynamicUpdateSockets = true;
  state.hasJoinedCollabSockets = true;
  const workers = [fakeWorker(), fakeWorker()];
  forwardPrimarySocketEmits(state, () => workers);
  return { state, workers };
};

describe("isSocketEventMsg", () => {
  it("detects socket events", () => {
    expect(isSocketEventMsg({ dynamic_update: { eval_js: "1" } })).toBe(true);
    expect(isSocketEventMsg({ real_time_collab_event: {} })).toBe(true);
    expect(isSocketEventMsg({ real_time_chat_event: {} })).toBe(true);
    expect(isSocketEventMsg({ log_event: {} })).toBe(true);
    expect(isSocketEventMsg({ restore_progress_event: {} })).toBe(true);
  });
  it("ignores other messages", () => {
    expect(isSocketEventMsg({ refresh: "config", tenant: "public" })).toBe(
      false
    );
    expect(isSocketEventMsg({ node_handle_msg: { id: "x" } })).toBe(false);
  });
});

describe("forwardPrimarySocketEmits", () => {
  it("sends dynamic updates to exactly one worker", () => {
    const { state, workers } = setup();
    state.emitDynamicUpdate("public", { notify: "hi" }, [1, 2], true);
    expect(workers[0].sent).toEqual([
      { dynamic_update: { notify: "hi" }, tenant: "public", userIds: [1, 2] },
    ]);
    expect(workers[1].sent).toEqual([]);
  });

  it("keeps null and undefined userIds apart", () => {
    const { state, workers } = setup();
    state.emitDynamicUpdate("public", { a: 1 }, null, true);
    state.emitDynamicUpdate("public", { a: 2 }, undefined, true);
    expect(workers[0].sent[0].userIds).toBe(null);
    expect(workers[0].sent[1].userIds).toBe(undefined);
  });

  it("forwards collab, log and restore events with their tenant", () => {
    const { state, workers } = setup();
    state.emitCollabMessage("ten1", "row_update", { id: 3 }, "myview", true);
    state.emitLog("ten1", 3, "a log line", true);
    state.emitRestoreProgress("ten1", "job-1", { pct: 50 }, true);
    expect(workers[0].sent).toEqual([
      {
        real_time_collab_event: {
          type: "row_update",
          data: { id: 3 },
          viewname: "myview",
        },
        tenant: "ten1",
      },
      { log_event: { min_level: 3, msg: "a log line" }, tenant: "ten1" },
      {
        restore_progress_event: { jobId: "job-1", data: { pct: 50 } },
        tenant: "ten1",
      },
    ]);
  });

  it("forwards room messages so the worker can spread them back", () => {
    const { state, workers } = setup();
    state.emitRoom("public", "chatview", 7, { text: "yo" }, {
      noMultiNodePropagate: true,
    });
    const [msg] = workers[0].sent;
    expect(Object.values(msg.real_time_chat_event)).toEqual([
      "public",
      "chatview",
      7,
      { text: "yo" },
    ]);
  });

  it("does nothing when no worker is up", () => {
    const state = new State("public");
    state.hasJoinedDynamicUpdateSockets = true;
    forwardPrimarySocketEmits(state, () => []);
    state.emitDynamicUpdate("public", { a: 1 }, undefined, true);
  });
});
