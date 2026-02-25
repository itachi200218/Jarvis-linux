const BASE_URL = "http://127.0.0.1:8000/notifications";

export async function getNotifications(token) {
  const res = await fetch(BASE_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.json();
}

export async function markNotificationRead(id, token) {
  await fetch(`${BASE_URL}/${id}/read`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function markAllRead(token) {
  await fetch(`${BASE_URL}/read-all`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
