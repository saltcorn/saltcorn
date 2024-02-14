var logViewerHelpers = (() => {
  const messages = [];
  let currentPage = 1;
  const rowsPerPage = 20;
  const dateOptions = {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  };

  const logLevelColor = (level) => {
    switch (parseInt(level)) {
      case 4:
        return "text-primary";
      case 3:
        return "text-warning";
      case 2:
        return "text-info";
      case 1:
        return "text-danger";
    }
    return "";
  };

  const buildLogRow = (date, level, text) => {
    return `
    <tr>
      <td>
        ${new Date(date).toLocaleDateString(
          window.detected_locale || "en",
          dateOptions
        )}
      </td>
      <td class="${logLevelColor(level)} fw-bold">
        ${text}
      </td>
    </tr>
    `;
  };

  const buildPaginationItem = (n) => `
  <li class="page-item">
    <span 
      class="page-link link-style" 
      onclick="logViewerHelpers.goToLogsPage(${n})" 
      role="link">
        ${n}
    </span>
  </li>
`;

  const handleLogMsg = (msg) => {
    messages.push(msg);
    const tbl = $("#_sc_logs_tbl_id_");
    if (currentPage === 1) {
      const tbody = tbl.find("tbody");
      const allTblRows = tbody.find("tr");
      if (allTblRows.length >= rowsPerPage)
        allTblRows[allTblRows.length - 1].remove();
      tbody.prepend(buildLogRow(msg.time, msg.level, msg.text));
    }
    if (messages.length % rowsPerPage === 1) {
      const pagination = tbl.find(".pagination");
      pagination.append(
        buildPaginationItem(Math.trunc(messages.length / rowsPerPage + 1))
      );
    }
    logViewerHelpers.goToLogsPage(currentPage);
  };
  const startTrackingMsg = () => {
    const startedMsg = {
      time: new Date().toLocaleDateString("de-DE", dateOptions),
      level: 5,
      text: "tracking started",
    };
    messages.push(startedMsg);
    const tbl = $("#_sc_logs_tbl_id_");
    tbl
      .find("tbody")
      .append(buildLogRow(startedMsg.time, startedMsg.level, startedMsg.text));
  };

  return {
    init_log_socket: () => {
      const socket = io({ transports: ["websocket"] });
      socket.emit("join_log_room", "public");
      startTrackingMsg();
      socket.on("log_msg", (msg) => handleLogMsg(msg));
    },
    goToLogsPage: (n) => {
      currentPage = n;
      $(".page-item").removeClass("active");
      $(`.page-item:nth-child(${n})`).addClass("active");
      let end = messages.length - rowsPerPage * n;
      let start = end + rowsPerPage;
      const tbl = $("#_sc_logs_tbl_id_");
      const tbody = tbl.find("tbody");
      tbody.empty();
      for (let i = start; i > end; i--) {
        if (i < 1) break;
        const msg = messages[i - 1];
        tbody.append(buildLogRow(msg.time, msg.level, msg.text));
      }
    },
  };
})();
