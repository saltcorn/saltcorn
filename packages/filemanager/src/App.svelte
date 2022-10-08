<script>
  import { onMount } from "svelte";
  export let files = [];
  onMount(async function () {
    const response = await fetch(`/files`, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    const data = await response.json();
    console.log(data);
    files = data;
  });
</script>

<main>
  <table class="table table-sm table-hover">
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
        <tr>
          <td>
            {file.filename}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</main>

<style>
</style>
