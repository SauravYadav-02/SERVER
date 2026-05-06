import express from "express";
import { createPaymentHistoryEntry, getVendorPaymentHistory, getAllPayments } from "../controllers/paymentHistoryController.js";
import { isAdmin } from "../middleare/isAdmin.js";
import { isVendor } from "../middleare/isVendor.js";

const router = express.Router();

// Create payment history entry (admin or system)
router.post("/", isAdmin, createPaymentHistoryEntry);

// Get payment history for a specific vendor
router.get("/vendor/:vendorId", isVendor, getVendorPaymentHistory);

// Get all payment history (admin only)
router.get("/", isAdmin, getAllPayments);

export default router;