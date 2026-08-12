import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const auth = getAuth(initializeApp(APP_CONFIG.firebase));
const message = document.getElementById("authMessage");
const resetPanel = document.getElementById("resetPasswordPanel");
const showResetButton = document.getElementById("showResetButton");
const resetEmail = document.getElementById("resetEmail");

function show(text, error = false) { message.textContent = text; message.style.color = error ? "crimson" : "green"; }

showResetButton.addEventListener("click", () => {
  const opening = resetPanel.hidden;
  resetPanel.hidden = !opening;
  showResetButton.textContent = opening ? "Cancel password reset" : "Forgot password?";
  if (opening) { resetEmail.value = document.getElementById("loginEmail").value.trim(); resetEmail.focus(); }
});

document.getElementById("sendResetButton").addEventListener("click", async () => {
  const email = resetEmail.value.trim();
  if (!email) { show("Enter the email address used for your account.", true); resetEmail.focus(); return; }
  try { await sendPasswordResetEmail(auth, email); show("Password reset link sent. Please check your email inbox and spam folder."); }
  catch (error) { show(error.code === "auth/invalid-email" ? "Enter a valid email address." : "Unable to send reset link. Please try again.", true); }
});

document.getElementById("customerLoginForm").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    await signInWithEmailAndPassword(auth, document.getElementById("loginEmail").value.trim(), document.getElementById("loginPassword").value);
    location.href = "service-status.html";
  } catch { show("Email or password is incorrect.", true); }
});

document.getElementById("customerRegisterForm").addEventListener("submit", async event => {
  event.preventDefault();
  const name = document.getElementById("registerName").value.trim();
  const username = document.getElementById("registerUsername").value.trim();
  try {
    const result = await createUserWithEmailAndPassword(auth, document.getElementById("registerEmail").value.trim(), document.getElementById("registerPassword").value);
    await updateProfile(result.user, { displayName: username, photoURL: null });
    localStorage.setItem(`customerName:${result.user.uid}`, name);
    show("Account created successfully. You can now log in with your email and password.");
    event.currentTarget.reset();
  } catch (error) { show(error.code === "auth/email-already-in-use" ? "This email already has an account." : "Unable to create account. Use a valid email and a password of at least 6 characters.", true); }
});
