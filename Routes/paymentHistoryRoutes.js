import express from "express";
import {
  createPaymentHistoryEntry,
  getAdminVendorPayments,
  getAllPayments,
  getUserVendorPayments,
  getVendorPaymentHistory,
} from "../controllers/paymentHistoryController.js";
import { isAdmin } from "../middleare/isAdmin.js";
import { isVendor } from "../middleare/isVendor.js";

const router = express.Router();

// Create payment history entry (admin or system)
router.post("/", isAdmin, createPaymentHistoryEntry);

// Admin-vendor payment transactions (subscription and full-payment records)
router.get("/admin-vendor", isAdmin, getAdminVendorPayments);

// User-vendor payment transactions (booking records)
router.get("/user-vendor", getUserVendorPayments);

// Get payment history for a specific vendor
router.get("/vendor/:vendorId", isVendor, getVendorPaymentHistory);

// Get all payment history (admin only)
router.get("/",  getAllPayments);
// router.get("/", isAdmin, getAllPayments);

export default router;
