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

import { registerSubscriptionCronJobs } from "./jobs/subscriptionCron.js";

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://localhost:27017/Book_My_Venue")
  .then(() => {
    console.log("DB Connected");
    // Start background cron jobs only after DB is ready
    registerSubscriptionCronJobs();
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

// ── Subscription System ─────────────────────────────────────
app.use("/plans", planRoutes);           // Admin CRUD + public GET
app.use("/subscription", subscriptionRoutes); // Vendor purchase, view, queue
app.use("/payments", paymentHistoryRoutes); // Payment history

app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on port 3000");
});
