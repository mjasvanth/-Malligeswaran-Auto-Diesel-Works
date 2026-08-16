(() => {
  const money = value => `₹ ${Math.max(0, Number(value) || 0).toFixed(2)}`;
  const valueOf = id => Math.max(0, Number(document.getElementById(id)?.value) || 0);
  const paymentInputs = ["discountAmount", "paidAmount", "paymentMethod", "paymentReference"];

  function updatePaymentTotals() {
    const subtotal = [...document.querySelectorAll("#billRows tr")].reduce((total, row) => {
      return total + valueOfRow(row, ".qty") * valueOfRow(row, ".rate");
    }, 0);
    const gst = subtotal * valueOf("gstRate") / 100;
    const discount = Math.min(valueOf("discountAmount"), subtotal + gst);
    const grandTotal = subtotal + gst - discount;
    const paidAmount = valueOf("paidAmount");
    document.getElementById("subtotal").textContent = money(subtotal);
    document.getElementById("gstAmount").textContent = money(gst);
    document.getElementById("grandTotal").textContent = money(grandTotal);
    document.getElementById("balanceAmount").textContent = money(Math.max(0, grandTotal - paidAmount));
    return grandTotal;
  }

  function valueOfRow(row, selector) {
    return Math.max(0, Number(row.querySelector(selector)?.value) || 0);
  }

  function lockPaymentDetails() {
    document.querySelectorAll("#discountAmount, #paidAmount, #paymentMethod, #paymentReference, #paidSaveJobCardBtn").forEach(element => {
      element.disabled = true;
    });
  }

  const previousFetch = window.fetch.bind(window);
  window.fetch = async (url, options = {}) => {
    const requestUrl = String(url || "");
    if (requestUrl.includes("/job-card") && String(options.method || "GET").toUpperCase() === "PUT") {
      const body = JSON.parse(options.body || "{}");
      Object.assign(body, {
        discountAmount: valueOf("discountAmount"),
        paidAmount: valueOf("paidAmount"),
        paymentMethod: document.getElementById("paymentMethod").value,
        paymentReference: document.getElementById("paymentReference").value.trim()
      });
      options = { ...options, body: JSON.stringify(body) };
    }

    const response = await previousFetch(url, options);
    if (response.ok && requestUrl.includes("/api/bookings/") && !requestUrl.includes("/job-card")) {
      response.clone().json().then(output => {
        const payment = output.booking?.jobCard;
        document.getElementById("vehicleBrand").textContent = output.booking?.vehicleBrand || "-";
        document.getElementById("emissionStandard").textContent = output.booking?.emissionStandard || "-";
        document.getElementById("wheelCount").textContent = output.booking?.wheelCount || "-";
        document.getElementById("serviceType").textContent = output.booking?.serviceType || "-";
        if (!payment) return;
        setTimeout(() => {
          document.getElementById("discountAmount").value = payment.discountAmount ?? 0;
          document.getElementById("paidAmount").value = payment.paidAmount ?? 0;
          document.getElementById("paymentMethod").value = payment.paymentMethod || "Cash";
          document.getElementById("paymentReference").value = payment.paymentReference || "";
          updatePaymentTotals();
          if (output.booking?.status === "Paid") lockPaymentDetails();
        }, 0);
      }).catch(() => {});
    }
    return response;
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.addEventListener("input", event => {
      if (event.target.matches("#billRows input, #gstRate, #discountAmount, #paidAmount")) updatePaymentTotals();
    });
    paymentInputs.forEach(id => document.getElementById(id).addEventListener("input", updatePaymentTotals));
    document.getElementById("paidSaveJobCardBtn").addEventListener("click", () => {
      const grandTotal = updatePaymentTotals();
      if (valueOf("paidAmount") < grandTotal) {
        alert("Enter the full Amount Paid before marking this job card as Paid.");
        document.getElementById("paidAmount").focus();
        return;
      }
      document.getElementById("jobStatus").value = "Paid";
      document.getElementById("saveJobCardBtn").click();
    });
    updatePaymentTotals();
  });
})();
