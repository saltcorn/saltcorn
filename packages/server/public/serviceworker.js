// do nothing so far

self.addEventListener("fetch", function () {
  return;
});

self.addEventListener("push", function (event) {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
    })
  );
});
