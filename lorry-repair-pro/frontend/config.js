// A browser refresh should always restart the public site from its home page.
// Regular navigation and the browser Back button are intentionally unaffected.
(() => {
  const navigationEntry = performance.getEntriesByType("navigation")[0];
  const isPageReload = navigationEntry?.type === "reload"
    || performance.navigation?.type === performance.navigation.TYPE_RELOAD;
  const currentPage = location.pathname.split("/").pop();

  if (isPageReload && currentPage && currentPage !== "index.html") {
    location.replace("index.html");
  }
})();

window.APP_CONFIG = {
    API_BASE_URL: "https://malligeswaran-auto-diesel-works-1.onrender.com",

    firebase: {
        apiKey: "AIzaSyBaFSDDPG82r-ZBWhBUqjxzmVmJz2O8GAY",
        authDomain: "malligeswaranautodieselw-659ba.firebaseapp.com",
        projectId: "malligeswaranautodieselw-659ba",
        storageBucket: "malligeswaranautodieselw-659ba.firebasestorage.app",
        messagingSenderId: "644245834520",
        appId: "1:644245834520:web:ba2c8ce33c494af470ec6d",
        measurementId: "G-NHFWJ8DYX8"
    }
};

globalThis.applyWorkshopInterface ??= function applyWorkshopInterface() {
  const emojiLabels = {
    "Home": "🏠", "Services": "🛠️", "Book Service": "📅", "Shop Collaboration": "🤝",
    "About": "ℹ️", "Contact": "📞", "Login": "🔐", "Admin": "🧰", "Website": "🌐",
    "Service Bookings": "📋", "Service Status": "🔎", "Open live camera": "📷",
    "Back camera": "📷", "Front camera": "🤳", "Take photo": "📸", "Close camera": "✖️",
    "Submit Service Request": "🛠️", "Check service status": "🔎", "Create Account": "✨",
    "Forgot password?": "🔑", "Send password reset link": "📧", "Logout": "👋",
    "Refresh": "🔄", "Save Job Card": "💾", "Print Job Card": "🖨️",
    "SERVICE BOOKING": "📅", "CUSTOMER LOGIN": "🔐", "CREATE ACCOUNT": "✨",
    "CUSTOMER SERVICE STATUS": "🔎", "SHOP COLLABORATION": "🤝",
    "WORKSHOP CONTROL PANEL": "🧰", "ADMIN CONTROL PANEL": "🧰",
    "Book your lorry service": "📅", "Track your service": "🔎", "Welcome back": "👋",
    "New customer": "✨", "Service Bookings": "📋", "Shop Collaboration Requests": "🤝",
    "Visit or call our workshop": "📍", "Every heavy-vehicle need, in one workshop": "🚛",
    "Heavy-vehicle service you can depend on.": "🛠️"
  };

  document.querySelectorAll("a, button, h1, h2, h3, .eyebrow").forEach(element => {
    if (element.dataset.emojiApplied) return;
    const label = element.textContent.trim();
    const emoji = emojiLabels[label];
    if (!emoji) return;
    element.dataset.emojiApplied = "true";
    element.textContent = `${emoji} ${label}`;
  });

  document.querySelectorAll('input[type="password"]').forEach(input => {
    if (input.dataset.passwordToggle) return;
    input.dataset.passwordToggle = "true";
    const field = document.createElement("span");
    field.className = "password-field";
    input.parentNode.insertBefore(field, input);
    field.append(input);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "password-toggle";
    toggle.setAttribute("aria-label", "Show password");
    toggle.textContent = "👁️ Show";
    toggle.addEventListener("click", () => {
      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      toggle.textContent = visible ? "👁️ Show" : "🙈 Hide";
      toggle.setAttribute("aria-label", visible ? "Show password" : "Hide password");
    });
    field.append(toggle);
  });

  document.querySelectorAll(".vehicle-photo-field").forEach(field => {
    const label = Array.from(field.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.includes("Vehicle Front View"));
    if (label && !label.textContent.includes("📸")) label.textContent = "📸 Vehicle Front View Image *";
  });
  document.querySelectorAll("#vehiclePhotoPreview").forEach(image => {
    image.alt = "📸 Vehicle front view preview";
  });

  const formLabelEmojis = [
    ["Customer Name", "👤"], ["Full Name", "👤"], ["Username", "🪪"],
    ["Contact Person", "👤"], ["Mobile Number", "📱"], ["Email", "📧"],
    ["Password", "🔒"], ["Vehicle Number", "🚛"], ["Vehicle Type", "🚚"],
    ["Service Type", "🛠️"], ["Problem / Complaint", "📝"], ["Shop Name", "🏪"],
    ["Shop Location", "📍"], ["Services / Collaboration Requirement", "🤝"],
    ["Booking Reference No.", "🔎"], ["Account email", "📧"]
  ];
  document.querySelectorAll("label").forEach(label => {
    if (label.dataset.emojiApplied) return;
    const textNode = Array.from(label.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (!textNode) return;
    const labelText = textNode.textContent.trim();
    const emoji = formLabelEmojis.find(([text]) => labelText.startsWith(text))?.[1];
    if (!emoji) return;
    label.dataset.emojiApplied = "true";
    textNode.textContent = ` ${emoji} ${labelText}`;
  });
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyWorkshopInterface);
else applyWorkshopInterface();

// Add the same previous-page control to every normal site header.
function addBackNavigation() {
  const pageName = location.pathname.split("/").pop();
  // The home page is the start of the site, so it should not show a Back button.
  if (!pageName || pageName === "index.html") return;
  if (document.querySelector(".toolbar, .page-back")) return;
  const navigation = document.querySelector(".site-header .nav");
  if (!navigation) return;
  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "page-back";
  backButton.setAttribute("aria-label", "Go back to previous page");
  backButton.innerHTML = "&#8592; <span>Back</span>";
  backButton.onclick = () => {
    if (history.length > 1) history.back();
    else location.href = "index.html";
  };
  navigation.prepend(backButton);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addBackNavigation);
else addBackNavigation();
    
