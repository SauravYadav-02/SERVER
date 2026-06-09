import { getAggregatedPlanLimits } from "../services/subscriptionService.js";

export const checkSubscription = async (req, res, next) => {
  try {
    // Retrieve vendorId from headers, req.vendorId, or req.body
    const vendorId = req.headers.vendorid || req.headers["vendorid"] || req.vendorId || req.body?.vendorId;

    req.planLimits = await getAggregatedPlanLimits(vendorId);

    next();
  } catch (error) {
    console.error("Error in checkSubscription middleware:", error);
    // Safe fallback on error
    req.planLimits = {
      maxVenues: 1,
      maxPhotos: 10,
      visibilityBoost: false,
      customBranding: false,
      supportTier: "basic",
    };
    next();
  }
};
