const form = document.getElementById("bookingForm");
const msg = document.getElementById("bookingMessage");
const confirmation = document.getElementById("bookingConfirmation");
const vehiclePhotoInput = document.getElementById("vehicleFrontImage");
const vehiclePhotoPreview = document.getElementById("vehiclePhotoPreview");
const vehicleCameraFacing = document.getElementById("vehicleCameraFacing");
const openVehicleCamera = document.getElementById("openVehicleCamera");
const vehicleCameraPanel = document.getElementById("vehicleCameraPanel");
const vehicleCameraPreview = document.getElementById("vehicleCameraPreview");
const captureVehiclePhoto = document.getElementById("captureVehiclePhoto");
const closeVehicleCamera = document.getElementById("closeVehicleCamera");
let vehiclePhotoData = "";
let vehicleCameraStream = null;

const selectedService = new URLSearchParams(location.search).get("service");
if (selectedService && form?.elements.serviceType) {
  form.elements.serviceType.value = selectedService;
}

function compressVehiclePhoto(source, sourceWidth, sourceHeight) {
  const maxWidth = 960;
  const scale = Math.min(1, maxWidth / sourceWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  let quality = 0.78;
  let photo = canvas.toDataURL("image/jpeg", quality);
  while (photo.length > 550000 && quality > 0.35) {
    quality -= 0.1;
    photo = canvas.toDataURL("image/jpeg", quality);
  }
  if (photo.length > 550000) throw new Error("Photo is too large. Please take a closer, lower-resolution photo.");
  return photo;
}

function prepareVehiclePhoto(file) {
  return new Promise((resolve, reject) => {
    const source = new Image();
    source.onload = () => {
      URL.revokeObjectURL(source.src);
      try { resolve(compressVehiclePhoto(source, source.naturalWidth, source.naturalHeight)); }
      catch (error) { reject(error); }
    };
    source.onerror = () => reject(new Error("Unable to read the selected photo."));
    source.src = URL.createObjectURL(file);
  });
}

function stopVehicleCamera() {
  vehicleCameraStream?.getTracks().forEach(track => track.stop());
  vehicleCameraStream = null;
  if (vehicleCameraPreview) vehicleCameraPreview.srcObject = null;
  if (vehicleCameraPanel) vehicleCameraPanel.hidden = true;
}

openVehicleCamera?.addEventListener("click", async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    msg.textContent = "Live camera needs a secure site (HTTPS or localhost).";
    msg.style.color = "crimson";
    return;
  }
  try {
    stopVehicleCamera();
    vehicleCameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: vehicleCameraFacing?.value || "environment" } }, audio: false });
    vehicleCameraPreview.srcObject = vehicleCameraStream;
    vehicleCameraPanel.hidden = false;
    msg.textContent = "Camera is live. Frame the vehicle front and tap Take photo.";
    msg.style.color = "";
  } catch (error) {
    msg.textContent = "Camera permission was not granted. Please allow camera access and try again.";
    msg.style.color = "crimson";
  }
});

captureVehiclePhoto?.addEventListener("click", () => {
  if (!vehicleCameraPreview?.videoWidth) return;
  try {
    vehiclePhotoData = compressVehiclePhoto(vehicleCameraPreview, vehicleCameraPreview.videoWidth, vehicleCameraPreview.videoHeight);
    vehiclePhotoPreview.src = vehiclePhotoData;
    vehiclePhotoPreview.hidden = false;
    stopVehicleCamera();
    msg.textContent = "Vehicle front photo is ready to send.";
    msg.style.color = "green";
  } catch (error) {
    msg.textContent = error.message;
    msg.style.color = "crimson";
  }
});

closeVehicleCamera?.addEventListener("click", stopVehicleCamera);

vehiclePhotoInput?.addEventListener("change", async () => {
  const file = vehiclePhotoInput.files?.[0];
  vehiclePhotoData = "";
  vehiclePhotoPreview.hidden = true;
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    vehiclePhotoInput.value = "";
    msg.textContent = "Please choose a valid image.";
    msg.style.color = "crimson";
    return;
  }
  msg.textContent = "Preparing vehicle photo...";
  try {
    vehiclePhotoData = await prepareVehiclePhoto(file);
    vehiclePhotoPreview.src = vehiclePhotoData;
    vehiclePhotoPreview.hidden = false;
    msg.textContent = "Vehicle front photo is ready to send.";
    msg.style.color = "green";
  } catch (error) {
    vehiclePhotoInput.value = "";
    msg.textContent = error.message;
    msg.style.color = "crimson";
  }
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "Submitting service request...";
  msg.style.color = "";
  confirmation.hidden = true;

  if (!vehiclePhotoData) {
    msg.textContent = "Please take or select the vehicle front view image.";
    msg.style.color = "crimson";
    return;
  }
  const data = Object.fromEntries(new FormData(form).entries());
  data.vehicleFrontImage = vehiclePhotoData;

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
    vehiclePhotoData = "";
    vehiclePhotoPreview.hidden = true;
    stopVehicleCamera();
  } catch (err) {
    msg.textContent = err.message;
    msg.style.color = "crimson";
  }
});
