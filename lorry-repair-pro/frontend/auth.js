import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const auth = getAuth(initializeApp(APP_CONFIG.firebase));
const message = document.getElementById("authMessage");
function show(text, error = false) { message.textContent = text; message.style.color = error ? "crimson" : "green"; }
document.getElementById("customerLoginForm").addEventListener("submit", async event => { event.preventDefault(); try { await signInWithEmailAndPassword(auth, document.getElementById("loginEmail").value, document.getElementById("loginPassword").value); show("Login successful. You can now book a service."); } catch { show("Email or password is incorrect.", true); } });
document.getElementById("customerRegisterForm").addEventListener("submit", async event => { event.preventDefault(); try { const result = await createUserWithEmailAndPassword(auth, document.getElementById("registerEmail").value, document.getElementById("registerPassword").value); await updateProfile(result.user, { displayName: document.getElementById("registerName").value.trim() }); show("Account created successfully. You can now book a service."); event.currentTarget.reset(); } catch (error) { show(error.code === "auth/email-already-in-use" ? "This email already has an account." : "Unable to create account. Use a valid email and password of at least 6 characters.", true); } });
