<script>
  import { onMount } from "svelte";
  import Fa from "svelte-fa";
  import {
    faTrashAlt,
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
  let selectedList = [];
  let selectedFiles = {};
  let rolesList;
  let lastSelected;
  const fetchAndReset = async function (keepSelection) {
    const response = await fetch(`/files?dir=${currentFolder}`, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });
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
    clickHeader("filename");
  };
  onMount(fetchAndReset);
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
    console.log(lastSelected);
  }
  $: selectedList = Object.entries(selectedFiles)
    .filter(([k, v]) => v)
    .map(([k, v]) => k);

  async function POST(url, body) {
    return await fetch(url, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        "CSRF-Token": window._sc_globalCsrf,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify(body || {}),
    });
  }

  async function goAction(e) {
    const action = e?.target.value;
    if (!action) return;
    switch (action) {
      case "Delete":
        if (!confirm(`Delete files: ${selectedList.join()}`)) return;
        for (const fileNm of selectedList) {
          const file = files.find((f) => f.filename === fileNm);
          const delres=await POST(`/files/delete/${file.location}`);
          const deljson = await delres.json()
          if(deljson.error) {
            window.notifyAlert({ type: "danger", text: deljson.error })
          }
        }
        await fetchAndReset();
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

  let sortBy;
  let sortDesc = false;
  function clickHeader(varNm) {
    if (sortBy === varNm) sortDesc = !sortDesc;
    else sortBy = varNm;
    let getter = (x) => x[sortBy];
    if (sortBy === "uploaded_at") getter = (x) => new Date(x[sortBy]);
    if (sortBy === "filename") getter = (x) => (x[sortBy] || "").toLowerCase();
    const cmp = (a, b) => {
      if (getter(a) < getter(b)) return sortDesc ? 1 : -1;
      if (getter(a) > getter(b)) return sortDesc ? -1 : 1;
      return 0;
    };
    files = files.sort(cmp);
  }
  function getSorterIcon(varNm) {   
    if (varNm !== sortBy) return null;
    return sortDesc ? faCaretDown : faCaretUp;
  }
</script>

<main>
  <div class="row">
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
      <div class="filelist">
        <table class="table table-sm">
          <thead>
            <tr>
              <th />
              <th on:click={() => clickHeader("filename")}>
                Filename
                <Fa icon={getSorterIcon("filename", sortBy, sortDesc)} />
              </th>
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
          <select class="form-select" on:change={changeAccessRole}>
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
          </select>
        </div>
      {/if}
    </div>
  </div>
</main>

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
