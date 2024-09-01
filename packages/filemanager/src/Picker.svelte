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
    faHome,
    faCaretUp,
    faCaretDown,
  } from "@fortawesome/free-solid-svg-icons";

  export let currentFolder = "/";
  export let noSubdirs = false;
  export let inputId = "";

  let files = [];
  let directories = [];
  let roles = {};

  let sortBy;
  let sortDesc = false;

  let selectedFile = null;
  onMount(async () => {
    await fetchAndReset(false, true);
  });

  const fetchAndReset = async function () {
    const response = await fetch(
      `/files/visible_entries?dir=${encodeURIComponent(currentFolder)}${
        noSubdirs ? "&no_subdirs=true" : ""
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
    for (const role of data.roles) {
      roles[role.id] = role.role;
    }
    window.emptyAlerts();
    clickHeader(sortBy || "filename", true);
  };

  function gotoFolder(folder) {
    currentFolder = folder;
    selectedFile = null;
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
      if (!noSubdirs) pathSegments.unshift({ icon: faHome, location: "/" });
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
  }
  function getSorterIcon(varNm) {
    if (varNm !== sortBy) return null;
    return sortDesc ? faCaretDown : faCaretUp;
  }

  function rowClick(file) {
    selectedFile = file;
  }

  function pickEntry(file) {
    if (file) {
      const input = document.getElementById(inputId);
      if (input) input.value = file.location;
      window.closeModal();
      const label = document.getElementById(`${inputId}-custom-text`);
      if (label) label.innerText = file.filename;
    }
  }
</script>

<main>
  <div class="row">
    <div class="col-8">
      <!-- breadcrumbs only if subdirs are shown -->
      {#if !noSubdirs}
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
      {/if}
      <!-- files and directories -->
      <div class="filelist">
        <table class="table table-sm">
          <!-- meta headers -->
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
          <!-- entries -->
          <tbody>
            {#each files as file}
              <tr
                on:click={(e) => rowClick(file, e)}
                on:dblclick={() => {
                  if (file.isDirectory) gotoFolder(file.location);
                  else pickEntry(file);
                }}
                class:selected={selectedFile?.filename === file.filename}
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
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <button class="btn btn-primary" on:click={() => pickEntry(selectedFile)}>
    Select
  </button>
</main>

<style>
  tr.selected {
    background-color: rgb(213, 237, 255);
  }
  div.filelist {
    max-height: 90vh;
    overflow-y: scroll;
  }
</style>
