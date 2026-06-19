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
import PaymentHistory from "../models/PaymentHistoryModel.js";
import { paginate } from "../utils/pagination.js";

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
router.get("/", isAdmin, async (req, res) => {
  try {
    const { page, limit, search, sortBy, sortOrder, startDate, endDate } = req.query;

    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (search) {
      query.$or = [
        { transactionId: { $regex: search, $options: "i" } },
        { userName: { $regex: search, $options: "i" } },
        { userEmail: { $regex: search, $options: "i" } },
        { vendorName: { $regex: search, $options: "i" } },
      ];
    }

    const paginationResult = await paginate(PaymentHistory, query, {
      page,
      limit,
      sortBy,
      sortOrder,
      allowedSortFields: ["createdAt", "amount", "paymentTimestamp"],
      populate: [
        { path: "vendorId", select: "fullName email phone businessName businessType address state pincode status" },
        { path: "userId", select: "name username email phone" },
        { path: "adminId", select: "username name fullName" }
      ],
      sort: undefined
    });

    const formatAdminVendorTransaction = (record) => {
      const data = record.toObject ? record.toObject() : record;
      const admin = data.adminId || null;
      return {
        ...data,
        adminName: admin?.name || admin?.fullName || admin?.username || null,
        vendorDetails: data.vendorId || null,
      };
    };

    paginationResult.data = paginationResult.data.map(formatAdminVendorTransaction);

    res.status(200).json({
      success: true,
      ...paginationResult
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to retrieve payment history", error: error.message });
  }
});

// ── Shared / Internal ─────────────────────────────────────────────────────────

// GET /payments/user-vendor — user-vendor booking payment transactions
router.get("/user-vendor", getUserVendorPayments);

export default router;
