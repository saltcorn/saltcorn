import App from "./App.svelte";
import Picker from "./Picker.svelte";

var target = document.getElementById("saltcorn-file-manager");
const fullManager = target?.getAttribute("full_manager") === "true";

let app = null;
if (fullManager) {
  app = new App({
    target: target,
  });
} else {
  const currentFolder = target?.getAttribute("folder") || "/";
  const inputId = target?.getAttribute("input_id");
  const noSubdirs = target?.getAttribute("no_subdirs") === "true";
  app = new Picker({
    target: target,
    props: {
      currentFolder: currentFolder,
      inputId: inputId,
      noSubdirs: noSubdirs,
    },
  });
}

export default app;
