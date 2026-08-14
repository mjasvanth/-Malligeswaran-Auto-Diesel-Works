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

app.use(express.json({ limit: "1mb" }));

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
  const compactDate = `${part("year")}${part("month").slice(0, 3).toUpperCase()}${part("day")}`;
  const compactTime = bookingTime.replace(/[^0-9APM]/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return { bookingDate, bookingTime, bookingReference: `MADW-${compactDate}-${compactTime}-${suffix}` };
}

function jobCardMeta() {
  const meta = bookingMeta();
  return {
    jobCardNo: `JC-${meta.bookingReference}`,
    jobCardDate: meta.bookingDate,
    jobCardTime: meta.bookingTime
  };
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
      lastServiceDate: clean(req.body.lastServiceDate, 30),
      lastServiceType: clean(req.body.lastServiceType, 120),
      serviceType: clean(req.body.serviceType, 80),
      problem: clean(req.body.problem, 1000),
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
      !booking.serviceType
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
    const snapshot = await db.collection("bookings")
      .where("customerUid", "==", req.customer.uid)
      .orderBy("createdAt", "desc")
      .get();

    const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    res.json({ booking: { bookingReference: booking.bookingReference, vehicleNo: booking.vehicleNo, vehicleType: booking.vehicleType, serviceType: booking.serviceType, status: booking.status || "Pending", bookingDate: booking.bookingDate, bookingTime: booking.bookingTime } });
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
        "Cancelled"
      ];

      const status = clean(req.body.status, 30);

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          message: "Invalid status"
        });
      }

      await db
        .collection("bookings")
        .doc(req.params.id)
        .update({
          status,
          updatedAt:
            admin.firestore.FieldValue.serverTimestamp()
        });

      res.json({
        ok: true
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
    const ref = db.collection("bookings").doc(req.params.id);
    const booking = await ref.get();
    if (!booking.exists) {
      return res.status(404).json({ message: "Booking not found" });
    }
    const previousJobCard = booking.data().jobCard || {};
    const allowedStatuses = ["Pending", "Inspection", "Approved", "In Progress", "Ready", "Delivered", "Cancelled"];
    const status = clean(req.body.status, 30);
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid job card status" });
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
      grandTotal: subtotal + gstAmount,
      savedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await ref.update({
      jobCard,
      status,
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
