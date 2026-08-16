const form = document.getElementById("bookingForm");
const msg = document.getElementById("bookingMessage");
const confirmation = document.getElementById("bookingConfirmation");
const vehiclePhotoInput = document.getElementById("vehicleFrontImage");
const vehiclePhotoPreview = document.getElementById("vehiclePhotoPreview");
const vehicleCameraChoice = document.getElementById("vehicleCameraChoice");
const cameraChoiceButtons = document.querySelectorAll(".camera-choice-btn");
const openVehicleCamera = document.getElementById("openVehicleCamera");
const vehicleCameraPanel = document.getElementById("vehicleCameraPanel");
const vehicleCameraPreview = document.getElementById("vehicleCameraPreview");
const captureVehiclePhoto = document.getElementById("captureVehiclePhoto");
const closeVehicleCamera = document.getElementById("closeVehicleCamera");
let vehiclePhotoData = "";
let vehicleCameraStream = null;

// Play the opening logo animation once, then hold its last frame as a still logo.
const logoVideo = document.querySelector(".hero-background-video");
const logoAnimationDuration = 7;

if (logoVideo) {
  const stopLogoAnimation = () => {
    if (logoVideo.currentTime >= logoAnimationDuration) {
      logoVideo.pause();
      logoVideo.currentTime = logoAnimationDuration;
    }
  };

  logoVideo.addEventListener("timeupdate", stopLogoAnimation);
  logoVideo.play().catch(() => {
    // Muted autoplay is normally allowed; controls stay hidden if a browser blocks it.
  });
}

const selectedService = new URLSearchParams(location.search).get("service");
if (selectedService && form?.elements.serviceType) {
  form.elements.serviceType.value = selectedService;
}

function addVehicleSpecificationFields() {
  const serviceType = form?.elements.serviceType;
  const vehicleType = form?.elements.vehicleType;
  if (!serviceType || !vehicleType || form.elements.vehicleBrand || form.elements.emissionStandard || form.elements.wheelCount) return;

  const brandField = document.createElement("label");
  // Brands with established commercial-truck presence and service support in Tamil Nadu.
  brandField.innerHTML = `🚛 Lorry Brand *<select name="vehicleBrand" required><option value="">Select brand</option><option value="Ashok Leyland">Ashok Leyland</option><option value="Tata Motors">Tata Motors</option><option value="BharatBenz">BharatBenz</option><option value="Eicher">Eicher</option><option value="Mahindra Truck & Bus">Mahindra Truck & Bus</option><option value="SML Isuzu">SML Isuzu</option><option value="Force Motors">Force Motors</option><option value="Volvo Trucks">Volvo Trucks</option><option value="Scania">Scania</option><option value="MAN">MAN</option><option value="AMW">AMW</option><option value="BEML">BEML</option><option value="Hino">Hino</option><option value="Isuzu">Isuzu</option></select>`;

  const brandLogoPreview = document.createElement("div");
  brandLogoPreview.className = "vehicle-brand-logo-preview full";
  brandLogoPreview.hidden = true;
  brandLogoPreview.innerHTML = '<img alt="Selected lorry brand logo"><span></span>';
  const brandLogos = {
    "Ashok Leyland": "https://logo.clearbit.com/ashokleyland.com?size=128",
    "Tata Motors": "https://logo.clearbit.com/tatamotors.com?size=128",
    "BharatBenz": "https://logo.clearbit.com/bharatbenz.com?size=128",
    "Eicher": "https://logo.clearbit.com/eichertrucksandbuses.com?size=128",
    "Mahindra Truck & Bus": "https://logo.clearbit.com/mahindra.com?size=128",
    "SML Isuzu": "https://logo.clearbit.com/smlisuzu.com?size=128",
    "Force Motors": "https://logo.clearbit.com/forcemotors.com?size=128",
    "Volvo Trucks": "https://logo.clearbit.com/volvotrucks.in?size=128",
    "Scania": "https://logo.clearbit.com/scania.com?size=128",
    "MAN": "https://logo.clearbit.com/man.eu?size=128",
    "AMW": "https://logo.clearbit.com/amwasia.com?size=128",
    "BEML": "https://logo.clearbit.com/bemlindia.in?size=128",
    "Hino": "https://logo.clearbit.com/hino.co.in?size=128",
    "Isuzu": "https://logo.clearbit.com/isuzu.in?size=128"
  };
  const brandSelect = brandField.querySelector("select");
  brandSelect.addEventListener("change", () => {
    const brand = brandSelect.value;
    const image = brandLogoPreview.querySelector("img");
    image.hidden = false;
    image.src = brandLogos[brand] || "";
    image.alt = brand ? `${brand} logo` : "";
    brandLogoPreview.querySelector("span").textContent = brand;
    brandLogoPreview.hidden = !brand;
  });
  brandLogoPreview.querySelector("img").addEventListener("error", event => { event.currentTarget.hidden = true; });

  const emissionField = document.createElement("label");
  emissionField.innerHTML = `🌿 Emission Standard *<select name="emissionStandard" required><option value="">Select BS type</option><option value="BS-3">BS-3</option><option value="BS-4">BS-4</option><option value="BS-6">BS-6</option></select>`;
  const wheelsField = document.createElement("label");
  wheelsField.innerHTML = `🛞 Wheel Count *<select name="wheelCount" required><option value="">Select wheels</option><option value="4 Wheels">4 Wheels</option><option value="6 Wheels">6 Wheels</option><option value="8 Wheels">8 Wheels</option><option value="10 Wheels">10 Wheels</option><option value="12 Wheels">12 Wheels</option><option value="14 Wheels">14 Wheels</option><option value="16 Wheels">16 Wheels</option><option value="18 Wheels">18 Wheels</option><option value="22 Wheels">22 Wheels</option><option value="Other">Other</option></select>`;
  vehicleType.closest("label").after(brandField, brandLogoPreview);
  serviceType.closest("label").after(emissionField, wheelsField);
}

addVehicleSpecificationFields();

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

async function openLiveVehicleCamera(facingMode) {
  if (!navigator.mediaDevices?.getUserMedia) {
    msg.textContent = "Live camera needs a secure site (HTTPS or localhost).";
    msg.style.color = "crimson";
    return;
  }
  try {
    stopVehicleCamera();
    vehicleCameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode } }, audio: false });
    vehicleCameraPreview.srcObject = vehicleCameraStream;
    vehicleCameraPanel.hidden = false;
    msg.textContent = "Camera is live. Frame the vehicle front and tap Take photo.";
    msg.style.color = "";
  } catch (error) {
    msg.textContent = "Camera permission was not granted. Please allow camera access and try again.";
    msg.style.color = "crimson";
  }
}

openVehicleCamera?.addEventListener("click", () => {
  vehicleCameraChoice.hidden = false;
});

cameraChoiceButtons.forEach(button => button.addEventListener("click", () => {
  vehicleCameraChoice.hidden = true;
  openLiveVehicleCamera(button.dataset.facing || "environment");
}));

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
    confirmation.innerHTML = `<strong>Booking confirmed</strong><span>Reference No: <b>${out.bookingReference || out.bookingId}</b></span><span>Date: <b>${out.bookingDate || "-"}</b></span><span>Time: <b>${out.bookingTime || "-"}</b></span><small>Save this reference number to check your status anytime.</small><a class="btn secondary" href="service-status.html">Check service status</a>`;
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
