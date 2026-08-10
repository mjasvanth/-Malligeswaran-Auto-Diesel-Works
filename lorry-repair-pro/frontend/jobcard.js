import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const app = initializeApp(APP_CONFIG.firebase);
const auth = getAuth(app);
const id = new URLSearchParams(location.search).get("id");

async function load(user){
  if(!id){ alert("Missing booking ID"); return; }
  const token = await user.getIdToken();
  const res = await fetch(`${APP_CONFIG.API_BASE_URL}/api/bookings/${encodeURIComponent(id)}`, {
    headers:{Authorization:`Bearer ${token}`}
  });
  const out = await res.json();
  if(!res.ok) throw new Error(out.message || "Unable to load booking");
  const b=out.booking;
  document.getElementById("jobNo").textContent = `JC-${String(b.id).slice(0,8).toUpperCase()}`;
  document.getElementById("jobDate").textContent = new Date().toLocaleDateString("en-IN");
  for(const [k,id2] of [["name","name"],["mobile","mobile"],["vehicleNo","vehicleNo"],["vehicleType","vehicleType"],["serviceType","serviceType"],["preferredDate","preferredDate"],["problem","problem"]]){
    document.getElementById(id2).textContent=b[k]||"—";
  }
}
onAuthStateChanged(auth,user=>{if(user) load(user).catch(e=>alert(e.message)); else alert("Please login as admin.");});
