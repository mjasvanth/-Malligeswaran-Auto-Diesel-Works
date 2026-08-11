const form = document.getElementById("bookingForm");
const msg = document.getElementById("bookingMessage");
const confirmation = document.getElementById("bookingConfirmation");

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "Submitting service request...";
  msg.style.color = "";
  confirmation.hidden = true;

  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const res = await fetch(`${APP_CONFIG.API_BASE_URL}/api/bookings`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(data)
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out.message || "Request failed");

    msg.textContent = "Your service request has been submitted.";
    msg.style.color = "green";
    confirmation.innerHTML = `<strong>Booking confirmed</strong><span>Reference No: <b>${out.bookingReference || out.bookingId}</b></span><span>Date: <b>${out.bookingDate || "-"}</b></span><span>Time: <b>${out.bookingTime || "-"}</b></span><small>Our team will review your request and contact you on the mobile number provided.</small>`;
    confirmation.hidden = false;
    form.reset();
  } catch (err) {
    msg.textContent = err.message;
    msg.style.color = "crimson";
  }
});
