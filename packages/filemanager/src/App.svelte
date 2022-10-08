<script>
  import { onMount } from "svelte";
  export let files = [];
  export let roles = [];
  let selectedList = [];
  let selectedFiles = {};
  let lastSelected;
  onMount(async function () {
    const response = await fetch(`/files`, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    const data = await response.json();
    files = data.files;
    roles = data.roles;
  });
  function rowClick(file, e) {
    file.selected = true;
    const prev = selectedFiles[file.filename];
    if (!e.shiftKey) selectedFiles = {};
    selectedFiles[file.filename] = !prev;
    if (!prev) lastSelected = file;

    console.log(lastSelected);
  }
  $: selectedList = Object.entries(selectedFiles)
    .filter(([k, v]) => v)
    .map(([k, v]) => k);
</script>

<main>
  <div class="row">
    <div class={selectedList.length > 0 ? "col-8" : "col-12"}>
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Filename</th>
            <th style="text-align: right">Size (KiB)</th>
            <th>Media type</th>
            <th>Role to access</th>
            <th>Link</th>
            <th>Download</th>
            <th>Delete</th>
          </tr>
        </thead>
        <tbody>
          {#each files as file}
            <tr
              on:click={(e) => rowClick(file, e)}
              class:selected={selectedFiles[file.filename]}
            >
              <td>
                {file.filename}
              </td>
              <td style="text-align: right">
                {file.size_kb}
              </td>
              <td>
                {file.mime_super}/{file.mime_sub}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if selectedList.length > 0}
      <div class="col-4">
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
            <tr>
              <th>Size</th>
              <td>{lastSelected.size_kb} KB</td>
            </tr>
            <tr>
              <th>MIME type</th>
              <td>{lastSelected.mime_super}/{lastSelected.mime_sub}</td>
            </tr>
            <tr>
              <th>Created</th>
              <td>{new Date(lastSelected.uploaded_at).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</main>

<style>
  tr.selected {
    background-color: rgb(143, 180, 255);
  }
  img.file-preview {
    max-height: 200px;
  }
</style>
