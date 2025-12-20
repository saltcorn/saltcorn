(function () {
  console.log("Multi-file upload script loaded");
  // const FILEPOND_JS = "https://unpkg.com/filepond@4.36.2/dist/filepond.min.js";
  const FILEPOND_JS =
    "https://cdn.jsdelivr.net/npm/filepond@4.32.10/dist/filepond.min.js";
  // const FILEPOND_CSS = "https://unpkg.com/filepond@4.36.2/dist/filepond.min.css";
  const FILEPOND_CSS =
    "https://cdn.jsdelivr.net/npm/filepond@4.32.10/dist/filepond.min.css";
  const ready = (fn) =>
    document.readyState !== "loading"
      ? fn()
      : document.addEventListener("DOMContentLoaded", fn);

  const notify = (opts) => {
    if (typeof window.notifyAlert === "function") window.notifyAlert(opts);
    else if (opts?.text) console.warn(opts.type || "info", opts.text);
  };

  const loadCss = (href) =>
    new Promise((resolve, reject) => {
      if (document.querySelector(`link[data-mfu-css="${href}"]`))
        return resolve();
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.mfuCss = href;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Unable to load ${href}`));
      document.head.appendChild(link);
    });

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-mfu-script="${src}"]`)) {
        if (window.FilePond) return resolve(window.FilePond);
      }
      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.dataset.mfuScript = src;
      script.onload = () => resolve(window.FilePond);
      script.onerror = () => reject(new Error(`Unable to load ${src}`));
      document.body.appendChild(script);
    });

  let filePondPromise;
  const ensureFilePond = () => {
    if (window.FilePond) return Promise.resolve(window.FilePond);
    if (!filePondPromise)
      filePondPromise = Promise.all([
        loadCss(FILEPOND_CSS),
        loadScript(FILEPOND_JS),
      ])
        .then(() => window.FilePond)
        .catch((err) => {
          notify({ type: "danger", text: err.message || err });
          throw err;
        });
    return filePondPromise;
  };

  const updateStatus = (root, text) => {
    const target = root.querySelector("[data-mfu-status]");
    if (target) target.textContent = text || "";
  };

  const setBusy = (root, busy, message) => {
    const input = root.querySelector("[data-mfu-input]");
    if (busy) root.classList.add("sc-mfu-uploading");
    else root.classList.remove("sc-mfu-uploading");
    if (input) input.disabled = !!busy;
    updateStatus(root, message || (busy ? root._mfuCfg.uploadingText : ""));
  };

  const fetchJson = (url, options = {}) => {
    const headers = options.headers || {};
    headers["CSRF-Token"] =
      window._sc_globalCsrf || headers["CSRF-Token"] || "";
    headers["Page-Load-Tag"] =
      window._sc_pageloadtag || headers["Page-Load-Tag"] || "";
    return fetch(url, { ...options, headers }).then((res) => {
      if (!res.ok) throw new Error(res.statusText || "Request failed");
      return res.json();
    });
  };

  const uploadFiles = (root, files) => {
    console.log("Uploading files", files, root);
    const cfg = root._mfuCfg;
    if (!cfg?.rowId || !files?.length) return;
    const formData = new FormData();
    Array.from(files).forEach((file) =>
      formData.append("files", file, file.name)
    );
    formData.append("row_id", cfg.rowId);
    root._mfuPending = (root._mfuPending || 0) + 1;
    setBusy(root, true, cfg.uploadingText);
    return fetchJson(`/view/${encodeURIComponent(cfg.viewname)}/upload_files`, {
      method: "POST",
      body: formData,
    })
      .then((json) => handleResponse(root, json))
      .catch((err) => {
        notify({ type: "danger", text: err.message || cfg.errorText });
      })
      .finally(() => {
        root._mfuPending -= 1;
        if (root._mfuPending <= 0) {
          setBusy(root, false, "");
          const input = root.querySelector("[data-mfu-input]");
          if (input) input.value = "";
        }
      });
  };

  const handleResponse = (root, json) => {
    const cfg = root._mfuCfg;
    if (json?.error) {
      notify({ type: "danger", text: json.error });
      return;
    }
    if (cfg.showList && json?.listHtml) {
      const list = root.querySelector("[data-mfu-list]");
      if (list) list.innerHTML = json.listHtml;
    }
    if (json?.uploaded) {
      notify({ type: "success", text: cfg.successText });
    }
  };

  const deleteFile = (root, childId) => {
    const cfg = root._mfuCfg;
    if (!cfg?.rowId) return;
    if (cfg.deleteConfirm && !window.confirm(cfg.deleteConfirm)) return;
    setBusy(root, true, cfg.uploadingText);
    fetchJson(`/view/${encodeURIComponent(cfg.viewname)}/delete_file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ child_id: childId, row_id: cfg.rowId }),
    })
      .then((json) => handleResponse(root, json))
      .catch((err) =>
        notify({ type: "danger", text: err.message || cfg.errorText })
      )
      .finally(() => setBusy(root, false, ""));
  };

  const wireDropzone = (root, dropzone, input) => {
    if (!dropzone) return;
    const stop = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    ["dragenter", "dragover"].forEach((evt) =>
      dropzone.addEventListener(evt, (ev) => {
        stop(ev);
        dropzone.classList.add("sc-mfu-dropzone--active");
      })
    );
    ["dragleave", "dragend", "drop"].forEach((evt) =>
      dropzone.addEventListener(evt, (ev) => {
        stop(ev);
        if (evt !== "drop")
          dropzone.classList.remove("sc-mfu-dropzone--active");
      })
    );
    dropzone.addEventListener("drop", (ev) => {
      const items = ev.dataTransfer?.files;
      dropzone.classList.remove("sc-mfu-dropzone--active");
      if (items?.length) uploadFiles(root, items);
    });
    dropzone.addEventListener("click", () => input?.click());
  };

  const wireInput = (root, input) => {
    if (!input) return;
    input.addEventListener("change", (ev) => {
      if (ev.target.files?.length) uploadFiles(root, ev.target.files);
    });
  };

  const wireDeletes = (root) => {
    root.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-mfu-delete]");
      if (!btn) return;
      const childId = btn.getAttribute("data-mfu-delete");
      deleteFile(root, childId);
    });
  };

  const initFilePond = (root, input) => {
    const cfg = root._mfuCfg;
    ensureFilePond()
      .then((FilePond) => {
        const pond = FilePond.create(input, {
          allowMultiple: true,
          credits: false,
          labelIdle: cfg.dropLabel,
        });
        pond.setOptions({
          server: {
            process: (
              _fieldName,
              file,
              _metadata,
              load,
              error,
              progress,
              abort
            ) => {
              const controller = new AbortController();
              const formData = new FormData();
              formData.append("files", file, file.name);
              formData.append("row_id", cfg.rowId);
              setBusy(root, true, cfg.uploadingText);
              fetchJson(
                `/view/${encodeURIComponent(cfg.viewname)}/upload_files`,
                {
                  method: "POST",
                  body: formData,
                  signal: controller.signal,
                }
              )
                .then((json) => {
                  handleResponse(root, json);
                  load(Date.now().toString());
                })
                .catch((err) => {
                  error(err.message || cfg.errorText);
                })
                .finally(() => setBusy(root, false, ""));
              return {
                abort: () => {
                  controller.abort();
                  abort();
                },
              };
            },
          },
        });
      })
      .catch(() => {});
  };

  const init = (root) => {
    const cfgText = root.getAttribute("data-mfu-config");
    if (!cfgText) return;
    try {
      root._mfuCfg = JSON.parse(cfgText);
    } catch (e) {
      console.error("Invalid MFU config", e);
      return;
    }
    const cfg = root._mfuCfg;
    const disabledBanner = root.querySelector("[data-mfu-disabled]");
    if (!cfg.rowId) {
      if (disabledBanner) {
        disabledBanner.classList.remove("d-none");
        disabledBanner.textContent = cfg.disabledText;
      }
      root.classList.add("sc-mfu-disabled");
      return;
    }
    if (disabledBanner) disabledBanner.classList.add("d-none");
    root.classList.remove("sc-mfu-disabled");
    const input = root.querySelector("[data-mfu-input]");
    const dropzone = root.querySelector("[data-mfu-dropzone]");
    if (cfg.mode === "filepond" && input) initFilePond(root, input);
    else {
      wireInput(root, input);
      wireDropzone(root, dropzone, input);
    }
    wireDeletes(root);
  };

  ready(() => {
    document.querySelectorAll("[data-mfu-root]").forEach((root) => init(root));
  });
})();
