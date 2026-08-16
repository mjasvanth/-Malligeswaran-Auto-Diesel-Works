import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const auth = getAuth(initializeApp(APP_CONFIG.firebase));
const form = document.getElementById("statusForm");
const message = document.getElementById("statusMessage");
const result = document.getElementById("statusResult");
const historyContainer = document.getElementById("bookingHistory");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function money(value) { return `₹ ${Number(value || 0).toFixed(2)}`; }

function jobCardMarkup(jobCard) {
  if (!jobCard) return "";
  const items = (jobCard.items || []).map(item => `<li>${escapeHtml(item.description || "Service item")} — ${escapeHtml(item.quantity)} × ${money(item.rate)} = <b>${money(item.amount)}</b></li>`).join("");
  return `<details class="customer-job-card"><summary>View saved job card ${escapeHtml(jobCard.jobCardNo || "")}</summary><p><b>Job card date:</b> ${escapeHtml(jobCard.jobCardDate || "-")} ${escapeHtml(jobCard.jobCardTime || "")}</p><ul>${items || "<li>No bill items added.</li>"}</ul><p><b>Subtotal:</b> ${money(jobCard.subtotal)}<br><b>GST:</b> ${money(jobCard.gstAmount)}<br><b>Grand Total:</b> ${money(jobCard.grandTotal)}</p></details>`;
}

function bookingMarkup(booking) {
  const notice = booking.customerNotification ? `<div class="booking-status-notice ${escapeHtml(booking.customerNotification.type || "")}"><b>${escapeHtml(booking.customerNotification.title || "Booking update")}</b><p>${escapeHtml(booking.customerNotification.message || "")}</p></div>` : "";
  return `<span class="eyebrow">CURRENT STATUS</span><h3>${escapeHtml(booking.status)}</h3>${notice}<p><b>Reference No:</b> ${escapeHtml(booking.bookingReference)}<br><b>Vehicle:</b> ${escapeHtml(booking.vehicleNo)} (${escapeHtml(booking.vehicleType)})<br><b>Service:</b> ${escapeHtml(booking.serviceType)}<br><b>Booked:</b> ${escapeHtml(booking.bookingDate || "-")} ${escapeHtml(booking.bookingTime || "")}</p>${jobCardMarkup(booking.jobCard)}`;
}

async function loadBookingHistory(user) {
  historyContainer.innerHTML = "<p>Loading your past bookings...</p>";
  const token = await user.getIdToken();
  const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/customer/my-bookings`, { headers: { Authorization: `Bearer ${token}` } });
  const output = await response.json();
  if (!response.ok) throw new Error(output.message || "Could not load your booking history.");
  if (!output.bookings?.length) {
    historyContainer.innerHTML = "<p>No bookings found for this account yet.</p>";
    return;
  }
  historyContainer.innerHTML = `<h2>Your Past Bookings</h2>${output.bookings.map(booking => `<article class="booking-history-card"><h3>${escapeHtml(booking.status)}</h3><p><b>Reference:</b> ${escapeHtml(booking.bookingReference)}<br><b>Vehicle:</b> ${escapeHtml(booking.vehicleNo)}<br><b>Service:</b> ${escapeHtml(booking.serviceType)}<br><b>Date:</b> ${escapeHtml(booking.bookingDate || "-")} ${escapeHtml(booking.bookingTime || "")}</p>${jobCardMarkup(booking.jobCard)}</article>`).join("")}`;
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const user = auth.currentUser;
  if (!user) return;
  const reference = document.getElementById("bookingReference").value.trim();
  message.textContent = "Checking service status...";
  message.style.color = "";
  result.hidden = true;
  try {
    const token = await user.getIdToken();
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/customer-bookings/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${token}` } });
    const output = await response.json();
    if (!response.ok) throw new Error(output.message || "Unable to load service status.");
    result.innerHTML = bookingMarkup(output.booking);
    result.hidden = false;
    message.textContent = "";
  } catch (error) {
    message.textContent = error.message;
    message.style.color = "crimson";
  }
});

onAuthStateChanged(auth, user => {
  if (!user) {
    location.replace("auth.html");
    return;
  }
  loadBookingHistory(user).catch(error => {
    historyContainer.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  });
});
