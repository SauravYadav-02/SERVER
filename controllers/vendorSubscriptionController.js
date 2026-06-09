import VendorPlan from "../models/VendorPlanModel.js";
import VendorSubscription from "../models/VendorSubscriptionModel.js";
import Venue from "../models/VenueModel.js";

const handleError = (res, error) => {
  console.error("Vendor Subscription Controller Error:", error);
  res.status(500).json({
    message: error.message || "An error occurred while processing subscription.",
  });
};

// GET /plans — list active plans (public)
export const listActivePlans = async (req, res) => {
  try {
    const activePlans = await VendorPlan.find({ isActive: true }).sort({ monthlyPrice: 1 });
    res.status(200).json(activePlans);
  } catch (error) {
    handleError(res, error);
  }
};

// POST /subscribe — dummy payment -> activate subscription
export const subscribePlan = async (req, res) => {
  try {
    const { planId, cycle, paymentRef } = req.body;
    const vendorId = req.vendorId; // Set by isVendor middleware

    if (!planId || !cycle) {
      return res.status(400).json({ message: "planId and cycle are required." });
    }

    if (!["monthly", "yearly"].includes(cycle)) {
      return res.status(400).json({ message: "cycle must be 'monthly' or 'yearly'." });
    }

    const plan = await VendorPlan.findOne({ _id: planId, isActive: true });
    if (!plan) {
      return res.status(404).json({ message: "Active plan not found." });
    }

    const startDate = new Date();
    const expiresAt = new Date(startDate);
    if (cycle === "monthly") {
      expiresAt.setDate(expiresAt.getDate() + 30);
    } else {
      expiresAt.setDate(expiresAt.getDate() + 365);
    }

    const subscription = await VendorSubscription.findOneAndUpdate(
      { vendorId },
      {
        vendorId,
        planId: plan._id,
        cycle,
        startDate,
        expiresAt,
        status: "active",
        paymentRef: paymentRef || `DUMMY-PAY-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      },
      { upsert: true, new: true }
    ).populate("planId");

    // Activate all vendor's venues
    await Venue.updateMany({ vendorId }, { isSubscriptionActive: true });

    res.status(200).json({
      message: "Subscription activated successfully.",
      subscription,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// GET / — get current subscription status
export const getSubscriptionStatus = async (req, res) => {
  try {
    const vendorId = req.vendorId; // Set by isVendor middleware

    const subscription = await VendorSubscription.findOne({ vendorId }).populate("planId");
    
    // Count active (non-deleted) venues for this vendor
    const venueUsage = await Venue.countDocuments({ vendorId, deleted: { $ne: true } });

    res.status(200).json({
      subscription,
      venueUsage,
    });
  } catch (error) {
    handleError(res, error);
  }
};
