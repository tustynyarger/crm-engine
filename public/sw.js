self.addEventListener("push", (event) => {
  const fallback = {
    title: "CRM Follow-Up",
    body: "You have contacts due for follow-up today.",
    url: "/contacts",
  };

  const data = event.data ? event.data.json() : fallback;
  const title = data.title || fallback.title;
  const options = {
    body: data.body || fallback.body,
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    data: {
      url: data.url || fallback.url,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/contacts";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      return self.clients.openWindow(url);
    }),
  );
});
