import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const app = initializeApp(APP_CONFIG.firebase);
const auth = getAuth(app);
const loginBox = document.getElementById("loginBox");
const adminContent = document.getElementById("adminContent");
const rows = document.getElementById("bookingRows");

async function loadBookings(user) {
  const token = await user.getIdToken();
  const res = await fetch(`${APP_CONFIG.API_BASE_URL}/api/bookings`, {
    headers: {Authorization: `Bearer ${token}`}
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Unable to load bookings");

  rows.innerHTML = data.bookings.map(b => `
    <tr>
      <td><b>${escapeHtml(b.id)}</b></td>
      <td>${escapeHtml(b.name || "")}<br><small>${escapeHtml(b.mobile || "")}</small></td>
      <td>${escapeHtml(b.vehicleNo || "")}<br><small>${escapeHtml(b.vehicleType || "")}</small></td>
      <td>${escapeHtml(b.serviceType || "")}</td>
      <td>${escapeHtml(b.preferredDate || "-")}</td>
      <td><span class="badge">${escapeHtml(b.status || "Pending")}</span></td>
      <td><button class="btn primary" onclick="openJobCard('${b.id}')">Job Card</button></td>
    </tr>`).join("");
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
window.openJobCard = id => location.href = `jobcard.html?id=${encodeURIComponent(id)}`;

onAuthStateChanged(auth, async user => {
  if (!user) {
    loginBox.textContent = "Please sign in through your Firebase admin login, then open this page.";
    return;
  }
  loginBox.classList.add("hide");
  adminContent.classList.remove("hide");
  try { await loadBookings(user); } catch(e) { loginBox.textContent = e.message; loginBox.classList.remove("hide"); }
});

document.getElementById("refreshBtn").onclick = () => {
  const user = auth.currentUser;
  if (user) loadBookings(user).catch(e => alert(e.message));
};
document.getElementById("logoutBtn").onclick = () => signOut(auth);
