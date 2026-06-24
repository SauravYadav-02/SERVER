import express from "express";
import {
  assignFullPayment,
  assignSubscription,
  confirmSubscriptionPaymentIntent,
  createSubscriptionPaymentIntent,
  getAllSubscriptions,
  getExpiringSubscriptions,
  getMySubscription,
  getMySubscriptionQueue,
  getVendorSubscription,
  getMyAddons,
  getAllAddonsForAdmin,
} from "../controllers/subscriptionController.js";
import { isAdmin } from "../middleare/isAdmin.js";
import { isVendor } from "../middleare/isVendor.js";
import Subscription from "../models/SubscriptionModel.js";

const router = express.Router();

router.post("/create-payment", isVendor, createSubscriptionPaymentIntent);
router.post("/confirm-payment", isVendor, confirmSubscriptionPaymentIntent);
router.get("/", isVendor, getMySubscription);
router.get("/queue", isVendor, getMySubscriptionQueue);
router.get("/addons", isVendor, getMyAddons);

router.get("/all", isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.status && req.query.status !== 'all') {
      query.status = req.query.status;
    }

    if (search) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [
        { status: regex },
        { "planSnapshot.name": regex }
      ];
    }

    const [subscriptions, totalRecords] = await Promise.all([
      Subscription.find(query)
        .populate("vendorId", "fullName email phone businessName businessType address state pincode status")
        .populate("planId", "name price duration_days features planType")
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Subscription.countDocuments(query)
    ]);

    return res.status(200).json({
      data: subscriptions,
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit)
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve subscriptions: " + error.message });
  }
});
router.get("/expiring-soon", isAdmin, getExpiringSubscriptions);
router.get("/admin/vendor/:vendorId", isAdmin, getVendorSubscription);
router.post("/admin/assign", isAdmin, assignSubscription);
router.post("/admin/full-payment", isAdmin, assignFullPayment);
router.get("/admin/addons", isAdmin, getAllAddonsForAdmin);

export default router;
