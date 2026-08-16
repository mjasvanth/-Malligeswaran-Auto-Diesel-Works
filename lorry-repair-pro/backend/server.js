import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config();

// Firebase Admin SDK
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : null;

admin.initializeApp({
  // Local development can use GOOGLE_APPLICATION_CREDENTIALS. In cloud hosts,
  // store the service-account JSON in the FIREBASE_SERVICE_ACCOUNT secret.
  credential: serviceAccount
    ? admin.credential.cert(serviceAccount)
    : admin.credential.applicationDefault()
});

const db = admin.firestore();
const auth = admin.auth();

const app = express();

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN
      ? process.env.FRONTEND_ORIGIN.split(",")
      : "*"
  })
);

app.use(express.json({ limit: "2mb" }));

async function customerIdentity(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return next();
  try { req.customer = await auth.verifyIdToken(header.slice(7)); next(); }
  catch { return res.status(401).json({ message: "Your login session has expired. Please login again." }); }
}

async function requireCustomer(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return res.status(401).json({ message: "Please login to check your service status." });
  try { req.customer = await auth.verifyIdToken(header.slice(7)); next(); }
  catch { return res.status(401).json({ message: "Your login session has expired. Please login again." }); }
}

// Clean input
function clean(value, max = 500) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function cleanVehiclePhoto(value) {
  const photo = String(value ?? "");
  // Photos are resized in the browser; only allow a compact JPEG data URL.
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo) || photo.length > 550000) return "";
  return photo;
}

function bookingMeta() {
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "long", year: "numeric"
  }).formatToParts(now);
  const part = type => dateParts.find(item => item.type === type)?.value;
  const bookingDate = `${part("day")} ${part("month")} ${part("year")}`;
  const bookingTime = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true
  }).format(now).toUpperCase();
  // Short, easy-to-share reference such as A7K2M. Ambiguous characters are omitted.
  const referenceCharacters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bookingReference = Array.from(
    { length: 5 },
    () => referenceCharacters[Math.floor(Math.random() * referenceCharacters.length)]
  ).join("");
  return { bookingDate, bookingTime, bookingReference };
}

function jobCardMeta() {
  const meta = bookingMeta();
  return {
    jobCardNo: `JC-${meta.bookingReference}`,
    jobCardDate: meta.bookingDate,
    jobCardTime: meta.bookingTime
  };
}

function customerBookingView(id, booking) {
  return {
    id,
    bookingReference: booking.bookingReference,
    vehicleNo: booking.vehicleNo,
    vehicleType: booking.vehicleType,
    vehicleBrand: booking.vehicleBrand,
    emissionStandard: booking.emissionStandard,
    wheelCount: booking.wheelCount,
    serviceType: booking.serviceType,
    status: booking.status || "Pending",
    bookingDate: booking.bookingDate,
    bookingTime: booking.bookingTime,
    customerNotification: booking.customerNotification || null,
    jobCard: booking.jobCard || null
  };
}

function statusNotification(booking, status) {
  const reference = booking.bookingReference || "your booking";
  const message = `Your service booking status is now ${status}. Reference No: ${reference}. Malligeswaran Auto Diesel Works will contact you if any further action is needed.`;
  return {
    type: status === "Approved" ? "confirmed" : status === "Cancelled" ? "rejected" : "updated",
    title: "Service booking status updated",
    message,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

function customerWhatsAppNumber(mobile) {
  const digits = String(mobile || "").replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return "";
}

async function sendStatusNotifications(booking, status) {
  const notification = statusNotification(booking, status);
  const results = { email: "not configured", whatsapp: "not configured" };

  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL && booking.email) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to: [booking.email],
          subject: `Service booking update — ${booking.bookingReference}`,
          text: notification.message
        })
      });
      if (!response.ok) throw new Error(await response.text());
      results.email = "sent";
    } catch (error) {
      results.email = "failed";
      console.error("Status email failed:", error.message);
    }
  }

  const whatsappTo = customerWhatsAppNumber(booking.mobile);
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM && whatsappTo) {
    try {
      const credentials = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          From: process.env.TWILIO_WHATSAPP_FROM,
          To: `whatsapp:${whatsappTo}`,
          Body: notification.message
        })
      });
      if (!response.ok) throw new Error(await response.text());
      results.whatsapp = "sent";
    } catch (error) {
      results.whatsapp = "failed";
      console.error("Status WhatsApp failed:", error.message);
    }
  }

  return { notification, results };
}

