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
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    const data = await response.json();
    files = data.files;
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
  async function deleteButton() {
    if (!confirm(`Delete files: ${selectedList.join()}`)) return;
    for (const fileNm of selectedList) {
      const file = files.find((f) => f.filename === fileNm);
      await fetch(`/files/delete/${file.location}`, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "CSRF-Token": window._sc_globalCsrf,
        },
        method: "POST",
      });
    }
    await fetchAndReset();
  }
  async function changeAccessRole(e) {
    const role = e.target.value;
    for (const fileNm of selectedList) {
      const file = files.find((f) => f.filename === fileNm);
      await fetch(`/files/setrole/${file.location}`, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "CSRF-Token": window._sc_globalCsrf,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
        method: "POST",
      });
    }
    await fetchAndReset(true);
  }
  async function moveDirectory(e) {
    for (const fileNm of selectedList) {
      const new_path = e.target.value;
      if (!new_path) return;
      const file = files.find((f) => f.filename === fileNm);
      await fetch(`/files/move/${file.location}`, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "CSRF-Token": window._sc_globalCsrf,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ new_path }),
        method: "POST",
      });
    }
    await fetchAndReset();
  }

  function gotoFolder(folder) {
    currentFolder = folder;
    fetchAndReset();
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
</script>

<main>
  <div class="row">
    <div class="col-8">
      <div>
        {currentFolder || "/"}
      </div>
      <table class="table table-sm">
        <thead>
          <tr>
            <th />
            <th>Filename</th>
            <th style="text-align: right">Size (KiB)</th>
            <th>Role to access</th>
            <th>Created</th>
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
        </tbody>
      </table>
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
              <th>Role to access</th>
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
          and {selectedList.length - 1} more file{selectedList.length > 2
            ? "s"
            : ""}:
        {/if}
        <div class="file-actions">
          <button class="btn btn-danger" on:click={deleteButton}>
            <Fa icon={faTrashAlt} />
          </button>
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
        </div>
      {/if}
    </div>
  </div>
</main>

<style>
  tr.selected {
    background-color: rgb(143, 180, 255);
  }
  img.file-preview {
    max-height: 200px;
    max-width: 100%;
  }
  div.file-actions select {
    width: unset;
    display: inline;
  }
</style>
