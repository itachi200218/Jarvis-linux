let notifications = [];
let unread = 0;
const listeners = new Set();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState() {
  return {
    notifications,
    unread,
  };
}

export function initNotifications(data) {
  notifications = data;
  unread = data.filter(n => !n.is_read).length;
  notify();
}

export function addNotification(notif) {
  if (notifications.find(n => n.id === notif.id)) return;

  notifications = [notif, ...notifications];
  unread += 1;
  notify();
}

export function markAllRead() {
  notifications = notifications.map(n => ({ ...n, is_read: true }));
  unread = 0;
  notify();
}

export function markOneRead(id) {
  notifications = notifications.map(n =>
    n.id === id ? { ...n, is_read: true } : n
  );
  unread = Math.max(0, unread - 1);
  notify();
}
