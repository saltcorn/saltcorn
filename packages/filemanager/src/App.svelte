<script>
  import { onMount } from "svelte";
  export let files = [];
  let selectedFiles = {};
  onMount(async function () {
    const response = await fetch(`/files`, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    const data = await response.json();
    files = data;
  });
  function rowClick(file, e) {
    file.selected = true;
    if (!e.shiftKey) selectedFiles = {};
    selectedFiles[file.filename] = !selectedFiles[file.filename];
  }
</script>

<main>
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
</main>

<style>
  tr.selected {
    background-color: rgb(143, 180, 255);
  }
</style>
