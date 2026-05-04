import express from "express";
import { isVendor } from "../middleare/isVendor.js";
import { isAdmin } from "../middleare/isAdmin.js";
import {
  addOnSubscription,
  addOnSubscriptionByAdmin,
  assignSubscriptionByAdmin,
  getAllSubscriptionsForAdmin,
  getQueue,
  getSubscription,
  getVendorSubscriptionForAdmin,
  purchasePlan,
} from "../services/subscriptionService.js";

const router = express.Router();

router.post("/purchase", isVendor, async (req, res) => {
  try {
    const { planId } = req.body;

    if (!planId || typeof planId !== "string" || planId.trim() === "") {
      return res.status(400).json({ success: false, message: "planId is required." });
    }

    const result = await purchasePlan(req.vendorId, planId.trim());
    res.status(result.queued ? 202 : 201).json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

router.post("/add-on", isVendor, async (req, res) => {
  try {
    const { planId, startDate, endDate } = req.body;

    if (!planId || typeof planId !== "string" || planId.trim() === "") {
      return res.status(400).json({ success: false, message: "planId is required." });
    }

    const result = await addOnSubscription(req.vendorId, planId.trim(), startDate || new Date(), endDate || null);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

router.get("/", isVendor, async (req, res) => {
  try {
    const subscription = await getSubscription(req.vendorId);
    res.json({ success: true, subscription });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

router.get("/queue", isVendor, async (req, res) => {
  try {
    const queue = await getQueue(req.vendorId);
    res.json({ success: true, count: queue.length, queue });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

router.get("/all", isAdmin, async (req, res) => {
  try {
    const subscriptions = await getAllSubscriptionsForAdmin();
    const summary = {
      total: subscriptions.length,
      active: subscriptions.filter((sub) => sub.status === "active").length,
      grace: subscriptions.filter((sub) => sub.status === "grace").length,
      expired: subscriptions.filter((sub) => sub.status === "expired").length,
      expiringWithin15Days: subscriptions.filter((sub) =>
        sub.expirationWarning.expiresWithin15Days ||
        sub.graceExpirationWarning.expiresWithin15Days ||
        sub.addOns.some((addOn) => addOn.expirationWarning.expiresWithin15Days)
      ).length,
    };

    res.json({ success: true, warningWindowDays: 15, summary, subscriptions });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

router.get("/expiring-soon", isAdmin, async (req, res) => {
  try {
    const subscriptions = await getAllSubscriptionsForAdmin({ expiringSoonOnly: true });
    res.json({
      success: true,
      warningWindowDays: 15,
      count: subscriptions.length,
      subscriptions,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

router.get("/admin/vendor/:vendorId", isAdmin, async (req, res) => {
  try {
    const subscription = await getVendorSubscriptionForAdmin(req.params.vendorId);
    res.json({ success: true, subscription });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

router.post("/admin/assign", isAdmin, async (req, res) => {
  try {
    const { vendorId, planId, startDate, endDate } = req.body;

    if (!vendorId || !planId) {
      return res.status(400).json({ success: false, message: "vendorId and planId are required." });
    }

    const result = await assignSubscriptionByAdmin({ vendorId, planId, startDate, endDate });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

router.post("/admin/add-on", isAdmin, async (req, res) => {
  try {
    const { vendorId, planId, startDate, endDate } = req.body;

    if (!vendorId || !planId) {
      return res.status(400).json({ success: false, message: "vendorId and planId are required." });
    }

    const result = await addOnSubscriptionByAdmin({ vendorId, planId, startDate, endDate });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

export default router;
