import VendorSubscription from "../models/VendorSubscriptionModel.js";
import Vendor from "../models/VendorModel.js";

/**
 * isVendor middleware
 * Validates that the request carries a vendorId header (set after login).
 * Mirrors the isAdmin / isUser pattern already in the project.
 * Also attaches req.planLimits (from active plan or free-tier fallback).
 */
export const isVendor = async (req, res, next) => {
  const vendorId = req.headers.vendorid || req.headers["vendorid"];

  if (!vendorId) {
    return res.status(401).json({ message: "Vendor not authenticated. Missing vendorid header." });
  }

  try {
    const vendor = await Vendor.findById(vendorId);
    if (!vendor || vendor.deleted) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    if (vendor.status === "suspended") {
      return res.status(403).json({ message: "Access denied. Your vendor account is suspended." });
    }

    if (vendor.status !== "approved") {
      return res.status(403).json({ message: "Access denied. Vendor account is not approved." });
    }

    req.vendorId = vendorId;

    const fallbackLimits = {
      maxVenues: 1,
      visibilityBoost: false,
      customBranding: false,
      supportTier: "basic",
    };

    const subscription = await VendorSubscription.findOne({ vendorId }).populate("planId");

    if (!subscription || subscription.status === "expired" || !subscription.planId) {
      req.planLimits = fallbackLimits;
    } else {
      req.planLimits = {
        maxVenues: subscription.planId.maxVenues,
        visibilityBoost: subscription.planId.visibilityBoost,
        customBranding: subscription.planId.customBranding,
        supportTier: subscription.planId.supportTier,
      };
    }
  } catch (error) {
    console.error("Error in isVendor subscription check:", error);
    req.planLimits = {
      maxVenues: 1,
      visibilityBoost: false,
      customBranding: false,
      supportTier: "basic",
    };
  }

  next();
};
