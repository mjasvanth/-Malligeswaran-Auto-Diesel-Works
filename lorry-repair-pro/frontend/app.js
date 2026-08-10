const form = document.getElementById("bookingForm");
const msg = document.getElementById("bookingMessage");

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "Submitting service request...";
  msg.style.color = "";

  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const res = await fetch(`${APP_CONFIG.API_BASE_URL}/api/bookings`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(data)
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out.message || "Request failed");

    msg.textContent = `Booking submitted successfully. Reference: ${out.bookingId}`;
    msg.style.color = "green";
    form.reset();
  } catch (err) {
    msg.textContent = err.message;
    msg.style.color = "crimson";
  }
});
