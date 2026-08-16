import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const app = initializeApp(APP_CONFIG.firebase);
const auth = getAuth(app);
const loginBox = document.getElementById("loginBox");
const adminContent = document.getElementById("adminContent");
const rows = document.getElementById("bookingRows");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const logoutBtn = document.getElementById("logoutBtn");
const bookingSearch = document.getElementById("bookingSearch");
const deleteAllBtn = document.getElementById("deleteAllBtn");
let bookings = [];

function formatBookingDate(value) {
  const seconds = value?.seconds ?? value?._seconds;
  return seconds ? new Date(seconds * 1000).toLocaleDateString("en-IN") : "Just now";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function statusClass(status) {
  return String(status || "Pending").toLowerCase().replace(/\s+/g, "-");
}

function vehiclePhotoMarkup(photo) {
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(String(photo || ""))) return "No photo";
  return `<a class="vehicle-photo-link" href="${photo}" target="_blank" rel="noopener"><img src="${photo}" alt="Vehicle front view" />View photo</a>`;
}

function renderBookings(list) {
  rows.innerHTML = list.map(booking => {
    const status = booking.status || "Pending";
    const decisionButtons = status === "Pending"
      ? `<button class="btn accept-btn" onclick="updateBookingStatus('${booking.id}','Approved')">Accept</button><button class="btn reject-btn" onclick="updateBookingStatus('${booking.id}','Cancelled')">Reject</button>`
      : "";
    const contactButtons = status === "Approved"
      ? `<button class="btn contact-btn" onclick="contactCustomer('${booking.id}','whatsapp')">WhatsApp</button><button class="btn contact-btn" onclick="contactCustomer('${booking.id}','email')">Email</button>`
      : "";
    return `<tr>
      <td><b>${escapeHtml(booking.bookingReference || booking.id)}</b><br><small>${escapeHtml(booking.bookingDate || formatBookingDate(booking.createdAt))}</small><br><small>${escapeHtml(booking.bookingTime || "")}</small></td>
      <td>${escapeHtml(booking.name)}<br><small>${escapeHtml(booking.mobile)}</small><br><small>${escapeHtml(booking.email)}</small></td>
      <td>${escapeHtml(booking.vehicleNo)}<br><small>${escapeHtml(booking.vehicleBrand || "-")} · ${escapeHtml(booking.vehicleType)} · ${escapeHtml(booking.emissionStandard || "-")} · ${escapeHtml(booking.wheelCount || "-")}</small><br>${vehiclePhotoMarkup(booking.vehicleFrontImage)}</td>
      <td>${escapeHtml(booking.serviceType)}</td>
      <td>${escapeHtml(booking.problem || "-")}</td>
      <td><span class="badge status-${statusClass(status)}">${escapeHtml(status)}</span></td>
      <td class="booking-actions">${decisionButtons}${contactButtons}<button class="btn job-card-btn" onclick="openJobCard('${booking.id}')">Job Card</button></td>
    </tr>`;
  }).join("") || `<tr><td colspan="7">No matching bookings found.</td></tr>`;
}

async function loadBookings(user) {
  const token = await user.getIdToken();
  const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/bookings`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Unable to load bookings");
  bookings = data.bookings;
  filterBookings();
}

function filterBookings() {
  const query = (bookingSearch?.value || "").trim().toLowerCase();
  const filtered = !query ? bookings : bookings.filter(booking => [booking.name, booking.mobile, booking.vehicleNo, booking.bookingReference].some(value => String(value || "").toLowerCase().includes(query)));
  renderBookings(filtered);
}

window.openJobCard = id => location.href = `jobcard.html?id=${encodeURIComponent(id)}`;

window.updateBookingStatus = async (id, status) => {
  const booking = bookings.find(item => item.id === id);
  if (!booking || !auth.currentUser) return;
  const verb = status === "Approved" ? "accept" : "reject";
  if (!confirm(`Do you want to ${verb} booking ${booking.bookingReference}?`)) return;
  try {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/bookings/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Unable to update booking");
    await loadBookings(auth.currentUser);
    if (status === "Approved") alert(`Booking accepted. Customer confirmation is ready for Reference No: ${booking.bookingReference}.`);
  } catch (error) {
    alert(error.message);
  }
};

window.contactCustomer = (id, channel) => {
  const booking = bookings.find(item => item.id === id);
  if (!booking) return;
  const message = `Hello ${booking.name || "Customer"}, your service booking has been confirmed. Reference No: ${booking.bookingReference}. Our team will contact you shortly. - Malligeswaran Auto Diesel Works`;
  if (channel === "whatsapp") {
    const mobile = String(booking.mobile || "").replace(/\D/g, "");
    if (!mobile) return alert("Customer mobile number is not available.");
    const phone = mobile.length === 10 ? `91${mobile}` : mobile;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    return;
  }
  if (!booking.email) return alert("Customer email address is not available.");
  location.href = `mailto:${encodeURIComponent(booking.email)}?subject=${encodeURIComponent(`Service booking confirmed - ${booking.bookingReference}`)}&body=${encodeURIComponent(message)}`;
};

onAuthStateChanged(auth, async user => {
  if (!user) {
    loginBox.classList.remove("hide"); adminContent.classList.add("hide"); logoutBtn.classList.add("hide"); return;
  }
  loginBox.classList.add("hide"); adminContent.classList.remove("hide"); logoutBtn.classList.remove("hide");
  try { await loadBookings(user); } catch (error) { loginBox.textContent = error.message; loginBox.classList.remove("hide"); }
});

loginForm?.addEventListener("submit", async event => {
  event.preventDefault(); loginMessage.textContent = "";
  try { await signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("password").value); }
  catch { loginMessage.textContent = "Invalid email or password."; }
});
document.getElementById("refreshBtn").onclick = () => auth.currentUser && loadBookings(auth.currentUser).catch(error => alert(error.message));
logoutBtn.onclick = () => signOut(auth);
deleteAllBtn?.addEventListener("click", async () => {
  if (!auth.currentUser || !confirm("WARNING: This will permanently delete ALL bookings. Are you absolutely sure?")) return;
  try {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/bookings/all`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error("Failed to delete bookings.");
    await loadBookings(auth.currentUser); alert("All bookings have been deleted successfully.");
  } catch (error) { alert(error.message); }
});
bookingSearch?.addEventListener("input", filterBookings);
setInterval(() => auth.currentUser && loadBookings(auth.currentUser).catch(() => {}), 15000);
