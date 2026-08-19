const API_BASE = "https://schoolerp-8tg2.onrender.com/api";

const Auth = {
  getToken: () => localStorage.getItem("sdps_token"),
  setToken: (t) => localStorage.setItem("sdps_token", t),
  clear: () => localStorage.removeItem("sdps_token"),
  isLoggedIn: () => !!localStorage.getItem("sdps_token"),
};

async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = Auth.getToken();
  if (token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }

  if (!res.ok) {
    const message = (data && data.error) || "Something went wrong. Please try again.";
    if (res.status === 401) {
      Auth.clear();
      if (!location.pathname.endsWith("login.html")) {
        location.href = "login.html";
      }
    }
    throw new Error(message);
  }
  return data;
}

function requireLogin() {
  if (!Auth.isLoggedIn()) location.href = "login.html";
}

function logout() {
  Auth.clear();
  location.href = "login.html";
}

function showToast(message, type = "success") {
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
