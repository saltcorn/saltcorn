<script>
  import { onMount } from "svelte";
  import Fa from "svelte-fa";
  import {
    faFileImage,
    faFile,
    faFolder,
    faFileCsv,
    faFileExcel,
    faFileWord,
    faFilePdf,
    faFileAlt,
    faFileAudio,
    faFileVideo,
    faFolderPlus,
    faHome,
    faCaretUp,
    faCaretDown,
  } from "@fortawesome/free-solid-svg-icons";
  export let files = [];
  export let directories = [];
  export let roles = {};
  export let currentFolder = "/";
  let noSelectAll = false;
  let selectedList = [];
  let selectedFiles = {};
  let rolesList;
  let lastSelected;
  let sortBy;
  let sortDesc = false;
  let search = "";

  const updateDirState = () => {
    const url = new URL(window.location);
    if (url.searchParams.get("dir") !== currentFolder) {
      url.searchParams.set("dir", currentFolder);
      window.history.replaceState(null, "", url.toString());
    }
  };
  const updateSortState = () => {
    const url = new URL(window.location);
    url.searchParams.set("sortBy", sortBy);
    if (sortDesc) url.searchParams.set("sortDesc", "on");
    else url.searchParams.delete("sortDesc");
    window.history.replaceState(null, "", url.toString());
  };
  const readState = () => {
    const url = new URL(window.location);
    sortBy = url.searchParams.get("sortBy");
    sortDesc = url.searchParams.get("sortDesc") === "on";
    const dirParam = url.searchParams.get("dir");
    if (dirParam) currentFolder = dirParam;
  };
  const fetchAndReset = async function (keepSelection, keepAlerts) {
    const response = await fetch(
      `/files?dir=${encodeURIComponent(currentFolder)}${
        search ? `&search=${encodeURIComponent(search)}` : ""
      }`,
      {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      }
    );
    const data = await response.json();
    files = data.files;
    for (const file of files) {
      file.mimetype =
        file.mime_sub && file.mime_super
          ? `${file.mime_super}/${file.mime_sub}`
          : "";
    }
    directories = data.directories;
    rolesList = data.roles;
    for (const role of data.roles) {
      roles[role.id] = role.role;
    }
    if (!keepSelection) {
      selectedList = [];
      selectedFiles = {};
      lastSelected = null;
    } else if (lastSelected) {
      lastSelected = files.find((f) => f.filename === lastSelected.filename);
    }
    if (!keepAlerts) emptyAlerts();
    clickHeader(sortBy || "filename", true);
  };
  onMount(async () => {
    readState();
    await fetchAndReset(false, true);
  });
  function rowClick(file, e) {
    file.selected = true;
    const prev = selectedFiles[file.filename];
    if (!e.shiftKey) selectedFiles = {};
    selectedFiles[file.filename] = !prev;
    if (!prev) lastSelected = file;
    else {
      const firstSelected = Object.entries(selectedFiles).findLast(
        ([k, v]) => v
      );
      if (firstSelected)
        lastSelected = files.find((f) => f.filename === firstSelected[0]);
      else lastSelected = null;
    }
    document.getSelection().removeAllRanges();
    const select = document.getElementById("setRoleSelectId");
    if (select) select.value = "";
    console.log(lastSelected);
  }

  let ctrlDown = false;
  function onKeyDown(e) {
    if (e.keyCode === 17) ctrlDown = true;
    else if (ctrlDown && e.keyCode === 65 && !noSelectAll) {
      e.preventDefault();
      const selectedLength = Object.values(selectedFiles).filter(
        (v) => v
      ).length;
      const select = selectedLength !== files.length;
      if (!select) lastSelected = undefined;
      for (const file of files) {
        file.selected = select;
        selectedFiles[file.filename] = select;
      }
      if (select && !lastSelected) lastSelected = files[files.length - 1];
    }
  }

  function onKeyUp(e) {
    if (e.keyCode === 17) ctrlDown = false;
  }
  $: selectedList = Object.entries(selectedFiles)
    .filter(([k, v]) => v)
    .map(([k, v]) => k);

  async function POST(url, body, isDownload, isFormData) {
    const go = fetch(url, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        "CSRF-Token": window._sc_globalCsrf,
        ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      },
      method: "POST",
      body: isFormData ? body : JSON.stringify(body || {}),
    });
    if (isDownload) {
      const res = await go;
      const blob = await res.blob();

      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      const header = res.headers.get("Content-Disposition");
      if (header) {
        const parts = header.split(";");
        let filename = parts[1].split("=")[1].replaceAll('"', "");
        link.download = filename;
      } else link.target = "_blank";
      link.click();

      return;
    } else return await go;
  }

  async function goAction(e) {
    const action = e?.target.value;
    if (!action) return;
    switch (action) {
      case "Delete":
        if (!confirm(`Delete files: ${selectedList.join()}`)) return;
        const alerts = [];
        for (const fileNm of selectedList) {
          const file = files.find((f) => f.filename === fileNm);
          const delres = await POST(`/files/delete/${file.location}`);
          const deljson = await delres.json();
          if (deljson.error)
            alerts.push({ type: "danger", text: deljson.error });
        }
        await fetchAndReset();
        for (const alert of alerts) notifyAlert(alert);
        break;
      case "Rename":
        const newName = window.prompt(
          `Rename ${lastSelected.filename} to:`,
          lastSelected.filename
        );
        if (!newName) return;
        await POST(`/files/setname/${lastSelected.location}`, {
          value: newName,
        });
        await fetchAndReset();
        break;
      case "Unzip":
        await POST(`/files/unzip/${lastSelected.location}`, {});
        await fetchAndReset();
        break;
    }
  }
  async function changeAccessRole(e) {
    const role = e.target.value;
    for (const fileNm of selectedList) {
      const file = files.find((f) => f.filename === fileNm);
      await POST(`/files/setrole/${file.location}`, { role });
    }
    await fetchAndReset(true);
  }
  async function downloadZip() {
    const filesToZip = [];
    for (const fileNm of selectedList) {
      filesToZip.push(fileNm);
    }
    await POST(
      `/files/download-zip`,
      {
        files: filesToZip,
        location: currentFolder,
      },
      true
    );
  }
  async function moveDirectory(e) {
    for (const fileNm of selectedList) {
      const new_path = e.target.value;
      if (!new_path) return;
      const file = files.find((f) => f.filename === fileNm);
      await POST(`/files/move/${file.location}`, { new_path });
    }
    await fetchAndReset();
  }

  function gotoFolder(folder) {
    currentFolder = folder;
    updateDirState();
    fetchAndReset();
  }

  let pathSegments = [];
  $: {
    if (currentFolder === "/" || currentFolder === "")
      pathSegments = [{ icon: faHome, location: "/" }];
    else {
      pathSegments = currentFolder.split("/").map((name, i) => ({
        name,
        location: currentFolder
          .split("/")
          .slice(0, i + 1)
          .join("/"),
      }));
      pathSegments.unshift({ icon: faHome, location: "/" });
    }
  }

  function getIcon(file) {
    if (file.mime_super === "image") return faFileImage;
    if (file.mime_super === "audio") return faFileAudio;
    if (file.mime_super === "video") return faFileVideo;
    if (file.mime_sub === "pdf") return faFilePdf;

    if (file.isDirectory) return faFolder;
    const fname = file.filename.toLowerCase();
    if (fname.endsWith(".csv")) return faFileCsv;
    if (fname.endsWith(".xls")) return faFileExcel;
    if (fname.endsWith(".xlsx")) return faFileExcel;
    if (fname.endsWith(".doc")) return faFileWord;
    if (fname.endsWith(".docx")) return faFileWord;
    if (fname.endsWith(".txt")) return faFileAlt;
    return faFile;
  }

  function clickHeader(varNm, isInit) {
    if (sortBy === varNm && !isInit) sortDesc = !sortDesc;
    else if (sortBy !== varNm) {
      sortBy = varNm;
      sortDesc = false;
    }
    let getter = (x) => x[sortBy];
    if (sortBy === "uploaded_at") getter = (x) => new Date(x[sortBy]);
    if (sortBy === "filename") getter = (x) => (x[sortBy] || "").toLowerCase();
    const cmp = (a, b) => {
      if (getter(a) < getter(b)) return sortDesc ? 1 : -1;
      if (getter(a) > getter(b)) return sortDesc ? -1 : 1;
      return 0;
    };
    files = files.sort(cmp);
    updateSortState();
  }
  function getSorterIcon(varNm) {
    if (varNm !== sortBy) return null;
    return sortDesc ? faCaretDown : faCaretUp;
  }

  function formatLocation(file) {
    let relative =
      currentFolder === "/"
        ? file.location
        : file.location.substr(currentFolder.length);
    if (relative.startsWith("/")) relative = relative.substr(1);
    return relative.substr(0, relative.length - file.filename.length);
  }

  async function uploadFiles(files) {
    try {
      const body = new FormData();
      for (const file of files) {
        body.append("file", file);
      }
      body.append("folder", currentFolder);
      const resp = await POST("/files/upload", body, false, true);
      if (resp?.status === 200) {
        await fetchAndReset();
        const data = await resp.json();
        notifyAlert({ type: "success", text: data?.success?.msg || "Success" });
      } else notifyAlert({ type: "warning", text: "Unable to upload" });
    } catch (error) {
      notifyAlert({
        type: "danger",
        text: error.message ? error.message : "An error occured.",
      });
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    if (e.dataTransfer?.files?.length > 0) uploadFiles(e.dataTransfer.files);
  }
</script>

<main>
  <div
    id="drop-zone"
    on:drop={handleDrop}
    ondragover="return false"
    class="row"
  >
    <div class="col-8">
      <div>
        <nav aria-label="breadcrumb">
          <ol class="breadcrumb">
            {#each pathSegments as segment}
              <li
                class="breadcrumb-item"
                on:click={gotoFolder(segment.location)}
              >
                {#if segment.icon}
                  <Fa icon={segment.icon} />
                {:else}
                  {segment.name}
                {/if}
              </li>
            {/each}
          </ol>
        </nav>
      </div>
      <div class="input-group search-bar mb-3">
        <button
          on:click={async (e) => {
            await fetchAndReset();
          }}
          class="btn btn-outline-secondary search-bar"
          type="submit"
          id="button-search-submit"
        >
          <i class="fas fa-search" />
        </button>

        <input
          on:change={async (e) => {
            search = e.target.value;
            await fetchAndReset();
          }}
          on:focus={() => {
            noSelectAll = true;
          }}
          on:blur={() => {
            noSelectAll = false;
          }}
          type="search"
          class="form-control search-bar"
          placeholder="Search Files"
          aria-label="Search"
          aria-describedby="button-search-submit"
        />
      </div>

      <div class="filelist">
        <table class="table table-sm">
          <thead>
            <tr>
              <th />
              <th on:click={() => clickHeader("filename")}>
                Filename
                <Fa icon={getSorterIcon("filename", sortBy, sortDesc)} />
              </th>
              {#if search}
                <th>Location</th>
              {/if}
              <th on:click={() => clickHeader("mimetype")}>
                Media type
                <Fa icon={getSorterIcon("mimetype", sortBy, sortDesc)} />
              </th>
              <th
                on:click={() => clickHeader("size_kb")}
                style="text-align: right"
              >
                <Fa icon={getSorterIcon("size_kb", sortBy, sortDesc)} />
                Size (KiB)
              </th>
              <th on:click={() => clickHeader("min_role_read")}>
                Role to access
                <Fa icon={getSorterIcon("min_role_read", sortBy, sortDesc)} />
              </th>
              <th on:click={() => clickHeader("uploaded_at")}>
                Created
                <Fa icon={getSorterIcon("uploaded_at", sortBy, sortDesc)} />
              </th>
            </tr>
          </thead>
          <tbody>
            {#each files as file}
              <tr
                on:click={(e) => rowClick(file, e)}
                on:dblclick={() => {
                  if (file.isDirectory) gotoFolder(file.location);
                  else window.open(`/files/serve/${file.location}`);
                }}
                class:selected={selectedFiles[file.filename]}
              >
                <td>
                  <Fa size="lg" icon={getIcon(file)} />
                </td>
                <td>
                  {#if file.isDirectory}
                    {file.filename}/
                  {:else}
                    {file.filename}
                  {/if}
                </td>
                {#if search}
                  <td>
                    {formatLocation(file)}
                  </td>
                {/if}
                <td>
                  {file.mimetype}
                </td>
                <td style="text-align: right">
                  {file.isDirectory ? "" : file.size_kb}
                </td>
                <td>
                  {roles[file.min_role_read]}
                </td>
                <td>
                  {new Date(file.uploaded_at).toLocaleString()}
                </td>
              </tr>
            {/each}
            <tr on:click={() => window.create_new_folder(currentFolder)}>
              <td>
                <Fa size="lg" icon={faFolderPlus} />
              </td>
              <td>Create new folder...</td>
              {#if search}<td />{/if}
              <td />
              <td />
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="col-4">
      {#if selectedList.length > 0}
        <h5>{lastSelected.filename}</h5>

        {#if lastSelected.mime_super === "image"}
          <img
            class="file-preview my-2"
            src={`/files/serve/${lastSelected.location}`}
            alt={lastSelected.filename}
          />
        {/if}
        <table>
          <tbody>
            {#if !lastSelected.isDirectory}
              <tr>
                <th>Size</th>
                <td>{lastSelected.size_kb} KB</td>
              </tr>
            {/if}

            <tr>
              <th>MIME type</th>
              <td>
                {#if lastSelected.isDirectory}
                  Directory
                {:else}
                  {lastSelected.mime_super}/{lastSelected.mime_sub}
                {/if}
              </td>
            </tr>
            <tr>
              <th>Created</th>
              <td>{new Date(lastSelected.uploaded_at).toLocaleString()}</td>
            </tr>
            <tr>
              <th class="pe-1">Role to access</th>
              <td>{roles[lastSelected.min_role_read]}</td>
            </tr>
          </tbody>
        </table>
        <div>
          <a href={`/files/serve/${lastSelected.location}`}>Link</a>
          &nbsp;|&nbsp;
          <a href={`/files/download/${lastSelected.location}`}>Download</a>
        </div>
        {#if selectedList.length > 1}
          <strong
            >and {selectedList.length - 1} other file{selectedList.length > 2
              ? "s"
              : ""}:
          </strong>
        {/if}
        <div class="file-actions d-flex">
          <select
            id="setRoleSelectId"
            class="form-select"
            on:change={changeAccessRole}
          >
            <option value="" disabled selected>Set access</option>
            {#each rolesList as role}
              <option value={role.id}>{role.role}</option>
            {/each}
          </select>

          <select class="form-select" on:change={moveDirectory}>
            <option value="" disabled selected>Move to...</option>
            {#each directories as dir}
              <option>{dir.location || "/"}</option>
            {/each}
          </select>
          <select class="form-select" on:change={goAction}>
            <option value="" disabled selected>Action...</option>
            <option>Delete</option>
            {#if selectedList.length === 1}
              <option>Rename</option>
            {/if}
            {#if selectedList.length === 1 && lastSelected.filename.endsWith(".zip")}
              <option>Unzip</option>
            {/if}
          </select>
        </div>
        {#if selectedList.length > 1}
          <button class="btn btn-outline-secondary mt-2" on:click={downloadZip}>
            <i class="fas fa-file-archive" />
            Download Zip Archive
          </button>
        {/if}
      {/if}
    </div>
  </div>
</main>

<svelte:window on:keydown={onKeyDown} on:keyup={onKeyUp} />

<style>
  tr.selected {
    background-color: rgb(213, 237, 255);
  }
  img.file-preview {
    max-height: 200px;
    max-width: 100%;
  }
  div.file-actions select {
    width: unset;
    display: inline;
    max-width: 33%;
  }
  div.filelist {
    max-height: 90vh;
    overflow-y: scroll;
  }
</style>
