import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config();

admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();
const auth = admin.auth();
const app = express();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN?.split(",") || "*"
}));
app.use(express.json({limit:"1mb"}));

function clean(value, max=500){
  return String(value ?? "").trim().slice(0,max);
}

async function requireAdmin(req,res,next){
  try{
    const header=req.headers.authorization || "";
    if(!header.startsWith("Bearer ")) return res.status(401).json({message:"Authentication required"});
    const token=header.slice(7);
    req.user=await auth.verifyIdToken(token);
    // For production, add a custom admin claim and check req.user.admin === true.
    next();
  }catch(e){
    console.error(e);
    res.status(401).json({message:"Invalid or expired authentication token"});
  }
}

app.get("/api/health",(req,res)=>res.json({ok:true,service:"lorry-repair-pro"}));

app.post("/api/bookings", async (req,res)=>{
  try{
    const b={
      name:clean(req.body.name,100),
      mobile:clean(req.body.mobile,30),
      vehicleNo:clean(req.body.vehicleNo,40).toUpperCase(),
      vehicleType:clean(req.body.vehicleType,60),
      preferredDate:clean(req.body.preferredDate,30),
      serviceType:clean(req.body.serviceType,80),
      problem:clean(req.body.problem,1000),
      status:"Pending",
      createdAt:admin.firestore.FieldValue.serverTimestamp()
    };
    if(!b.name || !b.mobile || !b.vehicleNo || !b.vehicleType || !b.serviceType)
      return res.status(400).json({message:"Please fill all required fields"});
    const ref=await db.collection("bookings").add(b);
    res.status(201).json({ok:true,bookingId:ref.id});
  }catch(e){
    console.error(e);
    res.status(500).json({message:"Unable to create booking"});
  }
});

app.get("/api/bookings", requireAdmin, async (req,res)=>{
  try{
    const snap=await db.collection("bookings").orderBy("createdAt","desc").limit(100).get();
    const bookings=snap.docs.map(d=>({id:d.id,...d.data()}));
    res.json({bookings});
  }catch(e){
    console.error(e);
    res.status(500).json({message:"Unable to load bookings"});
  }
});

app.get("/api/bookings/:id", requireAdmin, async (req,res)=>{
  try{
    const doc=await db.collection("bookings").doc(req.params.id).get();
    if(!doc.exists) return res.status(404).json({message:"Booking not found"});
    res.json({booking:{id:doc.id,...doc.data()}});
  }catch(e){
    console.error(e);
    res.status(500).json({message:"Unable to load booking"});
  }
});

app.patch("/api/bookings/:id/status", requireAdmin, async (req,res)=>{
  const allowed=["Pending","Inspection","Approved","In Progress","Ready","Delivered","Cancelled"];
  const status=clean(req.body.status,30);
  if(!allowed.includes(status)) return res.status(400).json({message:"Invalid status"});
  await db.collection("bookings").doc(req.params.id).update({
    status, updatedAt:admin.firestore.FieldValue.serverTimestamp()
  });
  res.json({ok:true});
});

app.use((req,res)=>res.status(404).json({message:"Route not found"}));

const port=process.env.PORT || 5000;
app.listen(port,()=>console.log(`LorryCare backend running on http://localhost:${port}`));
