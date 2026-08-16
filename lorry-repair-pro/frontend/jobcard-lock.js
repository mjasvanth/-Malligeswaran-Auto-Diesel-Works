function lockPaidJobCard() {
  const status = document.getElementById("jobStatus");
  if (!status || status.value !== "Paid") return;
  document.querySelectorAll("#billRows input, #gstRate, #jobStatus, #addRowBtn, #saveJobCardBtn, #paidSaveJobCardBtn, #discountAmount, #paidAmount, #paymentMethod, #paymentReference, .remove-row").forEach(element => { element.disabled = true; });
  const saveButton = document.getElementById("saveJobCardBtn");
  if (saveButton) saveButton.textContent = "Paid — Job Card Locked";
}

// The existing save action uses fetch; lock the form only after a Paid save succeeds.
const originalFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  const url = String(args[0] || "");
  if (response.ok && url.includes("/api/bookings/") && !url.includes("/job-card")) {
    response.clone().json().then(output => {
      if (output.booking?.status === "Paid") setTimeout(lockPaidJobCard, 0);
    }).catch(() => {});
  }
  if (response.ok && url.includes("/job-card") && document.getElementById("jobStatus")?.value === "Paid") {
    setTimeout(lockPaidJobCard, 0);
  }
  return response;
};
