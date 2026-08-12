import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const auth = getAuth(initializeApp(APP_CONFIG.firebase));
const form = document.getElementById("statusForm");
const message = document.getElementById("statusMessage");
const result = document.getElementById("statusResult");

onAuthStateChanged(auth, user => { if (!user) location.replace("auth.html"); });

form.addEventListener("submit", async event => {
  event.preventDefault();
  const reference = document.getElementById("bookingReference").value.trim();
  message.textContent = "Checking service status...";
  message.style.color = "";
  result.hidden = true;
  try {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/customer-bookings/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${token}` } });
    const output = await response.json();
    if (!response.ok) throw new Error(output.message || "Unable to load service status.");
    const booking = output.booking;
    message.textContent = "";
    result.innerHTML = `<span class="eyebrow">CURRENT STATUS</span><h3>${escapeHtml(booking.status)}</h3><p><b>Reference No:</b> ${escapeHtml(booking.bookingReference)}<br><b>Vehicle:</b> ${escapeHtml(booking.vehicleNo)} (${escapeHtml(booking.vehicleType)})<br><b>Service:</b> ${escapeHtml(booking.serviceType)}<br><b>Booked:</b> ${escapeHtml(booking.bookingDate || "-")} ${escapeHtml(booking.bookingTime || "")}</p>`;
    result.hidden = false;
  } catch (error) { message.textContent = error.message; message.style.color = "crimson"; }
});

function escapeHtml(value) { return String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char])); }
