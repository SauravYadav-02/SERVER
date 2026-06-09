import VendorSubscription from "../models/VendorSubscriptionModel.js";

export const checkSubscription = async (req, res, next) => {
  try {
    // Retrieve vendorId from headers, req.vendorId, or req.body
    const vendorId = req.headers.vendorid || req.headers["vendorid"] || req.vendorId || req.body?.vendorId;

    const fallbackLimits = {
      maxVenues: 1,
      visibilityBoost: false,
      customBranding: false,
      supportTier: "basic",
    };

    if (!vendorId) {
      req.planLimits = fallbackLimits;
      return next();
    }

    const subscription = await VendorSubscription.findOne({ vendorId }).populate("planId");

    if (!subscription || subscription.status === "expired" || !subscription.planId) {
      req.planLimits = fallbackLimits;
    } else {
      // If subscription status is active or grace, use its plan limits
      req.planLimits = {
        maxVenues: subscription.planId.maxVenues,
        visibilityBoost: subscription.planId.visibilityBoost,
        customBranding: subscription.planId.customBranding,
        supportTier: subscription.planId.supportTier,
      };
    }

    next();
  } catch (error) {
    console.error("Error in checkSubscription middleware:", error);
    // Safe fallback on error
    req.planLimits = {
      maxVenues: 1,
      visibilityBoost: false,
      customBranding: false,
      supportTier: "basic",
    };
    next();
  }
};
