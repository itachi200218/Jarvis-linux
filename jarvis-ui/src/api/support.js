const BASE_URL = "http://127.0.0.1:8000/auth/support";

// ==============================
// CREATE NEW TICKET
// ==============================
export async function sendSupportMessage(message, token) {
  const res = await fetch(`${BASE_URL}/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    throw new Error("Failed to create support ticket");
  }

  return res.json(); // { success, action, ticketId }
}

// ==============================
// REPLY TO EXISTING TICKET
// ==============================
export async function replySupportTicket(ticketId, message, token) {
  const res = await fetch(`${BASE_URL}/tickets/${ticketId}/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    throw new Error("Failed to reply to ticket");
  }

  return res.json();
}

// ==============================
// GET ALL USER TICKETS
// ==============================
export async function getSupportTickets(token) {
  const res = await fetch(`${BASE_URL}/tickets`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch tickets");
  }

  return res.json();
}

// ==============================
// GET SINGLE TICKET (MESSAGES)
// ==============================
export async function getSupportTicket(ticketId, token) {
  const res = await fetch(`${BASE_URL}/tickets/${ticketId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch ticket");
  }

  return res.json();
}

// ==============================
// CLOSE TICKET
// ==============================
export async function closeSupportTicket(ticketId, token) {
  const res = await fetch(`${BASE_URL}/tickets/${ticketId}/close`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to close ticket");
  }

  return res.json();
}
