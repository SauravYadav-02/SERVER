import Subscription from "../models/SubscriptionModel.js";

/**
 * Validates if an Add-on subscription is currently available/active and provides its benefits.
 * 
 * Under the Universal Add-on rules:
 * 1. Add-on Status = Active (ACTIVE)
 * 2. Add-on Not Expired (expiryDate > now)
 * 3. User has at least one ACTIVE Base Plan not expired.
 * 
 * @param {String} vendorId - The ID of the vendor/user
 * @param {Object} addonSubscription - The Add-on Subscription document
 * @returns {Promise<Boolean>} - Resolves to true if add-on is available, false otherwise
 */
export const isAddonAvailable = async (vendorId, addonSubscription) => {
  if (!addonSubscription) {
    return false;
  }

  const now = new Date();
  const addonStatus = String(addonSubscription.status).toUpperCase();

  // Add-on itself must be active
  const isAddonActive = addonStatus === "ACTIVE";

  // Add-on must not be expired
  const isAddonNotExpired = addonSubscription.expiryDate && new Date(addonSubscription.expiryDate) > now;

  if (!isAddonActive || !isAddonNotExpired) {
    return false;
  }

  try {
    // Check if the vendor has at least one ACTIVE, non-expired Base Plan
    const activeBase = await Subscription.findOne({
      vendorId,
      status: { $in: ["active", "ACTIVE"] },
      endDate: { $gt: now },
    });

    return !!activeBase;
  } catch (err) {
    console.error("Error in isAddonAvailable checking active base plan:", err);
    return false;
  }
};
