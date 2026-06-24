import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import userRoutes from "./Routes/userRoutes.js";
import vendorRoutes from "./Routes/vendorRoutes.js";
import adminRoutes from "./Routes/adminRoutes.js";
import venueRoutes from "./Routes/venueRoutes.js";
import ratingRoutes from "./Routes/ratingRoutes.js";
import bookingRoutes from "./Routes/bookingRoutes.js";
import wishlistRoutes from "./Routes/wishlistRoutes.js";
import planRoutes from "./Routes/planRoutes.js";
import subscriptionRoutes from "./Routes/subscriptionRoutes.js";
import mockPaymentRoutes from "./Routes/mockPaymentRoutes.js";
import paymentHistoryRoutes from "./Routes/paymentHistoryRoutes.js";
import termsRoutes from "./Routes/termsRoutes.js";
import complaintRoutes from "./Routes/complaintRoutes.js";
import reportRoutes from "./Routes/reportRoutes.js";
import todoRoutes from "./Routes/todoRoutes.js";
import blogRoutes from "./Routes/blogRoutes.js";
import dashboardRoutes from "./Routes/dashboardRoutes.js";
import contactRoutes from "./Routes/contactRoutes.js";


import remainingPaymentRoutes from "./Routes/remainingPaymentRoutes.js";
import { registerSubscriptionCronJobs } from "./jobs/subscriptionCron.js";
import adminPlanRoutes from "./Routes/adminPlanRoutes.js";
import vendorSubscriptionRoutes from "./Routes/vendorSubscriptionRoutes.js";
import { registerVendorSubscriptionCronJobs } from "./jobs/vendorSubscriptionCron.js";
import notificationRoutes from "./Routes/notificationRoutes.js";
import { registerNotificationCronJobs } from "./jobs/notificationCron.js";

const app = express();

app.use(cors());
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

mongoose.connect("mongodb://localhost:27017/Book_My_Venue")
  .then(() => {
    console.log("DB Connected");
    // Start background cron jobs only after DB is ready
    registerSubscriptionCronJobs();
    registerVendorSubscriptionCronJobs();
    registerNotificationCronJobs();
  })
  .catch(() => console.log("DB Error"));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/users", userRoutes);
app.use("/vendors", vendorRoutes);
app.use("/admin", adminRoutes);
app.use("/venues", venueRoutes);
app.use("/ratings", ratingRoutes);
app.use("/bookings", bookingRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/", mockPaymentRoutes);
app.use("/terms", termsRoutes);
app.use("/complaints", complaintRoutes);
app.use("/contacts", contactRoutes);
app.use("/reports", reportRoutes);
app.use("/todos", todoRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/blogs", blogRoutes);
app.use("/api/dashboard", dashboardRoutes);


// ── Subscription System ─────────────────────────────────────
app.use("/plans", planRoutes);           // Admin CRUD + public GET
app.use("/subscription", subscriptionRoutes); // Vendor purchase, view, queue
app.use("/payments", paymentHistoryRoutes); // Payment history
app.use("/api/admin/plans", adminPlanRoutes);
app.use("/api/vendor/subscription", vendorSubscriptionRoutes);
app.use("/api/remaining-payment", remainingPaymentRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Global Error Caught:", err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on port 3000");
});