// Admin authentication
async function requireAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required"
      });
    }

    const token = header.slice(7);

    req.user = await auth.verifyIdToken(token);

    next();
  } catch (error) {
    console.error("Admin authentication error:", error);

    return res.status(401).json({
      message: "Invalid or expired authentication token"
    });
  }
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "AUTO DIESEL WORKS"
  });
});

// Create booking
app.post("/api/bookings", customerIdentity, async (req, res) => {
  try {
    const meta = bookingMeta();
    const booking = {
      bookingReference: meta.bookingReference,
      bookingDate: meta.bookingDate,
      bookingTime: meta.bookingTime,
      name: clean(req.body.name, 100),
      mobile: clean(req.body.mobile, 30),
      email: clean(req.body.email, 150),
      vehicleNo: clean(req.body.vehicleNo, 40).toUpperCase(),
      vehicleType: clean(req.body.vehicleType, 60),
      vehicleBrand: clean(req.body.vehicleBrand, 60),
      emissionStandard: clean(req.body.emissionStandard, 20),
      wheelCount: clean(req.body.wheelCount, 30),
      lastServiceDate: clean(req.body.lastServiceDate, 30),
      lastServiceType: clean(req.body.lastServiceType, 120),
      serviceType: clean(req.body.serviceType, 80),
      problem: clean(req.body.problem, 1000),
      vehicleFrontImage: cleanVehiclePhoto(req.body.vehicleFrontImage),
      customerUid: req.customer?.uid || "",
      customerEmail: req.customer?.email || "",

      status: "Pending",

      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Required fields
    if (
      !booking.name ||
      !booking.mobile ||
      !booking.vehicleNo ||
      !booking.vehicleType ||
      !booking.vehicleBrand ||
      !booking.emissionStandard ||
      !booking.wheelCount ||
      !booking.serviceType ||
      !booking.vehicleFrontImage
    ) {
      return res.status(400).json({
        message: "Please fill all required fields"
      });
    }

    // Save to Firestore
    const ref = db.collection("bookings").doc();
    await ref.set(booking);

    console.log("New booking:", ref.id);

    res.status(201).json({
      ok: true,
      bookingId: ref.id,
      bookingReference: booking.bookingReference,
      bookingDate: booking.bookingDate,
      bookingTime: booking.bookingTime
    });

  } catch (error) {
    console.error("Booking error:", error);

    res.status(500).json({
      message: "Unable to create booking"
    });
  }
});

// Get all bookings for the logged-in customer
app.get("/api/customer/my-bookings", requireCustomer, async (req, res) => {
  try {
    const uidSnapshot = await db.collection("bookings").where("customerUid", "==", req.customer.uid).get();
    const email = String(req.customer.email || "").trim().toLowerCase();
    const emailSnapshot = email ? await db.collection("bookings").where("email", "==", email).get() : { docs: [] };
    const documents = new Map();
    [...uidSnapshot.docs, ...emailSnapshot.docs].forEach(doc => documents.set(doc.id, doc));
    const bookings = [...documents.values()]
      .map(doc => customerBookingView(doc.id, doc.data()))
      .sort((a, b) => String(b.bookingDate || "").localeCompare(String(a.bookingDate || "")));
    res.json({ bookings });
  } catch (error) {
    console.error("Customer booking history error:", error);
    res.status(500).json({ message: "Unable to load your booking history." });
  }
});

app.get("/api/customer-bookings/:reference", requireCustomer, async (req, res) => {
  try {
    const reference = clean(req.params.reference, 100).toUpperCase();
    if (!reference) return res.status(400).json({ message: "Enter your booking reference number." });
    const snapshot = await db.collection("bookings").where("bookingReference", "==", reference).limit(1).get();
    if (snapshot.empty) return res.status(404).json({ message: "Booking reference not found." });
    const booking = snapshot.docs[0].data();
    const bookedEmail = String(booking.email || "").trim().toLowerCase();
    const accountEmail = String(req.customer.email || "").trim().toLowerCase();
    if (booking.customerUid !== req.customer.uid && (!bookedEmail || bookedEmail !== accountEmail)) return res.status(403).json({ message: "This reference is not linked to your customer account." });
    res.json({ booking: customerBookingView(snapshot.docs[0].id, booking) });
  } catch (error) {
    console.error("Customer status lookup error:", error);
    res.status(500).json({ message: "Unable to load service status." });
  }
});

// Create a shop collaboration enquiry
app.post("/api/shop-collaborations", async (req, res) => {
  try {
    const collaboration = {
      shopName: clean(req.body.shopName, 120),
      contactName: clean(req.body.contactName, 100),
      mobile: clean(req.body.mobile, 30),
      email: clean(req.body.email, 150),
      location: clean(req.body.location, 200),
      services: clean(req.body.services, 500),
      status: "New",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (!collaboration.shopName || !collaboration.contactName || !collaboration.mobile || !collaboration.location) {
      return res.status(400).json({ message: "Please fill shop name, contact name, mobile number and location" });
    }
    const ref = await db.collection("shopCollaborations").add(collaboration);
    res.status(201).json({ ok: true, collaborationId: ref.id });
  } catch (error) {
    console.error("Collaboration error:", error);
    res.status(500).json({ message: "Unable to submit collaboration request" });
  }
});

// Get all bookings - Admin only
app.get("/api/bookings", requireAdmin, async (req, res) => {
  try {
    const snapshot = await db
      .collection("bookings")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const bookings = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      bookings
    });

  } catch (error) {
    console.error("Load bookings error:", error);

    res.status(500).json({
      message: "Unable to load bookings"
    });
  }
});

