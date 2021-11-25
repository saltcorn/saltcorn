(function () {
  document.addEventListener("DOMContentLoaded", function (e) {
    const categories = document.getElementsByClassName("category");
    if (categories) {
      for (let category of categories) {
        const h2Collection = category.getElementsByTagName("h2");
        const h2 = h2Collection[0];
        if (h2) {
          const packageName = h2.innerText;
          if (packageName) {
            const link = "/module-" + packageName + "_index-" + packageName + "_overview.html";
            h2.addEventListener('click', function () {
              const lastSlash = window.location.href.lastIndexOf("/");
              const basePath = window.location.href.substr(0, lastSlash);
              window.location.href = basePath + link;
            }, false);
          }
        }
      }
    }
  })
})();
