const collaborationForm = document.getElementById("collaborationForm");
const collaborationMessage = document.getElementById("collaborationMessage");
collaborationForm?.addEventListener("submit", async event => {
  event.preventDefault(); collaborationMessage.textContent = "Submitting collaboration request..."; collaborationMessage.style.color = "";
  try { const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/shop-collaborations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(collaborationForm).entries())) }); const output = await response.json(); if (!response.ok) throw new Error(output.message || "Request failed"); collaborationMessage.textContent = `Request submitted successfully. Reference: ${output.collaborationId}`; collaborationMessage.style.color = "green"; collaborationForm.reset(); } catch (error) { collaborationMessage.textContent = error.message; collaborationMessage.style.color = "crimson"; }
});
