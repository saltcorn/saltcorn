/**
 * Helpers for socket events emitted in the cluster primary
 *
 * @category server
 * @module socket_forwarding
 */

/**
 * Is this IPC message a socket event (delivered to browsers, not to State)?
 * @param {object} msg
 * @returns {boolean}
 */
export const isSocketEventMsg = (msg) =>
  !!(
    msg.dynamic_update ||
    msg.real_time_collab_event ||
    msg.real_time_chat_event ||
    msg.log_event ||
    msg.restore_progress_event
  );

/**
 * The primary has no socket.io server when workers are forked, so hand its
 * socket events to one worker. The cluster adapter delivers them to all workers.
 * @param {object} state the State to install the emitters on
 * @param {function} getWorkers returns the forked workers
 */
export const forwardPrimarySocketEmits = (state, getWorkers) => {
  const sendToOneWorker = (msg) => {
    const worker = getWorkers()[0];
    if (worker) worker.send(msg);
  };
  state.setDynamicUpdateEmitter((tenant, data, userIds) =>
    sendToOneWorker({ dynamic_update: data, tenant, userIds })
  );
  state.setCollabEmitter((tenant, type, data, viewname) =>
    sendToOneWorker({
      real_time_collab_event: { type, data, viewname },
      tenant,
    })
  );
  state.setLogEmitter((tenant, min_level, msg) =>
    sendToOneWorker({ log_event: { min_level, msg }, tenant })
  );
  state.setRestoreEmitter((tenant, jobId, data) =>
    sendToOneWorker({ restore_progress_event: { jobId, data }, tenant })
  );
  state.setRoomEmitter((...args) =>
    sendToOneWorker({ real_time_chat_event: { ...args } })
  );
};
