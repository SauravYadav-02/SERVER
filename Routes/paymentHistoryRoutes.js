import express from "express";
import {
  createPaymentHistoryEntry,
  getAdminVendorPayments,
  getAllPayments,
  getUserVendorPayments,
  getVendorPaymentHistory,
  getMySubscriptionPayments,
} from "../controllers/paymentHistoryController.js";
import { isAdmin } from "../middleare/isAdmin.js";
import { isVendor } from "../middleare/isVendor.js";

const router = express.Router();

// ── Vendor routes (self-service) ──────────────────────────────────────────────

// GET /payments/my/subscriptions
//   Vendor fetches only their own subscription payment history.
//   Authentication: vendorid header (set by isVendor middleware).
//   Supports: ?page, ?limit, ?paymentStatus, ?type, ?startDate, ?endDate
router.get("/my/subscriptions", isVendor, getMySubscriptionPayments);

// GET /payments/vendor/:vendorId
//   Legacy endpoint — vendor can only access their own data (ownership check inside controller).
router.get("/vendor/:vendorId", isVendor, getVendorPaymentHistory);

// ── Admin routes ──────────────────────────────────────────────────────────────

// POST /payments — create payment history entry (admin or internal system)
router.post("/", isAdmin, createPaymentHistoryEntry);

// GET /payments/admin-vendor — subscription and full-payment records only
router.get("/admin-vendor", isAdmin, getAdminVendorPayments);

// GET /payments — all payment history (admin only)
router.get("/", isAdmin, getAllPayments);

// ── Shared / Internal ─────────────────────────────────────────────────────────

// GET /payments/user-vendor — user-vendor booking payment transactions
router.get("/user-vendor", getUserVendorPayments);

export default router;
