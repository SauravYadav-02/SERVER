/**
 * Validates if an Add-on subscription is currently available/active and provides its benefits.
 * 
 * An Add-on is ACTIVE only when:
 * 1. Base Plan Status = Active (ACTIVE)
 * 2. Base Plan Not Expired (expiryDate/endDate > now)
 * 3. Add-on Status = Active (ACTIVE)
 * 4. Add-on Not Expired (expiryDate > now)
 * 
 * @param {Object} baseSubscription - The parent Base Subscription
 * @param {Object} addonSubscription - The Add-on Subscription
 * @returns {Boolean} - True if add-on is active and available, false otherwise
 */
export const isAddonAvailable = (baseSubscription, addonSubscription) => {
  if (!baseSubscription || !addonSubscription) {
    return false;
  }

  const now = new Date();

  // Normalize base subscription status (handle case-insensitivity just in case)
  const baseStatus = String(baseSubscription.status).toUpperCase();
  const addonStatus = String(addonSubscription.status).toUpperCase();

  // Base Plan must be active
  const isBaseActive = baseStatus === "ACTIVE" || baseStatus === "active";
  
  // Base Plan must not be expired
  const baseExpiry = baseSubscription.expiryDate || baseSubscription.endDate;
  const isBaseNotExpired = baseExpiry && new Date(baseExpiry) > now;

  // Add-on must be active
  const isAddonActive = addonStatus === "ACTIVE";

  // Add-on must not be expired
  const isAddonNotExpired = addonSubscription.expiryDate && new Date(addonSubscription.expiryDate) > now;

  return isBaseActive && isBaseNotExpired && isAddonActive && isAddonNotExpired;
};