// Load shop collaboration enquiries - Admin only
app.get("/api/shop-collaborations", requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("shopCollaborations").orderBy("createdAt", "desc").limit(100).get();
    res.json({ collaborations: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) });
  } catch (error) {
    console.error("Load collaborations error:", error);
    res.status(500).json({ message: "Unable to load collaboration requests" });
  }
});

// Delete all bookings - Admin only
app.delete("/api/bookings/all", requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("bookings").limit(500).get(); // Firestore batch limit is 500
    if (snapshot.empty) {
      return res.json({ ok: true, message: "No bookings to delete." });
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Deleted ${snapshot.size} bookings.`);
    res.json({ ok: true, message: `Successfully deleted ${snapshot.size} bookings.` });
  } catch (error) {
    console.error("Delete all bookings error:", error);
    res.status(500).json({ message: "Unable to delete bookings." });
  }
});

// Get single booking
app.get("/api/bookings/:id", requireAdmin, async (req, res) => {
  try {
    const doc = await db
      .collection("bookings")
      .doc(req.params.id)
      .get();

    if (!doc.exists) {
      return res.status(404).json({
        message: "Booking not found"
      });
    }

    res.json({
      booking: {
        id: doc.id,
        ...doc.data()
      }
    });

  } catch (error) {
    console.error("Get booking error:", error);

    res.status(500).json({
      message: "Unable to load booking"
    });
  }
});

// Update booking status
app.patch(
  "/api/bookings/:id/status",
  requireAdmin,
  async (req, res) => {
    try {
      const allowedStatuses = [
        "Pending",
        "Inspection",
        "Approved",
        "In Progress",
        "Ready",
        "Delivered",
        "Paid",
        "Cancelled"
      ];

      const status = clean(req.body.status, 30);

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          message: "Invalid status"
        });
      }

      const bookingRef = db.collection("bookings").doc(req.params.id);
      const bookingSnapshot = await bookingRef.get();
      if (!bookingSnapshot.exists) return res.status(404).json({ message: "Booking not found" });

      const booking = bookingSnapshot.data();
      if (booking.status === "Paid") return res.status(409).json({ message: "This paid job card is locked and cannot be changed." });
      const { notification, results: notificationDelivery } = await sendStatusNotifications(booking, status);

      await bookingRef.update({
        status,
        customerNotification: notification,
        notificationDelivery,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        ok: true,
        booking: { id: bookingSnapshot.id, bookingReference: booking.bookingReference, status },
        notificationDelivery
      });

    } catch (error) {
      console.error("Status update error:", error);

      res.status(500).json({
        message: "Unable to update booking status"
      });
    }
  }
);

// Save job-card parts, labour and bill - Admin only
app.put("/api/bookings/:id/job-card", requireAdmin, async (req, res) => {
  try {
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (rawItems.length > 50) {
      return res.status(400).json({ message: "Maximum 50 bill items allowed" });
    }

    const toAmount = (value, maximum = 10000000) => {
      const number = Number(value);
      return Number.isFinite(number) && number >= 0 ? Math.min(number, maximum) : 0;
    };

    const items = rawItems
      .map((item) => {
        const quantity = toAmount(item.quantity, 10000);
        const rate = toAmount(item.rate);
        return {
          description: clean(item.description, 200),
          quantity,
          rate,
          amount: quantity * rate
        };
      })
      .filter((item) => item.description || item.quantity || item.rate);

    const subtotal = items.reduce((total, item) => total + item.amount, 0);
    const gstRate = Math.min(toAmount(req.body.gstRate, 100), 100);
    const gstAmount = subtotal * gstRate / 100;
    const discountAmount = Math.min(toAmount(req.body.discountAmount), subtotal + gstAmount);
    const grandTotal = subtotal + gstAmount - discountAmount;
    const paidAmount = toAmount(req.body.paidAmount);
    const paymentMethod = clean(req.body.paymentMethod, 30) || "Cash";
    const paymentReference = clean(req.body.paymentReference, 100);
    const ref = db.collection("bookings").doc(req.params.id);
    const booking = await ref.get();
    if (!booking.exists) {
      return res.status(404).json({ message: "Booking not found" });
    }
    const bookingData = booking.data();
    if (bookingData.status === "Paid") {
      return res.status(409).json({ message: "This paid job card is locked and cannot be edited." });
    }
    const previousJobCard = bookingData.jobCard || {};
    const allowedStatuses = ["Pending", "Inspection", "Approved", "In Progress", "Ready", "Delivered", "Paid", "Cancelled"];
    const status = clean(req.body.status, 30);
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid job card status" });
    }
    if (status === "Paid" && paidAmount < grandTotal) {
      return res.status(400).json({ message: "Enter the full paid amount before marking this job card as Paid." });
    }
    const meta = previousJobCard.jobCardNo ? {
      jobCardNo: previousJobCard.jobCardNo,
      jobCardDate: previousJobCard.jobCardDate,
      jobCardTime: previousJobCard.jobCardTime
    } : jobCardMeta();
    const jobCard = {
      ...meta,
      items,
      gstRate,
      subtotal,
      gstAmount,
      discountAmount,
      grandTotal,
      paidAmount,
      paymentMethod,
      paymentReference,
      savedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const { notification, results: notificationDelivery } = await sendStatusNotifications(bookingData, status);
    await ref.update({
      jobCard,
      status,
      customerNotification: notification,
      notificationDelivery,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ ok: true, jobCard });
  } catch (error) {
    console.error("Job card save error:", error);
    res.status(500).json({ message: "Unable to save job card" });
  }
});

// Unknown route
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found"
  });
});

// Start server
const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(
    `AUTO DIESEL WORKS backend running on http://localhost:${port}`
  );
});
