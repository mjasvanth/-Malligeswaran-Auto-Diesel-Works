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
let bookings = [];

function formatBookingDate(value) {
  const seconds = value?.seconds ?? value?._seconds;
  if (seconds) return new Date(seconds * 1000).toLocaleDateString("en-IN");
  return "Just now";
}

function renderBookings(list) {
  rows.innerHTML = list.map(b => `
    <tr>
      <td><b>${escapeHtml(b.bookingReference || b.id)}</b><br><small>${escapeHtml(b.bookingDate || formatBookingDate(b.createdAt))}</small><br><small>${escapeHtml(b.bookingTime || "")}</small></td>
      <td>${escapeHtml(b.name || "")}<br><small>${escapeHtml(b.mobile || "")}</small><br><small>${escapeHtml(b.email || "")}</small></td>
      <td>${escapeHtml(b.vehicleNo || "")}<br><small>${escapeHtml(b.vehicleType || "")}</small></td>
      <td>${escapeHtml(b.serviceType || "")}</td>
      <td>${escapeHtml(b.lastServiceDate || "No previous date")}<br><small>${escapeHtml(b.lastServiceType || "No previous service details")}</small></td>
      <td>${escapeHtml(b.problem || "-")}</td>
      <td>${formatBookingDate(b.createdAt)}</td>
      <td><span class="badge">${escapeHtml(b.status || "Pending")}</span></td>
      <td><button class="btn primary" onclick="openJobCard('${b.id}')">Job Card</button></td>
    </tr>`).join("") || `<tr><td colspan="9">No matching bookings found.</td></tr>`;
}

async function loadBookings(user) {
  const token = await user.getIdToken();
  const res = await fetch(`${APP_CONFIG.API_BASE_URL}/api/bookings`, {
    headers: {Authorization: `Bearer ${token}`}
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Unable to load bookings");

  bookings = data.bookings;
  filterBookings();
}
function filterBookings() {
  const query = (bookingSearch?.value || "").trim().toLowerCase();
  const filtered = !query ? bookings : bookings.filter(b => [b.name, b.mobile, b.vehicleNo].some(value => String(value || "").toLowerCase().includes(query)));
  renderBookings(filtered);
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
window.openJobCard = id => location.href = `jobcard.html?id=${encodeURIComponent(id)}`;

onAuthStateChanged(auth, async user => {
  if (!user) {
    loginBox.classList.remove("hide");
    adminContent.classList.add("hide");
    logoutBtn.classList.add("hide");
    return;
  }
  loginBox.classList.add("hide");
  adminContent.classList.remove("hide");
  logoutBtn.classList.remove("hide");
  try { await loadBookings(user); } catch(e) { loginBox.textContent = e.message; loginBox.classList.remove("hide"); }
});

loginForm?.addEventListener("submit", async event => {
  event.preventDefault();
  loginMessage.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, document.getElementById("email").value, document.getElementById("password").value);
  } catch (error) {
    loginMessage.textContent = "Invalid email or password.";
  }
});

document.getElementById("refreshBtn").onclick = () => {
  const user = auth.currentUser;
  if (user) loadBookings(user).catch(e => alert(e.message));
};
logoutBtn.onclick = () => signOut(auth);
bookingSearch?.addEventListener("input", filterBookings);
